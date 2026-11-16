import { isOwner } from '../../shared/access';
import type { DocView, Role, User } from '../../shared/types';
import { badRequest, forbidden, notFound } from '../http/errors';
import type { Repo } from '../repositories/repository';
import { isUserId } from '../validation/ids';
import type { DocumentService } from './document.service';
import type { DocViewBuilder } from './documentView';

/**
 * Sharing model: one owner; collaborators are `editor` or `viewer`.
 * Viewers can ask for edit access; the owner approves (→ editor) or denies.
 */
export function createSharingService(deps: { repo: Repo; documents: DocumentService; toView: DocViewBuilder }) {
  const { repo, documents, toView } = deps;

  async function requireOwner(me: User, id: string, msg: string) {
    const loaded = await documents.loadAccessible(id, me.id);
    if (!isOwner(loaded.access)) throw forbidden(msg);
    return loaded;
  }
  const MANAGE = 'Only the owner can manage sharing.';
  const RESPOND = 'Only the owner can respond to access requests.';

  async function requirePendingRequest(me: User, id: string, userId: string) {
    const { doc } = await requireOwner(me, id, RESPOND);
    if (!isUserId(userId)) throw badRequest('Invalid user id.');
    if (!doc.accessRequests.some((r) => r.userId === userId)) throw notFound('No pending request from that user.');
  }

  return {
    async share(me: User, id: string, email: string, role: Role): Promise<DocView> {
      await requireOwner(me, id, MANAGE);
      const target = await repo.getUserByEmail(email);
      if (!target) throw notFound('No user with that email.', { email: 'No user with that email.' });
      if (target.id === me.id) throw badRequest('You already own this document.', { email: 'You already own this document.' });
      return toView((await repo.setShare(id, target.id, role))!, me);
    },

    async unshare(me: User, id: string, userId: string): Promise<DocView> {
      await requireOwner(me, id, MANAGE);
      if (!isUserId(userId)) throw badRequest('Invalid user id.');
      return toView((await repo.removeShare(id, userId))!, me);
    },

    /** Viewer asks the owner for edit access. Repeating without a new message keeps the original request. */
    async requestEdit(me: User, id: string, message?: string): Promise<DocView> {
      const { doc, access } = await documents.loadAccessible(id, me.id);
      if (access !== 'viewer') throw badRequest('You already have edit access.');
      if (!message && doc.accessRequests.some((r) => r.userId === me.id)) return toView(doc, me);
      return toView((await repo.addAccessRequest(id, me.id, message || undefined))!, me);
    },

    async approveRequest(me: User, id: string, userId: string): Promise<DocView> {
      await requirePendingRequest(me, id, userId);
      return toView((await repo.setShare(id, userId, 'editor'))!, me); // setShare also clears the request
    },

    async denyRequest(me: User, id: string, userId: string): Promise<DocView> {
      await requirePendingRequest(me, id, userId);
      return toView((await repo.removeAccessRequest(id, userId))!, me);
    },
  };
}

export type SharingService = ReturnType<typeof createSharingService>;
