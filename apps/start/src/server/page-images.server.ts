import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PdfiumNative } from '@embedpdf/engines/pdfium';
import { init } from '@embedpdf/pdfium';
import { Context, Effect, Layer, Semaphore } from 'effect';
import sharp from 'sharp';
import { ByteCache } from './byte-cache';

// A customer reads the quote's PDF itself, as images of its pages. A PDF
// viewer in the browser ships a 2 MB engine to every customer; here the
// server runs that same engine, PDFium, once per page and sends WebP. The
// images are kept by the PDF's digest, which changes with any byte of it.

/** A rendered PDF and the SHA-256 of its bytes, in hex. */
export interface Pdf {
  readonly bytes: Uint8Array;
  readonly digest: string;
}

/** How many pages a PDF has, and the size of its first, in points. */
export interface Sheets {
  readonly count: number;
  readonly width: number;
  readonly height: number;
}

export interface PageImagesApi {
  readonly sheets: (pdf: Pdf) => Effect.Effect<Sheets>;
  /** Page `index`, counted from 0, as WebP. Null past the last page. */
  readonly page: (
    pdf: Pdf,
    index: number,
    compact?: boolean,
  ) => Effect.Effect<Uint8Array | null>;
}

export class PageImages extends Context.Service<PageImages, PageImagesApi>()(
  'PageImages',
) {}

/** A document open in PDFium. The engine's models package names it; this app does not depend on that. */
type OpenDocument = Awaited<
  ReturnType<ReturnType<PdfiumNative['openDocumentBuffer']>['toPromise']>
>;

// An A4 page is 595 points wide. At 2.25 it is 1339 pixels: sharp on a
// high-density screen at the 670 pixels the quote page sets it.
const scale = 2.25;

export const pageImagesLayer = Layer.effect(
  PageImages,
  Effect.gen(function* () {
    // The engine loads on the first page asked for, not at boot: most
    // requests never need it, and its WebAssembly is 4.6 MB.
    const engine = yield* Effect.cached(
      Effect.promise(async () => {
        const require = createRequire(import.meta.url);
        const wasmBinary = await readFile(
          require.resolve('@embedpdf/pdfium/pdfium.wasm'),
        );
        return new PdfiumNative(await init({ wasmBinary }));
      }),
    );

    // PDFium shares one WASM heap. One open document also bounds temporary
    // RGBA buffers. Cache keys never retain the source PDF after a render.
    const renders = yield* Semaphore.make(1);
    const sheets = new ByteCache<Sheets>(64 * 1024);
    const pages = new ByteCache<Uint8Array | null>(24 * 1024 * 1024);

    const opened = <A>(
      pdf: Pdf,
      use: (pdfium: PdfiumNative, document: OpenDocument) => Promise<A>,
    ) =>
      Effect.flatMap(engine, (pdfium) =>
        Effect.promise(async () => {
          if (pdf.bytes.byteLength > 16 * 1024 * 1024)
            throw new Error('PDF exceeds the page renderer byte limit.');
          const document = await pdfium
            .openDocumentBuffer({
              id: crypto.randomUUID(),
              content: pdf.bytes.slice().buffer,
            })
            .toPromise();
          try {
            if (document.pageCount > 100)
              throw new Error('PDF exceeds the page renderer page limit.');
            return await use(pdfium, document);
          } finally {
            await pdfium.closeDocument(document).toPromise();
          }
        }),
      );

    const sheet = Effect.fn('PageImages.sheets')(function* (pdf: Pdf) {
      const cached = sheets.get(pdf.digest);
      if (cached) return cached;
      const result = yield* opened(pdf, async (_, document) => ({
        count: document.pageCount,
        width: document.pages[0]?.size.width ?? 0,
        height: document.pages[0]?.size.height ?? 0,
      }));
      sheets.set(pdf.digest, result, 24);
      return result;
    });

    const page = Effect.fn('PageImages.page')(function* (
      pdf: Pdf,
      index: number,
      compact = false,
    ) {
      if (!Number.isInteger(index) || index < 0) return null;
      const key = `${pdf.digest}:${index}:${compact ? 'compact' : 'full'}`;
      const cached = pages.get(key);
      if (cached !== undefined) return cached;
      const result = yield* opened(pdf, async (pdfium, document) => {
        const page = document.pages[index];
        if (!page) return null;
        const factor = compact
          ? Math.min(scale, 1080 / page.size.width)
          : scale;
        const width = Math.ceil(page.size.width * factor);
        const height = Math.ceil(page.size.height * factor);
        // Reject oversized pages before PDFium allocates their pixel buffer.
        if (
          !Number.isFinite(width * height) ||
          width <= 0 ||
          height <= 0 ||
          width * height > 12_000_000
        )
          throw new Error('PDF page exceeds the page renderer pixel limit.');
        const image = await pdfium
          .renderPageRaw(document, page, { scaleFactor: factor })
          .toPromise();
        const pixels = Buffer.from(
          image.data.buffer,
          image.data.byteOffset,
          image.data.byteLength,
        );
        return new Uint8Array(
          await sharp(pixels, {
            raw: { width: image.width, height: image.height, channels: 4 },
          })
            .webp({ quality: 84 })
            .toBuffer(),
        );
      });
      pages.set(key, result, result?.byteLength ?? 0);
      return result;
    });

    // Promise-based native work cannot be cancelled. Keep the permit until
    // closeDocument finishes, even when the requesting fiber is interrupted.
    return PageImages.of({
      sheets: (pdf) =>
        renders.withPermits(1)(Effect.uninterruptible(sheet(pdf))),
      page: (pdf, index, compact) =>
        renders.withPermits(1)(
          Effect.uninterruptible(page(pdf, index, compact)),
        ),
    });
  }),
);
