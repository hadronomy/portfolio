import { Effect, ManagedRuntime } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  opens: 0,
  renders: 0,
  active: 0,
  maximum: 0,
  width: 10,
  height: 10,
  count: 1,
  scales: [] as number[],
  gate: undefined as Promise<void> | undefined,
  opened: undefined as (() => void) | undefined,
}));
vi.mock('node:fs/promises', () => ({ readFile: async () => new Uint8Array() }));
vi.mock('@embedpdf/pdfium', () => ({ init: async () => ({}) }));
vi.mock('@embedpdf/engines/pdfium', () => ({
  PdfiumNative: class {
    openDocumentBuffer() {
      return {
        toPromise: async () => {
          state.opens++;
          state.active++;
          state.maximum = Math.max(state.maximum, state.active);
          state.opened?.();
          await state.gate;
          return {
            pageCount: state.count,
            pages: [{ size: { width: state.width, height: state.height } }],
          };
        },
      };
    }
    closeDocument() {
      return {
        toPromise: async () => {
          state.active--;
        },
      };
    }
    renderPageRaw(
      _document: unknown,
      _page: unknown,
      options: { scaleFactor: number },
    ) {
      state.renders++;
      state.scales.push(options.scaleFactor);
      return {
        toPromise: async () => ({
          width: 1,
          height: 1,
          data: new Uint8Array(4),
        }),
      };
    }
  },
}));
vi.mock('sharp', () => ({
  default: () => ({
    webp: () => ({ toBuffer: async () => Buffer.from([1, 2, 3]) }),
  }),
}));

import { PageImages, pageImagesLayer } from './page-images.server';

let runtime: ManagedRuntime.ManagedRuntime<PageImages, never> | undefined;
afterEach(async () => {
  await runtime?.dispose();
  state.opens = state.renders = state.active = state.maximum = 0;
  state.width = state.height = 10;
  state.count = 1;
  state.scales = [];
  state.gate = undefined;
  state.opened = undefined;
});
const pdf = (digest: string) => ({ digest, bytes: new Uint8Array([1]) });
const page = (digest: string) =>
  PageImages.use((images) => images.page(pdf(digest), 0));

describe('PDFium resource bounds', () => {
  it('renders and caches the compact page separately from the full page', async () => {
    state.width = 595;
    state.height = 842;
    runtime = ManagedRuntime.make(pageImagesLayer);
    await runtime.runPromise(
      Effect.gen(function* () {
        const images = yield* PageImages;
        yield* images.page(pdf('a'), 0);
        yield* images.page(pdf('a'), 0, true);
        yield* images.page(pdf('a'), 0, true);
        yield* images.page(pdf('a'), 0);
      }),
    );
    expect(state.renders).toBe(2);
    expect(state.scales[0]).toBe(2.25);
    expect(Math.ceil(state.width * (state.scales[1] ?? 0))).toBe(1080);
  });
  it('opens one document at a time and reuses a repeated page', async () => {
    runtime = ManagedRuntime.make(pageImagesLayer);
    const result = await runtime.runPromise(
      Effect.all([page('a'), page('b'), page('a')], {
        concurrency: 'unbounded',
      }),
    );
    expect(result).toHaveLength(3);
    expect(state.maximum).toBe(1);
    expect(state.opens).toBe(2);
    expect(state.renders).toBe(2);
    expect(state.active).toBe(0);
  });
  it('rejects oversized pixels before rendering and closes the document', async () => {
    state.width = state.height = 100_000;
    runtime = ManagedRuntime.make(pageImagesLayer);
    await expect(runtime.runPromise(page('a'))).rejects.toThrow('pixel limit');
    expect(state.renders).toBe(0);
    expect(state.active).toBe(0);
  });
  it('bounds document bytes and pages', async () => {
    runtime = ManagedRuntime.make(pageImagesLayer);
    await expect(
      runtime.runPromise(
        PageImages.use((images) =>
          images.sheets({
            digest: 'large',
            bytes: new Uint8Array(16 * 1024 * 1024 + 1),
          }),
        ),
      ),
    ).rejects.toThrow('byte limit');
    expect(state.opens).toBe(0);
    state.count = 101;
    await expect(runtime.runPromise(page('many'))).rejects.toThrow(
      'page limit',
    );
    expect(state.active).toBe(0);
  });
  it('holds the permit until native work closes after interruption', async () => {
    runtime = ManagedRuntime.make(pageImagesLayer);
    let release: () => void = () => {};
    state.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      state.opened = resolve;
    });
    const abort = new AbortController();
    const first = runtime
      .runPromise(page('a'), { signal: abort.signal })
      .catch(() => undefined);
    await started;
    abort.abort();
    const second = runtime.runPromise(page('b'));
    release();
    await Promise.all([first, second]);
    expect(state.maximum).toBe(1);
    expect(state.active).toBe(0);
  });
});
