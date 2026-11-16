import { accessFor } from '../../shared/access';
import type { AccessRequestView, DocRecord, DocView, Share, User } from '../../shared/types';
import type { Repo } from '../repositories/repository';

/**
 * Projects a stored document into what a specific user is allowed to see.
 * Collaborator names/emails and pending requests are owner-only; everyone else gets them empty.
 */
export function createDocViewBuilder(repo: Repo) {
  const nameOf = async (userId: string) => repo.getUser(userId);

  return async function toView(doc: DocRecord, me: User): Promise<DocView> {
    const access = accessFor(doc, me.id)!;
    const owner = await nameOf(doc.ownerId);
    let sharedWith: Share[] = [];
    let accessRequests: AccessRequestView[] = [];
    if (access === 'owner') {
      sharedWith = await Promise.all(doc.sharedWith.map(async (s) => {
        const u = await nameOf(s.userId);
        return { ...s, name: u?.name ?? 'Unknown user', email: u?.email };
      }));
      accessRequests = await Promise.all(doc.accessRequests.map(async (r) => {
        const u = await nameOf(r.userId);
        return { ...r, name: u?.name ?? 'Unknown user', email: u?.email ?? '' };
      }));
    }
    return {
      ...doc, sharedWith, accessRequests, access,
      ownerName: owner?.name ?? 'Unknown',
      hasRequested: access === 'viewer' && doc.accessRequests.some((r) => r.userId === me.id),
    };
  };
}

export type DocViewBuilder = ReturnType<typeof createDocViewBuilder>;
