import { Invoice, type InvoiceData } from '@portfolio/invoices/model';
import { Schema } from 'effect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { previewInvoice } from './api';
import { useWorkspace } from './workspace';

export type DraftStatus = 'local' | 'saving' | 'saved' | 'failed' | 'conflict';
export type PreviewStatus = 'idle' | 'rendering' | 'current' | 'outdated';

// Grouping note: callers outside this task read the flat nine-field shape
// below, so the return stays flat. Read it as two groups:
// draft: saved, status, conflict, flush, acceptServer, recovery, clearRecovery;
// preview: bytes, previewStatus.
export function useDraft(original: Invoice, data: InvoiceData) {
  const { mutate } = useWorkspace();
  const [saved, setSaved] = useState(original);
  const [status, setStatus] = useState<DraftStatus>('saved');
  const [conflict, setConflict] = useState<Invoice | null>(null);
  const [bytes, setBytes] = useState('');
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [recovery, setRecovery] = useState<InvoiceData | null>(null);
  const pendingData = useRef(data);
  const lastAcked = useRef(original);
  const hasConflict = useRef(false);
  const saveInFlight = useRef<Promise<Invoice | null> | null>(null);
  const dirty = useRef(false);
  const storageKey = `invoice-draft:${original.id}`;

  // All ref writes live in effects; nothing assigns refs during render.
  useEffect(() => {
    if (pendingData.current !== data) {
      pendingData.current = data;
      dirty.current = true;
    }
  }, [data]);

  // Adopt server state only when it moves forward by revision. The guard runs
  // one way so acceptServer() never gets clobbered by a stale prop.
  useEffect(() => {
    if (
      original.id !== lastAcked.current.id ||
      original.revision > lastAcked.current.revision
    ) {
      lastAcked.current = original;
      setSaved(original);
    }
  }, [original]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && original.status === 'draft') {
        const draft = Schema.decodeUnknownSync(Invoice)(JSON.parse(stored));
        // A stored copy from this revision means an unsaved edit survived a
        // reload; the copy is deleted on every successful save.
        if (draft.id === original.id && draft.revision === original.revision)
          setRecovery(draft.data);
      }
    } catch (_error: unknown) {
      // [draft:recovery] invalid device data never replaces a server document.
    }
  }, [original.id, original.status, storageKey]);

  const flush = useCallback(async (): Promise<Invoice | null> => {
    const inFlight = saveInFlight.current;
    if (inFlight) {
      // Await the in-flight save instead of returning null: issue() and
      // download() need the saved revision, not a 'save first' abort.
      const settled = await inFlight;
      if (!dirty.current) return settled;
    }
    if (hasConflict.current) return null;
    if (lastAcked.current.status === 'issued') return lastAcked.current;
    if (!dirty.current) return lastAcked.current;
    const snapshot = pendingData.current;
    const candidate = { ...lastAcked.current, data: snapshot };
    if (!Schema.is(Invoice)(candidate)) {
      setStatus('local');
      return null;
    }
    dirty.current = false;
    let active: Promise<Invoice | null> | null = null;
    const promise = (async () => {
      setStatus('saving');
      try {
        const result = await mutate({ action: 'save', invoice: candidate });
        if (!result.ok) {
          dirty.current = true;
          if (result.current) {
            hasConflict.current = true;
            setConflict(result.current);
            setStatus('conflict');
          } else {
            setStatus('failed');
          }
          return null;
        }
        const next = result.workspace.invoices.find(
          (invoice) => invoice.id === candidate.id,
        );
        if (!next) throw new Error('Saved invoice is missing.');
        lastAcked.current = next;
        setSaved(next);
        setStatus('saved');
        if (pendingData.current === snapshot) {
          try {
            localStorage.removeItem(storageKey);
          } catch (_error: unknown) {
            // [draft:cleanup] a stale device copy is harmless; the server has the draft.
          }
        } else {
          dirty.current = true;
        }
        return next;
      } catch (_error: unknown) {
        // [draft:save] offline or server error; the draft stays on this device.
        dirty.current = true;
        setStatus('failed');
        return null;
      } finally {
        if (saveInFlight.current === active) saveInFlight.current = null;
      }
    })();
    active = promise;
    saveInFlight.current = promise;
    const done = await promise;
    // Edits that landed mid-save set dirty again; chain one follow-up save.
    if (
      dirty.current &&
      !hasConflict.current &&
      pendingData.current !== snapshot
    )
      return flush();
    return done;
  }, [mutate, storageKey]);

  useEffect(() => {
    if (original.status !== 'draft' || recovery || hasConflict.current) return;
    if (!dirty.current) return;
    setStatus('local');
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...lastAcked.current, data }),
      );
    } catch (_error: unknown) {
      // [draft:persist] device recovery is unavailable; the draft stays in memory.
    }
    const timer = setTimeout(() => {
      flush();
    }, 65);
    return () => clearTimeout(timer);
  }, [data, original.status, recovery, flush, storageKey]);

  useEffect(() => {
    // Subscription, not derived state: the handler reads refs at event time.
    const warn = (event: BeforeUnloadEvent) => {
      if (lastAcked.current.status === 'draft' && dirty.current)
        event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    let superseded = false;
    const candidate = { ...saved, data };
    if (!Schema.is(Invoice)(candidate)) {
      setPreviewStatus('idle');
      return;
    }
    // Keep the last valid bytes on screen but label them: a fresh render that
    // starts from a current preview marks it outdated until it lands.
    setPreviewStatus((previous) =>
      previous === 'current' ? 'outdated' : 'rendering',
    );
    const timer = setTimeout(
      () => {
        (async () => {
          try {
            const next = await previewInvoice({ data: candidate });
            if (!superseded) {
              setBytes(next);
              setPreviewStatus('current');
            }
          } catch (_error: unknown) {
            // [draft:preview] the draft is safe; the next edit re-renders.
            if (!superseded) setPreviewStatus('outdated');
          }
        })();
      },
      bytes ? 450 : 0,
    );
    return () => {
      superseded = true;
      clearTimeout(timer);
    };
  }, [data, saved]);

  const acceptServer = useCallback(() => {
    if (!conflict) return null;
    lastAcked.current = conflict;
    setSaved(conflict);
    setConflict(null);
    hasConflict.current = false;
    try {
      localStorage.removeItem(storageKey);
    } catch (_error: unknown) {
      // [draft:cleanup] a stale device copy is harmless once the server wins.
    }
    setStatus('saved');
    return conflict.data;
  }, [conflict, storageKey]);

  const clearRecovery = useCallback(() => {
    setRecovery(null);
  }, []);

  return {
    saved,
    status,
    conflict,
    bytes,
    previewStatus,
    flush,
    acceptServer,
    recovery,
    clearRecovery,
  };
}
