import type { AttachmentMeta, DocRecord, Role, User } from '../../shared/types';

export type UpdateResult = DocRecord | 'conflict' | null;
export interface StoredUser extends User { passwordHash: string }
export type StoredAttachment = AttachmentMeta & { data: Uint8Array };

/**
 * Storage port. Services depend only on this interface; adapters live next to it:
 *   - mongo.repo.ts   production (MongoDB Atlas)
 *   - memory.repo.ts  tests
 *   - file.repo.ts    zero-setup local dev (JSON file)
 * Swapping to Postgres etc. means adding one adapter, with no service/route changes.
 */
export interface Repo {
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  createUser(user: StoredUser): Promise<'ok' | 'duplicate'>;
  /** Used only to repair demo accounts created before passwords existed. */
  setPasswordHashIfMissing(id: string, passwordHash: string): Promise<void>;

  createDoc(doc: DocRecord): Promise<void>;
  getDoc(id: string): Promise<DocRecord | null>;
  listDocsFor(userId: string): Promise<DocRecord[]>;
  /** Atomic compare-and-set on `version`. null = not found, 'conflict' = stale version. */
  updateDoc(id: string, expectedVersion: number, patch: Partial<Pick<DocRecord, 'title' | 'contentHtml'>>): Promise<UpdateResult>;
  deleteDoc(id: string): Promise<boolean>;

  /** Sets (or changes) a share and clears any pending edit request from that user. */
  setShare(id: string, userId: string, role: Role): Promise<DocRecord | null>;
  /** Removes a share and any pending edit request from that user. */
  removeShare(id: string, userId: string): Promise<DocRecord | null>;
  addAccessRequest(id: string, userId: string, message?: string): Promise<DocRecord | null>;
  removeAccessRequest(id: string, userId: string): Promise<DocRecord | null>;

  addAttachment(meta: AttachmentMeta, data: Uint8Array): Promise<void>;
  listAttachments(docId: string): Promise<AttachmentMeta[]>;
  getAttachment(docId: string, id: string): Promise<StoredAttachment | null>;
  deleteAttachment(docId: string, id: string): Promise<boolean>;
  deleteAttachmentsFor(docId: string): Promise<void>;
}

/** Older stored documents predate some fields. */
export const normalizeDoc = (d: DocRecord): DocRecord => ({ ...d, accessRequests: d.accessRequests ?? [], sharedWith: d.sharedWith ?? [] });
