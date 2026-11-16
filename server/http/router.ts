import type { User } from '../../shared/types';
import { HttpError } from './errors';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Everything a route handler needs; handlers never parse URLs or cookies themselves. */
export interface RequestContext {
  req: Request;
  params: Record<string, string>;
  /** true when served over https (controls the cookie Secure flag). */
  secure: boolean;
}
export interface AuthedContext extends RequestContext { user: User }

type Handler<C> = (ctx: C) => Promise<Response>;

interface Route {
  method: Method;
  pattern: RegExp;
  keys: string[];
  public: boolean;
  handler: Handler<AuthedContext> | Handler<RequestContext>;
}

/** Resolves the signed-in user for a request, or null. Injected so the router stays auth-agnostic. */
export type Authenticator = (req: Request) => Promise<User | null>;

/**
 * Minimal declarative router: `router.get('/documents/:id', handler)`.
 * - Routes are authenticated by default; `router.public` opts out.
 * - Unknown path → 404; known path with the wrong method → 405 (both only after auth).
 */
export class Router {
  private routes: Route[] = [];

  constructor(private authenticate: Authenticator) {}

  get(path: string, h: Handler<AuthedContext>) { return this.add('GET', path, h, false); }
  post(path: string, h: Handler<AuthedContext>) { return this.add('POST', path, h, false); }
  patch(path: string, h: Handler<AuthedContext>) { return this.add('PATCH', path, h, false); }
  delete(path: string, h: Handler<AuthedContext>) { return this.add('DELETE', path, h, false); }

  /** Register an unauthenticated route (login, signup, logout). */
  public(method: Method, path: string, h: Handler<RequestContext>) { return this.add(method, path, h, true); }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    let pathMatched = false;
    let match: { route: Route; params: Record<string, string> } | null = null;

    for (const r of this.routes) {
      const m = r.pattern.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      match = { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      break;
    }

    const ctx: RequestContext = { req, params: match?.params ?? {}, secure: url.protocol === 'https:' };
    if (match?.route.public) return (match.route.handler as Handler<RequestContext>)(ctx);

    // Everything that isn't an explicit public route requires a session, *before* 404/405,
    // so anonymous callers can't probe which endpoints exist.
    const user = await this.authenticate(req);
    if (!user) throw new HttpError(401, 'Please sign in.');
    if (!match) throw pathMatched ? new HttpError(405, 'Method not allowed.') : new HttpError(404, 'Not found.');
    return (match.route.handler as Handler<AuthedContext>)({ ...ctx, user });
  }

  private add(method: Method, path: string, handler: Route['handler'], isPublic: boolean) {
    const keys: string[] = [];
    const source = path.replace(/:(\w+)/g, (_m, k: string) => { keys.push(k); return '([^/]+)'; });
    this.routes.push({ method, pattern: new RegExp(`^${source}$`), keys, public: isPublic, handler });
    return this;
  }
}

/** Strips the /api prefix and trailing slashes. (`/index.html`: a `netlify dev` proxy quirk.) */
export const normalizePath = (p: string) =>
  p.replace(/^\/api/, '').replace(/\/index\.html?$/, '').replace(/\/+$/, '') || '/';
