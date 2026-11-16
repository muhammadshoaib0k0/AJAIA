import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../lib/api';
import { useSession } from '../../app/session';
import { DEMO_PASSWORD, PASSWORD_MAX, SEED_USERS } from '../../../shared/constants';
import { useToast } from '../../app/toast';
import { validateEmail, validateName, validatePassword } from '../../lib/validation';
import Field from '../../components/Field';

type Mode = 'login' | 'signup';
type Errors = Partial<Record<'name' | 'email' | 'password' | 'form', string>>;

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const { setUser } = useSession();
  const toast = useToast();

  function switchMode(m: Mode) { setMode(m); setErrors({}); }

  async function submit(e?: FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    const em = creds?.email ?? email, pw = creds?.password ?? password;
    const errs: Errors = {
      email: validateEmail(em) || undefined,
      password: (mode === 'signup' && !creds ? validatePassword(pw) : pw ? '' : 'Password is required.') || undefined,
      name: mode === 'signup' && !creds ? validateName(name) || undefined : undefined,
    };
    if (errs.email || errs.password || errs.name) { setErrors(errs); return; }
    setErrors({}); setBusy(true);
    try {
      setUser(mode === 'signup' && !creds ? await api.signup(name.trim(), em.trim(), pw) : await api.login(em.trim(), pw));
    } catch (err) {
      const a = err as ApiError;
      setErrors({ ...a.fields, form: a.fields ? undefined : a.message });
      if (!a.fields && a.status === 0) toast('error', a.message);
    } finally { setBusy(false); }
  }

  return (
    <main className="login">
      <h1>📄 Ajaia Docs</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Sign in</button>
        <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchMode('signup')}>Sign up</button>
      </div>

      <form className="card form" onSubmit={submit} noValidate>
        {errors.form && <div className="banner" role="alert">{errors.form}</div>}
        {mode === 'signup' && (
          <Field label="Name" error={errors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" aria-invalid={!!errors.name} />
          </Field>
        )}
        <Field label="Email" error={errors.email}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={PASSWORD_MAX}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} aria-invalid={!!errors.password} />
        </Field>
        <button className="btn primary" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      </form>

      <div className="card">
        <p className="muted small">Reviewing? Use a demo account (password <code>{DEMO_PASSWORD}</code>) — sign in as two of them in different browsers to try sharing.</p>
        <div className="demo-row">
          {SEED_USERS.map((u) => (
            <button key={u.id} className="btn" disabled={busy} onClick={() => { setMode('login'); setEmail(u.email); setPassword(DEMO_PASSWORD); submit(undefined, { email: u.email, password: DEMO_PASSWORD }); }}>
              {u.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <SourceCard />
    </main>
  );
}

const REPO_URL = 'https://github.com/muhammadshoaib0k0/AJAIA';

/** GitHub mark (inline SVG, inherits text colour). */
function GitHubMark() {
  return (
    <svg className="gh-mark" viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
const CLONE_CMD = `git clone ${REPO_URL}.git`;

/** Lets reviewers grab the source straight from the live app. */
function SourceCard() {
  const toast = useToast();
  async function copy() {
    try { await navigator.clipboard.writeText(CLONE_CMD); toast('ok', 'Clone command copied'); }
    catch { toast('error', 'Couldn’t copy. Select the command and copy it manually.'); }
  }
  return (
    <div className="card">
      <a className="repo-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <GitHubMark />
        <span>
          <strong>View source on GitHub</strong>
          <small className="muted">github.com/muhammadshoaib0k0/AJAIA</small>
        </span>
      </a>
      <div className="clone-row">
        <code className="clone-cmd">{CLONE_CMD}</code>
        <button type="button" className="btn" onClick={copy} aria-label="Copy clone command">Copy</button>
      </div>
    </div>
  );
}
