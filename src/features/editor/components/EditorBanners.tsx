import type { DocView } from '../../../../shared/types';

interface Props {
  doc: DocView;
  conflict: boolean;
  requesting: boolean;
  onRequestEdit: () => void;
  notice: string[];
  onDismissNotice: () => void;
}

/** Contextual banners above the editor: save conflict, view-only access, import warnings. */
export default function EditorBanners({ doc, conflict, requesting, onRequestEdit, notice, onDismissNotice }: Props) {
  return (
    <>
      {conflict && (
        <div className="banner" role="alert">
          This document was changed by someone else, so your latest edits weren’t saved.
          <button className="btn" onClick={() => window.location.reload()}>Reload latest</button>
        </div>
      )}
      {doc.access === 'viewer' && (
        <div className="banner info">
          <span>You have view-only access to this document.</span>
          {doc.hasRequested
            ? <button className="btn" disabled>Request sent ✓</button>
            : <button className="btn primary" disabled={requesting} onClick={onRequestEdit}>Request edit access</button>}
        </div>
      )}
      {notice.length > 0 && (
        <div className="banner warn" role="status">
          <span><strong>Import note:</strong> {notice.join(' ')}</span>
          <button className="btn" onClick={onDismissNotice}>Dismiss</button>
        </div>
      )}
    </>
  );
}
