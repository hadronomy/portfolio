import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PdfiumNative } from '@embedpdf/engines/pdfium';
import { init } from '@embedpdf/pdfium';
import { Cache, Context, Effect, Equal, Hash, Layer } from 'effect';
import sharp from 'sharp';

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
  readonly page: (pdf: Pdf, index: number) => Effect.Effect<Uint8Array | null>;
}

export class PageImages extends Context.Service<PageImages, PageImagesApi>()(
  'PageImages',
) {}

/**
 * One page of one PDF as a cache key. It compares by digest alone, and
 * carries the bytes so a miss can render from them.
 */
class Page implements Equal.Equal {
  constructor(
    readonly pdf: Pdf,
    readonly index: number,
  ) {}
  [Equal.symbol](that: Equal.Equal): boolean {
    return (
      that instanceof Page &&
      that.pdf.digest === this.pdf.digest &&
      that.index === this.index
    );
  }
  [Hash.symbol](): number {
    return Hash.string(`${this.pdf.digest}:${this.index}`);
  }
}

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

    const opened = <A>(
      pdf: Pdf,
      use: (pdfium: PdfiumNative, document: OpenDocument) => Promise<A>,
    ) =>
      Effect.flatMap(engine, (pdfium) =>
        Effect.promise(async () => {
          const document = await pdfium
            .openDocumentBuffer({
              id: crypto.randomUUID(),
              content: pdf.bytes.slice().buffer,
            })
            .toPromise();
          try {
            return await use(pdfium, document);
          } finally {
            await pdfium.closeDocument(document).toPromise();
          }
        }),
      );

    const sheets = yield* Cache.make({
      capacity: 100,
      lookup: ({ pdf }: Page) =>
        opened(pdf, async (_, document) => ({
          count: document.pageCount,
          width: document.pages[0]?.size.width ?? 0,
          height: document.pages[0]?.size.height ?? 0,
        })),
    });

    const pages = yield* Cache.make({
      capacity: 200,
      lookup: ({ pdf, index }: Page) =>
        opened(pdf, async (pdfium, document) => {
          const page = document.pages[index];
          if (!page) return null;
          const image = await pdfium
            .renderPageRaw(document, page, { scaleFactor: scale })
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
        }),
    });

    return PageImages.of({
      sheets: (pdf) =>
        Cache.get(sheets, new Page(pdf, 0)).pipe(
          Effect.withSpan('PageImages.sheets'),
        ),
      page: (pdf, index) =>
        Cache.get(pages, new Page(pdf, index)).pipe(
          Effect.withSpan('PageImages.page'),
        ),
    });
  }),
);
