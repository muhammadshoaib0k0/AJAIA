import type { DocView } from '../../../../shared/types';
import { usePolling } from '../../../hooks/usePolling';
import { api } from '../../../lib/api';

/**
 * While a viewer has a pending edit-access request, poll the document so the editor
 * unlocks as soon as the owner approves (or the viewer learns it was declined).
 */
export function useEditAccessWatcher(doc: DocView, handlers: { onApproved: (latest: DocView) => void; onDeclined: () => void }) {
  usePolling(async () => {
    try {
      const latest = await api.get(doc.id);
      if (latest.access === 'editor') handlers.onApproved(latest);
      else if (!latest.hasRequested) handlers.onDeclined();
    } catch { /* transient; next tick retries */ }
  }, 4000, doc.access === 'viewer' && doc.hasRequested);
}
