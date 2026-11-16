import type { AttachmentMeta, DocRecord, Role } from '../../shared/types';
import { normalizeDoc, type Repo, type StoredAttachment, type StoredUser } from './repository';

/** In-memory adapter: used by tests and wrapped by the JSON-file dev store. */
export class MemoryRepo implements Repo {
  users = new Map<string, StoredUser>();
  docs = new Map<string, DocRecord>();
  atts = new Map<string, StoredAttachment>();

  async getUser(id: string) {
    const u = this.users.get(id);
    return u ? { id: u.id, email: u.email, name: u.name } : null;
  }
  async getUserByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }
  async createUser(user: StoredUser) {
    if ([...this.users.values()].some((u) => u.email === user.email || u.id === user.id)) return 'duplicate' as const;
    this.users.set(user.id, { ...user });
    return 'ok' as const;
  }

  async setPasswordHashIfMissing(id: string, passwordHash: string) {
    const u = this.users.get(id);
    if (u && !u.passwordHash) u.passwordHash = passwordHash;
  }

  async createDoc(doc: DocRecord) { this.docs.set(doc.id, structuredClone(doc)); }
  async getDoc(id: string) { const d = this.docs.get(id); return d ? normalizeDoc(structuredClone(d)) : null; }
  async listDocsFor(userId: string) {
    return [...this.docs.values()]
      .filter((d) => d.ownerId === userId || d.sharedWith.some((s) => s.userId === userId))
      .map((d) => normalizeDoc(structuredClone(d)));
  }
  async updateDoc(id: string, expectedVersion: number, patch: Partial<Pick<DocRecord, 'title' | 'contentHtml'>>) {
    const d = this.docs.get(id);
    if (!d) return null;
    if (d.version !== expectedVersion) return 'conflict' as const;
    Object.assign(d, patch, { version: d.version + 1, updatedAt: new Date().toISOString() });
    return normalizeDoc(structuredClone(d));
  }
  async deleteDoc(id: string) { return this.docs.delete(id); }

  async setShare(id: string, userId: string, role: Role) {
    const d = this.docs.get(id);
    if (!d) return null;
    d.sharedWith = d.sharedWith.filter((s) => s.userId !== userId).concat({ userId, role });
    d.accessRequests = (d.accessRequests ?? []).filter((r) => r.userId !== userId);
    return normalizeDoc(structuredClone(d));
  }
  async removeShare(id: string, userId: string) {
    const d = this.docs.get(id);
    if (!d) return null;
    d.sharedWith = d.sharedWith.filter((s) => s.userId !== userId);
    d.accessRequests = (d.accessRequests ?? []).filter((r) => r.userId !== userId);
    return normalizeDoc(structuredClone(d));
  }
  async addAccessRequest(id: string, userId: string, message?: string) {
    const d = this.docs.get(id);
    if (!d) return null;
    d.accessRequests = (d.accessRequests ?? []).filter((r) => r.userId !== userId)
      .concat({ userId, createdAt: new Date().toISOString(), ...(message && { message }) });
    return normalizeDoc(structuredClone(d));
  }
  async removeAccessRequest(id: string, userId: string) {
    const d = this.docs.get(id);
    if (!d) return null;
    d.accessRequests = (d.accessRequests ?? []).filter((r) => r.userId !== userId);
    return normalizeDoc(structuredClone(d));
  }

  async addAttachment(meta: AttachmentMeta, data: Uint8Array) { this.atts.set(meta.id, { ...meta, data: new Uint8Array(data) }); }
  async listAttachments(docId: string) {
    return [...this.atts.values()].filter((a) => a.docId === docId)
      .map(({ data: _d, ...m }) => m).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async getAttachment(docId: string, id: string) {
    const a = this.atts.get(id);
    return a && a.docId === docId ? a : null;
  }
  async deleteAttachment(docId: string, id: string) {
    const a = this.atts.get(id);
    return a && a.docId === docId ? this.atts.delete(id) : false;
  }
  async deleteAttachmentsFor(docId: string) {
    for (const [k, a] of this.atts) if (a.docId === docId) this.atts.delete(k);
  }
}
