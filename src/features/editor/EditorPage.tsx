import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { canEdit } from '../../../shared/access';
import { DEFAULT_TITLE } from '../../../shared/constants';
import { buildExtensions } from '../../../shared/extensions';
import type { DocView } from '../../../shared/types';
import { useToast } from '../../app/toast';
import { api, ApiError } from '../../lib/api';
import AttachmentsPanel from '../attachments/AttachmentsPanel';
import ShareDialog from '../sharing/ShareDialog';
import EditorBanners from './components/EditorBanners';
import ExportMenu from './components/ExportMenu';
import Toolbar from './components/Toolbar';
import { useAutosave, type SaveStatus } from './hooks/useAutosave';
import { useEditAccessWatcher } from './hooks/useEditAccessWatcher';

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Save failed', conflict: 'Not saved',
};

/** Route component: loads the document, then hands off to the editor body. */
export default function EditorPage() {
  const { id = '' } = useParams();
  const [doc, setDoc] = useState<DocView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null); setError(null);
    api.get(id).then(setDoc).catch((e: ApiError) => setError(e.status === 404 ? 'This document doesn’t exist, or you don’t have access to it.' : e.message));
  }, [id]);

  if (error) return <main className="page"><p className="empty">{error}</p><Link to="/" className="btn">← Back to documents</Link></main>;
  if (!doc) return <main className="page muted">Loading…</main>;
  return <EditorBody key={doc.id} initial={doc} />;
}

function EditorBody({ initial }: { initial: DocView }) {
  const toast = useToast();
  const nav = useNavigate();
  const location = useLocation();
  const [doc, setDoc] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [sharing, setSharing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState<string[]>((location.state as { warnings?: string[] } | null)?.warnings ?? []);
  const editable = canEdit(doc.access);

  // getHtml/getTitle are read lazily at save time, so they always see the live editor and title.
  const autosave = useAutosave({
    docId: initial.id,
    initialVersion: initial.version,
    getTitle: () => title,
    getHtml: () => editor?.getHTML() ?? null,
    onSaved: (saved) => setDoc((prev) => ({ ...prev, version: saved.version, updatedAt: saved.updatedAt, title: saved.title })),
  });

  const editor = useEditor({
    extensions: buildExtensions(),
    content: initial.contentHtml,
    editable,
    editorProps: { attributes: { class: 'prose', 'aria-label': 'Document body' } },
    onUpdate: () => autosave.markDirty('content'),
  });
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  useEditAccessWatcher(doc, {
    onApproved: (latest) => {
      autosave.resetVersion(latest.version);
      editor?.commands.setContent(latest.contentHtml, { emitUpdate: false });
      setDoc(latest); setTitle(latest.title);
      toast('ok', 'You now have edit access.');
    },
    onDeclined: () => {
      setDoc((p) => ({ ...p, hasRequested: false }));
      toast('error', 'Your edit-access request was declined.');
    },
  });

  async function requestEdit() {
    setRequesting(true);
    try {
      const msg = window.prompt('Optional message to the owner:', '');
      if (msg === null) return;
      const d = await api.requestEdit(initial.id, msg.trim() || undefined);
      setDoc((p) => ({ ...p, hasRequested: d.hasRequested }));
      toast('ok', `Request sent to ${doc.ownerName}`);
    } catch (e) { toast('error', (e as Error).message); } finally { setRequesting(false); }
  }

  async function importFile(file: File) {
    if (!editor) return;
    setImporting(true);
    try {
      const r = await api.importInto(initial.id, file);
      editor.chain().focus().insertContent(r.html).run(); // undoable; autosave persists it
      setNotice(r.warnings);
      toast('ok', `Imported ${file.name}`);
    } catch (e) { toast('error', (e as Error).message); } finally { setImporting(false); }
  }

  async function goBack() {
    // Leaving a never-edited blank draft deletes it, so "New document" doesn't leave junk behind.
    const blank = doc.access === 'owner' && doc.version === 1 && autosave.isPristine()
      && doc.title === DEFAULT_TITLE && (editor?.isEmpty ?? false) && doc.sharedWith.length === 0;
    if (blank) await api.remove(doc.id).catch(() => {});
    nav('/');
  }

  return (
    <div className="editor-wrap">
      <div className="editor-head">
        <button className="btn" aria-label="Back to documents" onClick={goBack}>←</button>
        <input className="title" value={title} readOnly={!editable} maxLength={200} aria-label="Document title"
          onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) autosave.markDirty('title'); }}
          onBlur={() => { if (!title.trim()) setTitle(doc.title); }} />
        <span className={`status ${autosave.status}`} aria-live="polite">{editable ? STATUS_LABEL[autosave.status] : ''}</span>
        <ExportMenu editor={editor} title={title.trim() || doc.title} />
        {doc.access === 'owner'
          ? <button className="btn primary" onClick={() => setSharing(true)}>
              Share{doc.sharedWith.length ? ` (${doc.sharedWith.length})` : ''}
              {doc.accessRequests.length > 0 && <span className="dot" title={`${doc.accessRequests.length} pending request(s)`} />}
            </button>
          : <span className="badge shared">Shared by {doc.ownerName} · {editable ? 'Can edit' : 'View only'}</span>}
      </div>

      <EditorBanners doc={doc} conflict={autosave.status === 'conflict'} requesting={requesting} onRequestEdit={requestEdit}
        notice={notice} onDismissNotice={() => setNotice([])} />

      {editable && editor && <Toolbar editor={editor} onImportFile={importFile} importing={importing} />}
      <div className="paper"><EditorContent editor={editor} /></div>

      <AttachmentsPanel docId={initial.id} canEdit={editable} />

      {sharing && <ShareDialog doc={doc} onClose={() => setSharing(false)}
        onChange={(d) => setDoc((p) => ({ ...p, sharedWith: d.sharedWith, accessRequests: d.accessRequests }))} />}
    </div>
  );
}
