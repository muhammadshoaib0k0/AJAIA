import { useCallback, useEffect, useState } from 'react';
import type { DocView } from '../../../shared/types';
import { useToast } from '../../app/toast';
import { usePolling } from '../../hooks/usePolling';
import { api } from '../../lib/api';

export interface DocumentList { owned: DocView[]; shared: DocView[] }

/** Owned + shared documents, kept fresh by polling so newly shared docs appear without a reload. */
export function useDocumentList() {
  const [data, setData] = useState<DocumentList | null>(null);
  const toast = useToast();

  const reload = useCallback(() => api.list().then(setData).catch((e: Error) => toast('error', e.message)), [toast]);
  useEffect(() => { reload(); }, [reload]);
  usePolling(() => { api.list().then(setData).catch(() => { /* next tick retries */ }); }, 5000);

  return { data, reload };
}
