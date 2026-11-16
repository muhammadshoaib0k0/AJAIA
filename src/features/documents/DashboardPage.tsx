import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_UPLOADS } from '../../../shared/constants';
import type { DocView } from '../../../shared/types';
import { useToast } from '../../app/toast';
import { api } from '../../lib/api';
import { validateImportFile } from '../../lib/validation';
import DocumentSection from './DocumentSection';
import { useDocumentList } from './useDocumentList';

export default function DashboardPage() {
  const { data, reload } = useDocumentList();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const toast = useToast();

  /** Create/import, then open the new document (passing any import warnings along). */
  async function openNew(fn: () => Promise<DocView & { warnings?: string[] }>) {
    setBusy(true);
    try {
      const d = await fn();
      nav(`/d/${d.id}`, { state: { warnings: d.warnings ?? [] } });
    } catch (e) { toast('error', (e as Error).message); } finally { setBusy(false); }
  }

  function onImportPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const err = validateImportFile(f);
    if (err) toast('error', err); else openNew(() => api.import(f));
  }

  async function remove(d: DocView) {
    if (!confirm(`Delete "${d.title}"? This cannot be undone${d.sharedWith.length ? ' and removes access for collaborators' : ''}.`)) return;
    try { await api.remove(d.id); toast('ok', 'Document deleted'); reload(); } catch (e) { toast('error', (e as Error).message); }
  }

  return (
    <main className="page">
      <div className="actions">
        <button className="btn primary" disabled={busy} onClick={() => openNew(() => api.create())}>＋ New document</button>
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>⬆ Import file</button>
        <small className="muted">Supported: {SUPPORTED_UPLOADS.join(' ')} · max 2 MB</small>
        <input ref={fileRef} type="file" hidden accept={SUPPORTED_UPLOADS.join(',')} onChange={onImportPicked} />
      </div>

      {!data ? <p className="muted">Loading documents…</p> : (
        <>
          <DocumentSection title="My documents" docs={data.owned} empty="You haven't created any documents yet." onDelete={remove} />
          <DocumentSection title="Shared with me" docs={data.shared} empty="Nothing has been shared with you yet." />
        </>
      )}
    </main>
  );
}
