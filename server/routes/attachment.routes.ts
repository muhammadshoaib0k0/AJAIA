import { MAX_ATTACHMENT_BYTES } from '../../shared/constants';
import { download, json } from '../http/response';
import { readUpload } from '../http/request';
import type { Router } from '../http/router';
import type { AttachmentService } from '../services/attachment.service';
import type { DocumentService } from '../services/document.service';

export function registerAttachmentRoutes(router: Router, deps: { attachments: AttachmentService; documents: DocumentService }) {
  const { attachments, documents } = deps;

  router
    .get('/documents/:id/attachments', async ({ user, params }) => json(await attachments.list(user, params.id)))
    .post('/documents/:id/attachments', async ({ req, user, params }) => {
      await documents.requireEditable(params.id, user.id); // before reading a 5 MB body
      const file = await readUpload(req, MAX_ATTACHMENT_BYTES, 'Attachment is too large (max 5 MB).');
      const meta = await attachments.add(user, params.id, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
      return json(meta, 201);
    })
    .get('/documents/:id/attachments/:attachmentId', async ({ user, params }) =>
      download(await attachments.get(user, params.id, params.attachmentId)))
    .delete('/documents/:id/attachments/:attachmentId', async ({ user, params }) => {
      await attachments.remove(user, params.id, params.attachmentId);
      return json({ ok: true });
    });
}
