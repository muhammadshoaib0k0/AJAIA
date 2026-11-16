import { MAX_UPLOAD_BYTES } from '../../shared/constants';
import { HttpError } from '../http/errors';
import { json } from '../http/response';
import { readJson, readUpload } from '../http/request';
import type { Router } from '../http/router';
import type { DocumentService, UploadedFile } from '../services/document.service';
import { createDocSchema, parse, patchDocSchema } from '../validation/schemas';

export async function readImportFile(req: Request): Promise<UploadedFile> {
  const file = await readUpload(req, MAX_UPLOAD_BYTES, 'File is too large (max 2 MB).');
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** An empty POST body is allowed ("new blank document"); any other bad body is still rejected. */
const optionalJson = (req: Request) =>
  readJson(req).catch((e) => (e instanceof HttpError && e.status === 415 ? {} : Promise.reject(e)));

export function registerDocumentRoutes(router: Router, deps: { documents: DocumentService }) {
  const { documents } = deps;

  router
    .get('/documents', async ({ user }) => json(await documents.list(user)))
    .post('/documents', async ({ req, user }) => {
      const { title } = parse(createDocSchema, await optionalJson(req));
      const { doc, created } = await documents.create(user, title);
      return json(doc, created ? 201 : 200);
    })
    // literal route registered before /documents/:id so "import" isn't treated as an id
    .post('/documents/import', async ({ req, user }) => json(await documents.importAsNew(user, await readImportFile(req)), 201))

    .get('/documents/:id', async ({ user, params }) => json(await documents.get(user, params.id)))
    .patch('/documents/:id', async ({ req, user, params }) => {
      // access check before parsing, so a viewer gets 403 rather than a validation error
      await documents.requireEditable(params.id, user.id);
      return json(await documents.update(user, params.id, parse(patchDocSchema, await readJson(req))));
    })
    .delete('/documents/:id', async ({ user, params }) => {
      await documents.remove(user, params.id);
      return json({ ok: true });
    })
    .post('/documents/:id/import', async ({ req, user, params }) => {
      await documents.requireEditable(params.id, user.id);
      return json(await documents.convertForDraft(user, params.id, await readImportFile(req)));
    });
}
