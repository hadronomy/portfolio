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
import { Scroller, useScroll } from '@embedpdf/plugin-scroll/react';
import { SearchPluginPackage } from '@embedpdf/plugin-search';
import { SearchLayer, useSearch } from '@embedpdf/plugin-search/react';
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport';
import {
  useViewportCapability,
  Viewport,
} from '@embedpdf/plugin-viewport/react';
import { ZoomMode, ZoomPluginPackage } from '@embedpdf/plugin-zoom';
import { useZoom, useZoomCapability } from '@embedpdf/plugin-zoom/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Minus,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  attachCanvasGestures,
  type CanvasGestures,
} from '~/features/invoices/canvas-gestures';
import {
  fadeStill,
  paintStill,
  visibleSheets,
} from '~/features/invoices/still';
import { IconButton, MorphText } from '~/features/invoices/ui';
import { appHotkeys } from '~/lib/hotkeys';

// Content swaps inside the dock: the icon-swap values from transitions.dev
// (#09), a 2px cross-blur and a small scale, in quicker than the morph and
// out quicker still.
const dockSwap = {
  initial: { opacity: 0, scale: 0.96, filter: 'blur(2px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    filter: 'blur(2px)',
    transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

/** Dock content the editor owns: the preview status on the left, extra document actions on the right. */
export type DockParts = { status: ReactNode; actions: ReactNode };

const plugins = [
  createPluginRegistration(DocumentManagerPluginPackage),
  // The gap keeps a fitted page clear of the floating top bar and dock. On a
  // phone the bar sits above the stage, so the page can use the width. This
  // module only loads in the browser, so matchMedia is always there.
  createPluginRegistration(ViewportPluginPackage, {
    viewportGap: matchMedia('(max-width: 900px)').matches ? 20 : 72,
  }),
  // Invoices run a few pages, so keeping several rendered past the edges is
  // cheap, and a pinch out then shows real pages instead of empty space.
  createPluginRegistration(ScrollPluginPackage, {
    defaultPageGap: 24,
    defaultBufferSize: 4,
  }),
  createPluginRegistration(RenderPluginPackage),
  createPluginRegistration(InteractionManagerPluginPackage),
  // Same limits as the pinch and wheel gestures in canvas-gestures.ts.
  createPluginRegistration(ZoomPluginPackage, {
    defaultZoomLevel: ZoomMode.FitPage,
    minZoom: 0.25,
    maxZoom: 4,
  }),
  createPluginRegistration(PrintPluginPackage),
  createPluginRegistration(SearchPluginPackage),
];

declare global {
  // Baseline since 2025; TypeScript 5.9's libraries do not declare it yet.
  interface Uint8ArrayConstructor {
    fromBase64(base64: string): Uint8Array<ArrayBuffer>;
  }
}

// Decoded in native code, not a JS loop over the whole string, and without
// fetching a data: URL, which the invoices' content policy refuses.
async function decodePdfBytes(base64: string): Promise<ArrayBuffer> {
  return Uint8Array.fromBase64(base64).buffer;
}

// At most one readout update per `delay`, always ending on the latest value.
// A continuous gesture still shows progress every 200ms, and the animated
// readouts below never morph on every frame. (A plain debounce would hold the
// old value for the whole gesture and then jump.)
function useThrottledValue<T>(value: T, delay = 200): T {
  const [rendered, setRendered] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, last.current + delay - performance.now());
    const timer = setTimeout(() => {
      last.current = performance.now();
      setRendered(value);
    }, wait);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return rendered;
}

/**
 * The refresh still (see still.ts): the next document renders underneath it
 * and it fades once every visible page has its new image, so an edit reads
 * as the page quietly changing instead of going blank and redrawing.
 */
type Still = {
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  /** Image sources on screen when the still was taken. */
  before: Set<string>;
  scrollTop: number;
  scrollLeft: number;
  leaving: boolean;
  /** When the document now underneath was put in place; restarts on each swap. */
  swapped: number;
  waiting: boolean;
  /**
   * True once the document underneath shows the old zoom. Replaced on every
   * swap, because it has to ask about the newest document.
   */
  zoomHolds: () => boolean;
};

function takeStill(root: HTMLElement): Still | null {
  const viewport = root.querySelector<HTMLElement>('.iv-pdf-viewport');
  const painted = paintStill(root);
  if (!viewport || !painted) return null;
  return {
    ...painted,
    scrollTop: viewport.scrollTop,
    scrollLeft: viewport.scrollLeft,
    leaving: false,
    swapped: performance.now(),
    waiting: false,
    zoomHolds: () => true,
  };
}

/** Puts the new document at the old scroll offset, then fades the still out once its pages have drawn. */
function releaseStill(root: HTMLElement, still: Still, onGone: () => void) {
  // A still reused across quick edits keeps a single wait loop; the new swap
  // only restarts its clock.
  still.swapped = performance.now();
  if (still.waiting) return;
  still.waiting = true;
  // The restore runs in order, each step waiting on the one before: the new
  // viewport mounts and applies its default fit, then the old zoom goes back
  // on, then the old offset (which only means something at the old zoom),
  // then the pages draw at that zoom. Steady counts frames in a row with the
  // offset holding, because EmbedPDF moves a fresh document to its own
  // starting position a few frames after activation.
  let steady = 0;
  const fade = () => {
    still.leaving = true;
    fadeStill(still, onGone);
  };
  const step = () => {
    if (!still.canvas.isConnected) return;
    const viewport = root.querySelector<HTMLElement>('.iv-pdf-viewport');
    const zoomed = still.zoomHolds();
    if (!zoomed) steady = 0;
    // Wait for the new content to be large enough on both axes, or the
    // browser clamps the offset and the page lands short of where it was.
    const ready =
      zoomed &&
      !!viewport &&
      ((viewport.scrollHeight >= still.scrollTop + viewport.clientHeight &&
        viewport.scrollWidth >= still.scrollLeft + viewport.clientWidth) ||
        performance.now() - still.swapped > 600);
    if (viewport && ready) {
      const off =
        Math.abs(viewport.scrollTop - still.scrollTop) > 1 ||
        Math.abs(viewport.scrollLeft - still.scrollLeft) > 1;
      if (off) {
        viewport.scrollTop = still.scrollTop;
        viewport.scrollLeft = still.scrollLeft;
        steady = 0;
      } else steady += 1;
    }
    const sheets = viewport && steady >= 2 ? visibleSheets(viewport) : [];
    const drawn =
      sheets.length > 0 &&
      sheets.every((sheet) => {
        const image = sheet.querySelector('img');
        return (
          !!image?.complete &&
          image.naturalWidth > 0 &&
          !still.before.has(image.src)
        );
      });
    // A render that never lands must not leave a stale still on top forever.
    if (drawn || performance.now() - still.swapped > 2500) fade();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export default function PdfViewer({
  bytes,
  dock,
}: {
  bytes: string;
  dock: DockParts;
}) {
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
      <output className="iv-stage-message">
        {error || timedOut
          ? 'The PDF viewer could not start. Reload the page to try again.'
          : 'Preparing the document viewer…'}
      </output>
    );
  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {/* Handles print requests with a hidden iframe; without it the print
          task pends forever and the button silently does nothing. */}
      <PrintFrame />
      <Document bytes={bytes} dock={dock} />
    </EmbedPDF>
  );
}

function Document({ bytes, dock }: { bytes: string; dock: DockParts }) {
  const { provides: documents } = useDocumentManagerCapability();
  const { provides: zoom } = useZoomCapability();
  const { provides: viewport } = useViewportCapability();
  const { activeDocumentId } = useActiveDocument();
  const frame = useRef<HTMLDivElement>(null);
  const still = useRef<Still | null>(null);
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
    if (!documents || !zoom) return;
    const current = ++generation.current;
    let cancelled = false;
    const previous = documents.getActiveDocumentId();
    // Opening at the current scale means the first render is already the
    // right size; the exact zoom setting is carried over at swap time.
    const scale = previous
      ? zoom.forDocument(previous).getState().currentZoomLevel
      : undefined;
    async function replace() {
      if (!documents || !zoom) return;
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
        const root = frame.current;
        // Read at swap time, not render time: the owner may zoom while the
        // new document renders. A fit mode carries over as the mode, so the
        // new page keeps fitting when the window resizes.
        const carried =
          previous && previous === documents.getActiveDocumentId()
            ? zoom.forDocument(previous).getState()
            : null;
        if (previous && root) {
          // A still that is still waiting already shows the last complete
          // render, which is exactly what should stay up; keep it. One that
          // is fading sits over a finished render, so take a fresh one.
          if (still.current?.leaving) {
            still.current.canvas.remove();
            still.current = null;
          }
          still.current ??= takeStill(root);
        }
        documents.setActiveDocument(id);
        const held = still.current;
        if (held && carried) {
          const next = id;
          let asked = Number.NEGATIVE_INFINITY;
          held.zoomHolds = () => {
            // Before the viewport mounts, a request is lost to the default
            // fit that mounting applies.
            if (!viewport?.isViewportMounted(next)) return false;
            const state = zoom.forDocument(next).getState();
            const holds =
              typeof carried.zoomLevel === 'number'
                ? Math.abs(state.currentZoomLevel - carried.currentZoomLevel) <
                  0.001
                : state.zoomLevel === carried.zoomLevel;
            if (holds) return true;
            // Ask again every few frames in case the default fit lands after
            // the first request.
            if (performance.now() - asked > 120) {
              asked = performance.now();
              zoom.forDocument(next).requestZoom(carried.zoomLevel);
            }
            return false;
          };
        }
        if (held && root)
          releaseStill(root, held, () => {
            if (still.current === held) still.current = null;
          });
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
            previous
              ? 'The new preview could not load. The previous preview is still available.'
              : 'The preview could not load. Reload the page to try again.',
          );
      }
    }
    replace();
    return () => {
      cancelled = true;
    };
  }, [bytes, documents, zoom, viewport]);
  const problem =
    error ||
    (stalled && !activeDocumentId
      ? 'The preview is taking too long to open. Reload the page to try again.'
      : '');
  return (
    <div className="iv-pdf-viewer" ref={frame}>
      {activeDocumentId ? (
        <DocumentContent documentId={activeDocumentId}>
          {({ isLoaded }) =>
            isLoaded ? (
              <Pages
                documentId={activeDocumentId}
                dock={dock}
                problem={problem}
              />
            ) : (
              <output className="iv-stage-message">Loading document…</output>
            )
          }
        </DocumentContent>
      ) : (
        <output
          className="iv-stage-message"
          data-tone={problem ? 'error' : undefined}
        >
          {problem || 'Opening document…'}
        </output>
      )}
    </div>
  );
}

function Pages({
  documentId,
  dock,
  problem,
}: {
  documentId: string;
  dock: DockParts;
  problem: string;
}) {
  const { provides: zoom, state: zoomState } = useZoom(documentId);
  const { provides: scroll, state } = useScroll(documentId);
  const { provides: print } = usePrint(documentId);
  const { provides: search, state: searchState } = useSearch(documentId);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const page = useThrottledValue(state.currentPage);
  // While a gesture runs the real zoom has not changed yet; the readout
  // follows the gesture instead. Updates are capped at one per 80ms so a
  // pinch does not re-render the viewer on every frame.
  const [previewZoom, setPreviewZoom] = useState<number | null>(null);
  const previewSent = useRef(0);
  const zoomPercent = useThrottledValue(
    Math.round((previewZoom ?? zoomState.currentZoomLevel) * 100),
  );
  // Typing searches after a short pause; an empty query clears the marks.
  useEffect(() => {
    if (!searching || !search) return;
    if (!query.trim()) {
      search.stopSearch();
      return;
    }
    const timer = setTimeout(() => {
      search.startSearch();
      search
        .searchAllPages(query)
        .toPromise()
        .catch(() => setError('Search failed.'));
    }, 160);
    return () => clearTimeout(timer);
  }, [query, searching, search]);
  const searchButton = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  function openSearch() {
    setError('');
    setSearching(true);
  }
  function closeSearch() {
    setSearching(false);
    setQuery('');
    search?.stopSearch();
    // Focus returns to where search was opened from, not to the page body.
    requestAnimationFrame(() => searchButton.current?.focus());
  }
  // "No matches" gets the transitions.dev error shake (#12) when the owner
  // presses Enter on it, so the dead end is felt, not only read.
  function nudge() {
    const element = dockRef.current;
    if (!element) return;
    element.classList.remove('iv-shake');
    void element.offsetWidth;
    element.classList.add('iv-shake');
  }
  const settledQuery = query.trim() !== '' && !searchState.loading;
  const found = searchState.total;
  const noMatches = settledQuery && found === 0;
  // ⌘F / Ctrl+F finds in the document, not in the surrounding app chrome.
  useHotkey(appHotkeys['preview.find'], () => {
    setError('');
    setSearching(true);
    // Already open: select the query so typing replaces it.
    findRef.current?.select();
  });
  useHotkey(appHotkeys['preview.close'], closeSearch, {
    target: dockRef,
    enabled: searching,
  });
  // Bound to the field itself, so Enter steps through matches there and
  // nowhere else.
  useHotkey(
    appHotkeys['preview.next'],
    () => (noMatches ? nudge() : search?.nextResult()),
    { target: findRef, enabled: searching },
  );
  useHotkey(
    appHotkeys['preview.previous'],
    () => (noMatches ? nudge() : search?.previousResult()),
    { target: findRef, enabled: searching },
  );
  const message = problem || error;
  // Drag, flick, and pinch act on the page directly. A drag moves the page,
  // so the preview carries no text-selection layer: copying belongs to the
  // form fields, where the values live.
  const surface = useRef<HTMLDivElement>(null);
  // useZoom hands back a new scope object on every render, and the page
  // counter re-renders this component while a flick glides. Reading it
  // through a ref keeps the gestures attached once, so a re-render never
  // cuts a glide short.
  const zoomScope = useRef(zoom);
  zoomScope.current = zoom;
  const { provides: viewportCapability } = useViewportCapability();
  const gapSource = useRef(viewportCapability);
  gapSource.current = viewportCapability;
  const gestures = useRef<CanvasGestures | null>(null);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const attached = attachCanvasGestures(element, {
      level: () => zoomScope.current?.getState().currentZoomLevel ?? 1,
      gap: () => gapSource.current?.getViewportGap() ?? 0,
      // flushSync makes React commit EmbedPDF's resized pages before this
      // returns, so the gesture can drop its transform in the same frame.
      apply: (level) =>
        flushSync(() =>
          zoomScope.current?.requestZoom(
            level === 'fit-page' ? ZoomMode.FitPage : level,
          ),
        ),
      preview: (level) => {
        const now = performance.now();
        if (level !== null && now - previewSent.current < 80) return;
        previewSent.current = now;
        setPreviewZoom(level);
      },
    });
    gestures.current = attached;
    return () => {
      attached.detach();
      gestures.current = null;
    };
  }, []);
  return (
    <>
      <div className="iv-pdf-surface" ref={surface}>
        <Viewport documentId={documentId} className="iv-pdf-viewport">
          <Scroller
            documentId={documentId}
            renderPage={({ width, height, pageIndex }) => (
              <PagePointerProvider
                documentId={documentId}
                pageIndex={pageIndex}
                className="iv-page-sheet"
                data-page={pageIndex}
                style={{
                  width,
                  height,
                  position: 'relative',
                  background: '#fff',
                }}
              >
                <RenderLayer documentId={documentId} pageIndex={pageIndex} />
                <SearchLayer
                  documentId={documentId}
                  pageIndex={pageIndex}
                  highlightColor="rgb(250 204 21 / 0.35)"
                  activeHighlightColor="rgb(245 158 11 / 0.6)"
                />
              </PagePointerProvider>
            )}
          />
        </Viewport>
      </div>
      <div className="iv-dock-slot">
        {/* The dock morphs between its tools and search like one object: its
            width springs to the new content while the old content blurs out
            and the new blurs in, so the two never overlap as separate
            things. */}
        <motion.div
          ref={dockRef}
          layout
          className="iv-dock"
          role="toolbar"
          aria-label="Document"
          data-mode={searching ? 'search' : 'tools'}
          style={{ borderRadius: 23 }}
          transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }}
          onAnimationEnd={(event) =>
            event.currentTarget.classList.remove('iv-shake')
          }
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {searching ? (
              <motion.div
                key="search"
                layout="position"
                className="iv-dock-search"
                data-hotkey-scope
                {...dockSwap}
              >
                <Search size={15} className="iv-dock-search-icon" />
                <input
                  ref={findRef}
                  // biome-ignore lint/a11y/noAutofocus: opening search means typing next.
                  autoFocus
                  type="search"
                  aria-label="Find in document"
                  placeholder="Find in document"
                  value={query}
                  spellCheck={false}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <output
                  className="iv-dock-count"
                  data-empty={noMatches || undefined}
                  aria-live="polite"
                >
                  <MorphText>
                    {!query.trim()
                      ? ''
                      : searchState.loading && !found
                        ? 'Searching…'
                        : found
                          ? `${searchState.activeResultIndex + 1} of ${found}`
                          : 'No matches'}
                  </MorphText>
                </output>
                <span className="iv-dock-divider" />
                <IconButton
                  label="Previous match"
                  hotkey={appHotkeys['preview.previous']}
                  side="top"
                  disabled={!found}
                  onClick={() => search?.previousResult()}
                >
                  <ChevronUp size={16} />
                </IconButton>
                <IconButton
                  label="Next match"
                  hotkey={appHotkeys['preview.next']}
                  side="top"
                  disabled={!found}
                  onClick={() => search?.nextResult()}
                >
                  <ChevronDown size={16} />
                </IconButton>
                <IconButton
                  label="Close search"
                  hotkey={appHotkeys['preview.close']}
                  side="top"
                  onClick={closeSearch}
                >
                  <X size={15} />
                </IconButton>
              </motion.div>
            ) : (
              <motion.div
                key="tools"
                layout="position"
                className="iv-dock-tools"
                {...dockSwap}
              >
                <output className="iv-dock-status">
                  {message || dock.status}
                </output>
                <div className="iv-dock-group">
                  <IconButton
                    label="Previous page"
                    side="top"
                    disabled={state.currentPage <= 1}
                    onClick={() =>
                      scroll?.scrollToPage({
                        pageNumber: state.currentPage - 1,
                      })
                    }
                  >
                    <ChevronUp size={16} />
                  </IconButton>
                  <span className="iv-dock-readout">
                    <MorphText>{`${page} / ${state.totalPages}`}</MorphText>
                  </span>
                  <IconButton
                    label="Next page"
                    side="top"
                    disabled={state.currentPage >= state.totalPages}
                    onClick={() =>
                      scroll?.scrollToPage({
                        pageNumber: state.currentPage + 1,
                      })
                    }
                  >
                    <ChevronDown size={16} />
                  </IconButton>
                </div>
                <span className="iv-dock-divider iv-dock-divider-zoom" />
                <div className="iv-dock-group iv-dock-zoom">
                  <IconButton
                    label="Zoom out"
                    side="top"
                    onClick={() => gestures.current?.zoomBy(0.8)}
                  >
                    <Minus size={15} />
                  </IconButton>
                  <span className="iv-dock-readout">
                    <MorphText>{`${zoomPercent}%`}</MorphText>
                  </span>
                  <IconButton
                    label="Zoom in"
                    side="top"
                    onClick={() => gestures.current?.zoomBy(1.25)}
                  >
                    <Plus size={15} />
                  </IconButton>
                  <IconButton
                    label="Fit page"
                    side="top"
                    onClick={() => gestures.current?.fit()}
                  >
                    <Maximize size={14} />
                  </IconButton>
                </div>
                <span className="iv-dock-divider" />
                <div className="iv-dock-group">
                  <IconButton
                    ref={searchButton}
                    label="Find in document"
                    hotkey={appHotkeys['preview.find']}
                    side="top"
                    onClick={openSearch}
                  >
                    <Search size={15} />
                  </IconButton>
                  <IconButton
                    label="Print"
                    side="top"
                    onClick={() => {
                      if (!print) {
                        setError('Printing is unavailable. Download instead.');
                        return;
                      }
                      print
                        .print()
                        .toPromise()
                        .catch(() =>
                          setError('Printing failed. Download instead.'),
                        );
                    }}
                  >
                    <Printer size={15} />
                  </IconButton>
                  {dock.actions}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}
