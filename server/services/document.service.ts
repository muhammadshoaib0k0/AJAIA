import { accessFor, canEdit, canRead, isOwner } from '../../shared/access';
import { BLANK_HTML, DEFAULT_TITLE } from '../../shared/constants';
import type { AccessLevel, DocRecord, DocView, ImportResponse, User } from '../../shared/types';
import { fileToHtml, titleFromFilename } from '../content/importer';
import type { ImageFetcher } from '../content/remoteImage';
import { sanitize } from '../content/sanitize';
import { forbidden, HttpError, notFound } from '../http/errors';
import type { Repo } from '../repositories/repository';
import { isUuid } from '../validation/ids';
import type { DocViewBuilder } from './documentView';

export interface UploadedFile { name: string; bytes: Uint8Array }
export interface DocPatch { version: number; title?: string; contentHtml?: string }

const VIEW_ONLY = 'You have view-only access to this document.';

const isUntouchedBlank = (d: DocRecord) =>
  d.title === DEFAULT_TITLE && d.contentHtml === BLANK_HTML && d.version === 1 && d.sharedWith.length === 0;

export function newDoc(ownerId: string, title: string, contentHtml: string): DocRecord {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title, contentHtml, ownerId, sharedWith: [], accessRequests: [], version: 1, createdAt: now, updatedAt: now };
}

export function createDocumentService(deps: { repo: Repo; toView: DocViewBuilder; fetchImage?: ImageFetcher }) {
  const { repo, toView, fetchImage } = deps;

  /**
   * The single access gate for every document-scoped operation.
   * Strangers and malformed ids get 404 (not 403) so document existence isn't leaked.
   */
  async function loadAccessible(id: string, userId: string): Promise<{ doc: DocRecord; access: AccessLevel }> {
    const doc = isUuid(id) ? await repo.getDoc(id) : null;
    const access = doc ? accessFor(doc, userId) : null;
    if (!doc || !canRead(access)) throw notFound('Document not found.');
    return { doc, access: access! };
  }

  async function requireEditable(id: string, userId: string) {
    const loaded = await loadAccessible(id, userId);
    if (!canEdit(loaded.access)) throw forbidden(VIEW_ONLY);
    return loaded;
  }

  return {
    loadAccessible,
    requireEditable,

    async list(me: User): Promise<{ owned: DocView[]; shared: DocView[] }> {
      const docs = await Promise.all((await repo.listDocsFor(me.id)).map((d) => toView(d, me)));
      return { owned: docs.filter((d) => d.access === 'owner'), shared: docs.filter((d) => d.access !== 'owner') };
    },

    async get(me: User, id: string): Promise<DocView> {
      return toView((await loadAccessible(id, me.id)).doc, me);
    },

    /** `created: false` when an untouched blank draft was reused instead of piling up empty docs. */
    async create(me: User, title?: string): Promise<{ doc: DocView; created: boolean }> {
      if (!title) {
        const blank = (await repo.listDocsFor(me.id)).find((d) => d.ownerId === me.id && isUntouchedBlank(d));
        if (blank) return { doc: await toView(blank, me), created: false };
      }
      const doc = newDoc(me.id, title ?? DEFAULT_TITLE, BLANK_HTML);
      await repo.createDoc(doc);
      return { doc: await toView(doc, me), created: true };
    },

    /** Upload → new document. Title comes from the file's first H1, else its filename. */
    async importAsNew(me: User, file: UploadedFile): Promise<DocView & { warnings: string[] }> {
      const imp = await fileToHtml(file.name, file.bytes, { fetchImage });
      const title = (imp.title?.trim() || titleFromFilename(file.name)).slice(0, 200);
      const doc = newDoc(me.id, title, imp.html);
      await repo.createDoc(doc);
      return { ...(await toView(doc, me)), warnings: imp.warnings };
    },

    /** Upload → HTML for an existing draft. The client inserts it (undoable) and autosave persists it. */
    async convertForDraft(me: User, id: string, file: UploadedFile): Promise<ImportResponse> {
      await requireEditable(id, me.id);
      return fileToHtml(file.name, file.bytes, { fetchImage });
    },

    /** Optimistic concurrency: the write only applies if `version` is still current. */
    async update(me: User, id: string, patch: DocPatch): Promise<DocView> {
      await requireEditable(id, me.id);
      const result = await repo.updateDoc(id, patch.version, {
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.contentHtml !== undefined && { contentHtml: sanitize(patch.contentHtml) }),
      });
      if (result === 'conflict') throw new HttpError(409, 'This document was changed by someone else. Reload to get the latest version.');
      if (!result) throw notFound('Document not found.');
      return toView(result, me);
    },

    async remove(me: User, id: string): Promise<void> {
      const { access } = await loadAccessible(id, me.id);
      if (!isOwner(access)) throw forbidden('Only the owner can delete a document.');
      await repo.deleteAttachmentsFor(id);
      await repo.deleteDoc(id);
    },
  };
}

export type DocumentService = ReturnType<typeof createDocumentService>;
