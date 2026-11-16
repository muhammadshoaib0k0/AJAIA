import { userIdFromRequest } from './auth/session';
import type { ImageFetcher } from './content/remoteImage';
import { errorResponse } from './http/response';
import { Router } from './http/router';
import type { Repo } from './repositories/repository';
import { registerAttachmentRoutes } from './routes/attachment.routes';
import { registerAuthRoutes } from './routes/auth.routes';
import { registerDocumentRoutes } from './routes/document.routes';
import { registerSharingRoutes } from './routes/sharing.routes';
import { createAttachmentService } from './services/attachment.service';
import { createAuthService } from './services/auth.service';
import { createDocumentService } from './services/document.service';
import { createDocViewBuilder } from './services/documentView';
import { createSharingService } from './services/sharing.service';

export interface AppDeps {
  repo: Repo;
  secret: string;
  fetchImage?: ImageFetcher; // injectable so tests never touch the network
}

export type App = (req: Request) => Promise<Response>;

/**
 * Composition root: wires repository → services → routes and returns a plain
 * `(Request) => Response` function. Nothing here is Netlify-specific, so the same app
 * runs under Netlify Functions, in tests, or behind any Fetch-API server (Bun, Deno, Hono, etc.).
 */
export function createApp({ repo, secret, fetchImage }: AppDeps): App {
  // services
  const toView = createDocViewBuilder(repo);
  const auth = createAuthService(repo);
  const documents = createDocumentService({ repo, toView, fetchImage });
  const sharing = createSharingService({ repo, documents, toView });
  const attachments = createAttachmentService({ repo, documents });

  // routes
  const router = new Router(async (req) => {
    const id = await userIdFromRequest(req, secret);
    return id ? auth.getUser(id) : null;
  });
  registerAuthRoutes(router, { auth, secret });
  registerDocumentRoutes(router, { documents });
  registerSharingRoutes(router, { sharing });
  registerAttachmentRoutes(router, { attachments, documents });

  return async (req) => {
    try {
      await auth.ensureDemoUsers();
      return await router.handle(req);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
