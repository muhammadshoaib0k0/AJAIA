import { useEffect, useRef } from 'react';

/**
 * Runs `fn` every `ms` while the tab is visible, plus immediately on refocus.
 * Errors are the caller's concern (background polls should usually fail silently).
 */
export function usePolling(fn: () => void, ms: number, enabled = true) {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => { if (document.visibilityState === 'visible') latest.current(); };
    const t = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [ms, enabled]);
}
