import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_DOC_BYTES } from '../../../../shared/constants';
import type { DocView } from '../../../../shared/types';
import { useToast } from '../../../app/toast';
import { api, ApiError } from '../../../lib/api';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
type Field = 'title' | 'content';

interface Options {
  docId: string;
  initialVersion: number;
  getTitle: () => string;
  /** null while the editor isn't ready yet. */
  getHtml: () => string | null;
  onSaved: (saved: DocView) => void;
}

const DEBOUNCE_MS = 800;
const RETRY_MS = 3000;

/**
 * Debounced autosave with optimistic concurrency.
 * - Sends only the fields that changed, with the last known `version`.
 * - 409 → stops saving and reports 'conflict' (someone else saved first; no silent overwrite).
 * - 400/403/413 → reports 'error' (retrying can't help). Network/5xx → retries every 3 s.
 * - Edits made while a save is in flight are queued and sent right after.
 * - Flushes pending changes on unmount and warns on tab close.
 * State lives in refs so the debounced callback always sees fresh values.
 */
export function useAutosave(opts: Options) {
  const toast = useToast();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const version = useRef(opts.initialVersion);
  const dirty = useRef({ title: false, content: false });
  const inFlight = useRef(false);
  const conflict = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(opts);
  latest.current = opts;

  const hasUnsaved = () => dirty.current.title || dirty.current.content;

  const save = useCallback(async () => {
    if (inFlight.current || conflict.current) return;
    const d = dirty.current;
    if (!d.title && !d.content) { setStatus('saved'); return; }
    const { docId, getTitle, getHtml, onSaved } = latest.current;
    const html = d.content ? getHtml() : undefined;
    if (html === null) return; // editor not ready
    if (html && html.length > MAX_DOC_BYTES) {
      setStatus('error'); toast('error', 'This document is too large to save (max 5 MB). Remove some images.'); return;
    }
    const patch = { ...(d.title && { title: getTitle().trim() }), ...(html !== undefined && { contentHtml: html }) };
    const snapshot = { ...d };
    dirty.current = { title: false, content: false };
    inFlight.current = true;
    setStatus('saving');
    try {
      const saved = await api.update(docId, version.current, patch);
      version.current = saved.version;
      onSaved(saved);
    } catch (e) {
      const err = e as ApiError;
      inFlight.current = false;
      if (err.status === 409) { conflict.current = true; setStatus('conflict'); return; }
      if (err.status === 400 || err.status === 403 || err.status === 413) { setStatus('error'); toast('error', `Couldn’t save: ${err.message}`); return; }
      // transient: put the unsent fields back and retry
      dirty.current = { title: dirty.current.title || snapshot.title, content: dirty.current.content || snapshot.content };
      setStatus('error'); toast('error', `Couldn’t save: ${err.message} Retrying…`);
      timer.current = setTimeout(save, RETRY_MS);
      return;
    }
    inFlight.current = false;
    if (hasUnsaved()) save(); else setStatus('saved');
  }, [toast]);

  const markDirty = useCallback((field: Field) => {
    dirty.current[field] = true;
    if (conflict.current) return;
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, DEBOUNCE_MS);
  }, [save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (hasUnsaved() || inFlight.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timer.current);
      if (hasUnsaved()) save();
    };
  }, [save]);

  return {
    status,
    markDirty,
    /** True if nothing was ever saved or edited in this session (used to discard empty drafts). */
    isPristine: () => version.current === 1 && !hasUnsaved(),
    /** Adopt a newer server version (e.g. after content was reloaded). */
    resetVersion: (v: number) => { version.current = v; },
  };
}
