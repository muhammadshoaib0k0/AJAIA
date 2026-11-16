import type { ReactNode } from 'react';

/** Labeled form field with inline error (or hint) text. */
export default function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="err" role="alert">{error}</small> : hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}
