import { clearCookie, sessionCookie, signSession } from '../auth/session';
import { json } from '../http/response';
import { readJson } from '../http/request';
import type { Router } from '../http/router';
import type { AuthService } from '../services/auth.service';
import { loginSchema, parse, signupSchema } from '../validation/schemas';

export function registerAuthRoutes(router: Router, deps: { auth: AuthService; secret: string }) {
  const { auth, secret } = deps;
  const withSession = async (user: { id: string }, secure: boolean) =>
    ({ 'set-cookie': sessionCookie(await signSession(user.id, secret), secure) });

  router
    .public('POST', '/login', async ({ req, secure }) => {
      const { email, password } = parse(loginSchema, await readJson(req));
      const user = await auth.login(email, password);
      return json(user, 200, await withSession(user, secure));
    })
    .public('POST', '/signup', async ({ req, secure }) => {
      const user = await auth.signup(parse(signupSchema, await readJson(req)));
      return json(user, 201, await withSession(user, secure));
    })
    .public('POST', '/logout', async ({ secure }) => json({ ok: true }, 200, { 'set-cookie': clearCookie(secure) }))
    .get('/me', async ({ user }) => json(user));
}
