import { MAX_ATTACHMENTS_PER_DOC } from '../../shared/constants';
import type { AttachmentMeta, User } from '../../shared/types';
import { conflict, notFound } from '../http/errors';
import type { Repo, StoredAttachment } from '../repositories/repository';
import { validateAttachment } from '../validation/attachment';
import { isUuid } from '../validation/ids';
import type { DocumentService, UploadedFile } from './document.service';

/** Files attached to a document. Readers can list/download; editors can add/remove. */
export function createAttachmentService(deps: { repo: Repo; documents: DocumentService }) {
  const { repo, documents } = deps;

  return {
    async list(me: User, docId: string): Promise<AttachmentMeta[]> {
      await documents.loadAccessible(docId, me.id);
      return repo.listAttachments(docId);
    },

    async add(me: User, docId: string, file: UploadedFile): Promise<AttachmentMeta> {
      await documents.requireEditable(docId, me.id);
      const { name, mime } = validateAttachment(file.name, file.bytes);
      if ((await repo.listAttachments(docId)).length >= MAX_ATTACHMENTS_PER_DOC) {
        throw conflict(`A document can have at most ${MAX_ATTACHMENTS_PER_DOC} attachments.`);
      }
      const meta: AttachmentMeta = {
        id: crypto.randomUUID(), docId, name, size: file.bytes.byteLength, mime, uploadedBy: me.id, createdAt: new Date().toISOString(),
      };
      await repo.addAttachment(meta, file.bytes);
      return meta;
    },

    async get(me: User, docId: string, attachmentId: string): Promise<StoredAttachment> {
      await documents.loadAccessible(docId, me.id);
      const a = isUuid(attachmentId) ? await repo.getAttachment(docId, attachmentId) : null;
      if (!a) throw notFound('Attachment not found.');
      return a;
    },

    async remove(me: User, docId: string, attachmentId: string): Promise<void> {
      await documents.requireEditable(docId, me.id);
      if (!isUuid(attachmentId) || !(await repo.deleteAttachment(docId, attachmentId))) throw notFound('Attachment not found.');
    },
  };
}

export type AttachmentService = ReturnType<typeof createAttachmentService>;
