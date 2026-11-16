import { json } from '../http/response';
import { readJson } from '../http/request';
import type { Router } from '../http/router';
import type { SharingService } from '../services/sharing.service';
import { parse, requestSchema, shareSchema } from '../validation/schemas';

export function registerSharingRoutes(router: Router, deps: { sharing: SharingService }) {
  const { sharing } = deps;

  router
    .post('/documents/:id/share', async ({ req, user, params }) => {
      const { email, role } = parse(shareSchema, await readJson(req));
      return json(await sharing.share(user, params.id, email, role));
    })
    .delete('/documents/:id/share/:userId', async ({ user, params }) =>
      json(await sharing.unshare(user, params.id, params.userId)))

    .post('/documents/:id/access-requests', async ({ req, user, params }) => {
      const { message } = parse(requestSchema, await readJson(req).catch(() => ({})));
      return json(await sharing.requestEdit(user, params.id, message));
    })
    .post('/documents/:id/access-requests/:userId/approve', async ({ user, params }) =>
      json(await sharing.approveRequest(user, params.id, params.userId)))
    .delete('/documents/:id/access-requests/:userId', async ({ user, params }) =>
      json(await sharing.denyRequest(user, params.id, params.userId)));
}
