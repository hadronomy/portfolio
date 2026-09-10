import { createPluginRegistration } from '@embedpdf/core';
import { EmbedPDF } from '@embedpdf/core/react';
import { usePdfiumEngine } from '@embedpdf/engines/react';
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager';
import {
  DocumentContent,
  useActiveDocument,
  useDocumentManagerCapability,
} from '@embedpdf/plugin-document-manager/react';
import { InteractionManagerPluginPackage } from '@embedpdf/plugin-interaction-manager';
import { PagePointerProvider } from '@embedpdf/plugin-interaction-manager/react';
import { PrintPluginPackage } from '@embedpdf/plugin-print';
import { PrintFrame, usePrint } from '@embedpdf/plugin-print/react';
import { RenderPluginPackage } from '@embedpdf/plugin-render';
import { RenderLayer } from '@embedpdf/plugin-render/react';
import { ScrollPluginPackage } from '@embedpdf/plugin-scroll';
import {
  Scroller,
  useScroll,
  useScrollCapability,
} from '@embedpdf/plugin-scroll/react';
import { SearchPluginPackage } from '@embedpdf/plugin-search';
import { SearchLayer, useSearch } from '@embedpdf/plugin-search/react';
import { SelectionPluginPackage } from '@embedpdf/plugin-selection';
import { SelectionLayer } from '@embedpdf/plugin-selection/react';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport';
import { Viewport } from '@embedpdf/plugin-viewport/react';
import { ZoomMode, ZoomPluginPackage } from '@embedpdf/plugin-zoom';
import { useZoom, useZoomCapability } from '@embedpdf/plugin-zoom/react';
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Minus,
  Plus,
  Printer,
  Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MorphText } from './ui';

const plugins = [
  createPluginRegistration(DocumentManagerPluginPackage),
  createPluginRegistration(ViewportPluginPackage),
  createPluginRegistration(ScrollPluginPackage),
  createPluginRegistration(RenderPluginPackage),
  createPluginRegistration(InteractionManagerPluginPackage),
  createPluginRegistration(ZoomPluginPackage, {
    defaultZoomLevel: ZoomMode.FitPage,
  }),
  createPluginRegistration(SelectionPluginPackage),
  createPluginRegistration(PrintPluginPackage),
  createPluginRegistration(SearchPluginPackage),
];

// fetch() runs base64 decoding in native code instead of a JS char loop over
// the full string on the main thread.
async function decodePdfBytes(base64: string): Promise<ArrayBuffer> {
  const response = await fetch(`data:application/pdf;base64,${base64}`);
  return response.arrayBuffer();
}

// Collapses rapid scroll/zoom updates to one trailing render so the animated
// readouts below do not morph on every frame.
function useThrottledValue<T>(value: T, delay = 200): T {
  const [rendered, setRendered] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const timer = setTimeout(() => setRendered(latest.current), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return rendered;
}

export default function PdfViewer({ bytes }: { bytes: string }) {
  // Resolve against the document base on the main thread: the PDFium worker
  // is created from a blob: URL, so a relative or root-relative asset URL
  // would fail to resolve inside it and leave the engine dead but silent.
  const absoluteWasmUrl =
    typeof document === 'undefined'
      ? wasmUrl
      : new URL(wasmUrl, document.baseURI).href;
  const { engine, error } = usePdfiumEngine({
    wasmUrl: absoluteWasmUrl,
    worker: true,
    fontFallback: null,
  });
  // Watchdog: the worker path resolves with an engine object before it is
  // ready, so a failed wasm fetch never rejects into `error`. After 12s
  // without an engine, say so instead of preparing forever.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), 12_000);
    return () => clearTimeout(timer);
  }, [bytes]);
  useEffect(() => {
    if (engine) setTimedOut(false);
  }, [engine]);
  if (!engine)
    return (
      <output className="iv-preview-message">
        {error || timedOut
          ? 'The PDF viewer could not start. Reload the preview to try again.'
          : 'Preparing the document viewer…'}
      </output>
    );
  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {/* Handles print requests with a hidden iframe; without it the print
          task pends forever and the button silently does nothing. */}
      <PrintFrame />
      <Document bytes={bytes} />
    </EmbedPDF>
  );
}

function Document({ bytes }: { bytes: string }) {
  const { provides: documents } = useDocumentManagerCapability();
  const { provides: zoom } = useZoomCapability();
  const { provides: scroll } = useScrollCapability();
  const { activeDocumentId } = useActiveDocument();
  const [error, setError] = useState('');
  // Watchdog: with a dead engine the open call pends forever and
  // activeDocumentId never arrives. Flag the stall so the preview shows a
  // recoverable error instead of "Opening document…" without end.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    setStalled(false);
    if (!bytes) return;
    const timer = setTimeout(() => setStalled(true), 15_000);
    return () => clearTimeout(timer);
  }, [bytes]);
  const generation = useRef(0);
  // Refs mirror the live document so the unmount cleanup can close it after
  // the capabilities that opened it are gone from the effect closure.
  const liveId = useRef<string | undefined>(undefined);
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  useEffect(() => {
    liveId.current = activeDocumentId ?? undefined;
  }, [activeDocumentId]);
  useEffect(
    () => () => {
      const docs = documentsRef.current;
      const id = liveId.current;
      if (docs && id)
        docs
          .closeDocument(id)
          .toPromise()
          .catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!documents || !zoom || !scroll) return;
    const current = ++generation.current;
    let cancelled = false;
    // Message chains below read the previous document first so the zoom level
    // and page survive the swap; each forDocument() targets one plugin.
    const previous = documents.getActiveDocumentId();
    const scale = previous
      ? zoom.forDocument(previous).getState().currentZoomLevel
      : undefined;
    const page = previous ? scroll.forDocument(previous).getCurrentPage() : 1;
    async function replace() {
      if (!documents || !zoom || !scroll) return;
      let id: string | undefined;
      try {
        const buffer = await decodePdfBytes(bytes);
        const opened = await documents
          .openDocumentBuffer({
            buffer,
            name: 'Invoice.pdf',
            autoActivate: false,
            ...(scale === undefined ? {} : { scale }),
          })
          .toPromise();
        id = opened.documentId;
        await opened.task.toPromise();
        if (cancelled || current !== generation.current) {
          await documents
            .closeDocument(id)
            .toPromise()
            .catch(() => {});
          return;
        }
        liveId.current = id;
        documents.setActiveDocument(id);
        if (scale) zoom.forDocument(id).requestZoom(scale);
        scroll
          .forDocument(id)
          .scrollToPage({ pageNumber: page, behavior: 'instant' });
        if (previous)
          await documents
            .closeDocument(previous)
            .toPromise()
            .catch(() => {});
        setError('');
      } catch {
        if (id && id !== documents.getActiveDocumentId())
          await documents
            .closeDocument(id)
            .toPromise()
            .catch(() => {});
        if (!cancelled)
          setError(
            'The new preview could not load. The previous preview is still available.',
          );
      }
    }
    replace();
    return () => {
      cancelled = true;
    };
  }, [bytes, documents, zoom, scroll]);
  return (
    <div className="iv-pdf-viewer">
      {error && (
        <div className="iv-error" role="alert">
          {error}
        </div>
      )}
      {!error && stalled && !activeDocumentId && (
        <div className="iv-error" role="alert">
          The preview is taking too long to open. Reload the preview to try
          again.
        </div>
      )}
      {activeDocumentId ? (
        <DocumentContent documentId={activeDocumentId}>
          {({ isLoaded }) => (
            <>
              {!isLoaded && (
                <div className="iv-preview-message">Loading document…</div>
              )}
              <div
                className="t-panel-slide"
                data-open={isLoaded}
                aria-hidden={!isLoaded}
              >
                {isLoaded && <Pages documentId={activeDocumentId} />}
              </div>
            </>
          )}
        </DocumentContent>
      ) : (
        <div className="iv-preview-message">Opening document…</div>
      )}
    </div>
  );
}

function Pages({ documentId }: { documentId: string }) {
  const { provides: zoom, state: zoomState } = useZoom(documentId);
  const { provides: scroll, state } = useScroll(documentId);
  const { provides: print } = usePrint(documentId);
  const { provides: search, state: searchState } = useSearch(documentId);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const page = useThrottledValue(state.currentPage);
  const zoomPercent = useThrottledValue(
    Math.round(zoomState.currentZoomLevel * 100),
  );
  useEffect(() => {
    if (!searching || !search) return;
    const timer = setTimeout(() => {
      search.startSearch();
      search
        .searchAllPages(query)
        .toPromise()
        .catch(() => setError('PDF search failed.'));
    }, 180);
    return () => clearTimeout(timer);
  }, [query, searching, search]);
  return (
    <>
      <div className="iv-pdf-toolbar">
        <div>
          <button
            aria-label="Previous page"
            disabled={state.currentPage <= 1}
            onClick={() =>
              scroll?.scrollToPage({ pageNumber: state.currentPage - 1 })
            }
          >
            <ChevronUp size={16} />
          </button>
          <span>
            <MorphText>{`${page} / ${state.totalPages}`}</MorphText>
          </span>
          <button
            aria-label="Next page"
            disabled={state.currentPage >= state.totalPages}
            onClick={() =>
              scroll?.scrollToPage({ pageNumber: state.currentPage + 1 })
            }
          >
            <ChevronDown size={16} />
          </button>
        </div>
        <div>
          <button aria-label="Zoom out" onClick={() => zoom?.zoomOut()}>
            <Minus size={15} />
          </button>
          <span>
            <MorphText>{`${zoomPercent}%`}</MorphText>
          </span>
          <button aria-label="Zoom in" onClick={() => zoom?.zoomIn()}>
            <Plus size={15} />
          </button>
          <button
            aria-label="Fit page"
            onClick={() => zoom?.requestZoom(ZoomMode.FitPage)}
          >
            <Maximize size={15} />
          </button>
        </div>
        <div>
          <button
            aria-label="Search PDF"
            aria-pressed={searching}
            onClick={() => {
              setSearching(!searching);
              if (searching) search?.stopSearch();
            }}
          >
            <Search size={16} />
          </button>
          <button
            aria-label="Print PDF"
            onClick={() => {
              if (!print) {
                setError(
                  'Printing is unavailable. Download the PDF to print it.',
                );
                return;
              }
              print
                .print()
                .toPromise()
                .catch(() =>
                  setError('Printing failed. Download the PDF to print it.'),
                );
            }}
          >
            <Printer size={16} />
          </button>
        </div>
      </div>
      {searching && (
        <div className="iv-pdf-search">
          <input
            aria-label="Find in PDF"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find in document…"
          />
          <span>{`${searchState.total} matches`}</span>
          <button aria-label="Next match" onClick={() => search?.nextResult()}>
            <ChevronDown size={15} />
          </button>
        </div>
      )}
      {error && (
        <div className="iv-error" role="alert">
          {error}
        </div>
      )}
      <Viewport
        documentId={documentId}
        className="iv-pdf-viewport"
        style={{ flex: 1, minHeight: 0 }}
      >
        <Scroller
          documentId={documentId}
          renderPage={({ width, height, pageIndex }) => (
            <PagePointerProvider
              documentId={documentId}
              pageIndex={pageIndex}
              style={{
                width,
                height,
                position: 'relative',
                background: '#fff',
                boxShadow: '0 8px 20px #24160f30',
              }}
            >
              <RenderLayer documentId={documentId} pageIndex={pageIndex} />
              <SelectionLayer documentId={documentId} pageIndex={pageIndex} />
              <SearchLayer documentId={documentId} pageIndex={pageIndex} />
            </PagePointerProvider>
          )}
        />
      </Viewport>
    </>
  );
}
