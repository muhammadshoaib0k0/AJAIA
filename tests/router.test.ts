import { describe, expect, it } from 'vitest';
import { HttpError } from '../server/http/errors';
import { json } from '../server/http/response';
import { Router, normalizePath } from '../server/http/router';

const alice = { id: 'u_alice', email: 'alice@example.com', name: 'Alice' };
const req = (method: string, path: string) => new Request(`http://x/api${path}`, { method });
const status = (p: Promise<Response>) => p.then((r) => r.status, (e: HttpError) => e.status);

describe('Router', () => {
  const router = (signedIn: boolean) => new Router(async () => (signedIn ? alice : null))
    .public('POST', '/login', async () => json({ ok: true }))
    .post('/documents/import', async () => json({ route: 'import' }))
    .get('/documents/:id', async ({ params, user }) => json({ id: params.id, user: user.id }));

  it('extracts path params and passes the authenticated user', async () => {
    const res = await router(true).handle(req('GET', '/documents/abc'));
    expect(await res.json()).toEqual({ id: 'abc', user: 'u_alice' });
  });

  it('prefers literal routes registered before param routes', async () => {
    expect(await (await router(true).handle(req('POST', '/documents/import'))).json()).toEqual({ route: 'import' });
  });

  it('public routes skip auth; everything else needs a session before 404/405', async () => {
    expect(await status(router(false).handle(req('POST', '/login')))).toBe(200);
    expect(await status(router(false).handle(req('GET', '/documents/abc')))).toBe(401);
    expect(await status(router(false).handle(req('GET', '/nope')))).toBe(401); // no route probing
    expect(await status(router(true).handle(req('GET', '/nope')))).toBe(404);
    expect(await status(router(true).handle(req('DELETE', '/documents/abc')))).toBe(405);
  });

  it('normalizes the /api prefix and trailing slashes', () => {
    expect(normalizePath('/api/documents/')).toBe('/documents');
    expect(normalizePath('/api')).toBe('/');
  });
});
