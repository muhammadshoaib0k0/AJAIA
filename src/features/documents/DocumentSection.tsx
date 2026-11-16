import { Link } from 'react-router-dom';
import type { DocView } from '../../../shared/types';
import { fmtDateTime } from '../../lib/format';

interface Props { title: string; docs: DocView[]; empty: string; onDelete?: (d: DocView) => void }

/** One dashboard list ("My documents" / "Shared with me"); badges make ownership vs shared access explicit. */
export default function DocumentSection({ title, docs, empty, onDelete }: Props) {
  return (
    <section>
      <h2>{title} <span className="count">{docs.length}</span></h2>
      {docs.length === 0 ? <p className="empty">{empty}</p> : (
        <ul className="doclist">
          {docs.map((d) => (
            <li key={d.id}>
              <Link to={`/d/${d.id}`} className="doclink">
                <span className="doctitle">{d.title}</span>
                <span className="meta">
                  <AccessBadges doc={d} />
                  <span className="muted">Updated {fmtDateTime(d.updatedAt)}</span>
                </span>
              </Link>
              {onDelete && <button className="btn danger" onClick={() => onDelete(d)} aria-label={`Delete ${d.title}`}>Delete</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AccessBadges({ doc: d }: { doc: DocView }) {
  if (d.access !== 'owner') {
    return <span className="badge shared">Shared by {d.ownerName} · {d.access === 'editor' ? 'Can edit' : 'View only'}</span>;
  }
  const requests = d.accessRequests.length;
  return (
    <>
      <span className="badge owner">Owner{d.sharedWith.length ? ` · shared with ${d.sharedWith.length}` : ''}</span>
      {requests > 0 && <span className="badge request">{requests} edit request{requests > 1 ? 's' : ''}</span>}
    </>
  );
}
