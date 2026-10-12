import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { init } from '@embedpdf/pdfium';

/** An incremental save preserves the accepted bytes as the signed copy's prefix. */
export async function appendPdf(
  original: Uint8Array,
  appendix: Uint8Array,
): Promise<Uint8Array> {
  const require = createRequire(import.meta.url);
  const engine = await init({
    wasmBinary: await readFile(require.resolve('@embedpdf/pdfium/pdfium.wasm')),
  });
  const { pdfium } = engine;
  const heap = () => {
    if (!('HEAPU8' in pdfium) || !(pdfium.HEAPU8 instanceof Uint8Array))
      throw new Error('The PDFium byte buffer is unavailable.');
    return pdfium.HEAPU8;
  };
  const allocations: number[] = [];
  const documents: number[] = [];
  const allocate = (size: number) => {
    const pointer = pdfium.wasmExports.malloc(size);
    allocations.push(pointer);
    return pointer;
  };
  const open = (bytes: Uint8Array) => {
    const pointer = allocate(bytes.length);
    heap().set(bytes, pointer);
    const document = engine.FPDF_LoadMemDocument(pointer, bytes.length, '');
    if (!document) throw new Error('The PDF could not be opened.');
    documents.push(document);
    return document;
  };
  engine.PDFiumExt_Init();
  try {
    const document = open(original);
    const extra = open(appendix);
    if (
      !engine.FPDF_ImportPages(
        document,
        extra,
        '',
        engine.FPDF_GetPageCount(document),
      )
    )
      throw new Error('The acceptance page could not be appended.');
    const writer = engine.PDFiumExt_OpenFileWriter();
    try {
      // FPDF_INCREMENTAL appends objects and a new cross-reference table.
      if (!engine.FPDF_SaveAsCopy(document, writer, 1))
        throw new Error('The signed PDF could not be saved.');
      const size = engine.PDFiumExt_GetFileWriterSize(writer);
      const output = allocate(size);
      engine.PDFiumExt_GetFileWriterData(writer, output, size);
      const bytes = heap().slice(output, output + size);
      if (
        !Buffer.from(bytes.subarray(0, original.length)).equals(
          Buffer.from(original),
        )
      )
        throw new Error('The signed PDF did not preserve the accepted bytes.');
      return bytes;
    } finally {
      engine.PDFiumExt_CloseFileWriter(writer);
    }
  } finally {
    for (const document of documents) engine.FPDF_CloseDocument(document);
    for (const pointer of allocations) pdfium.wasmExports.free(pointer);
    engine.FPDF_DestroyLibrary();
  }
}
