import { describe, expect, it } from 'vitest';
import type { User } from '../shared/types';
import { MemoryRepo } from '../server/repositories/memory.repo';
import { createDocumentService } from '../server/services/document.service';
import { createDocViewBuilder } from '../server/services/documentView';
import { createSharingService } from '../server/services/sharing.service';

/** Business rules exercised directly against services, with no HTTP layer involved. */
function setup() {
  const repo = new MemoryRepo();
  const users: User[] = [
    { id: 'u_owner', email: 'owner@x.com', name: 'Owner' },
    { id: 'u_viewer', email: 'viewer@x.com', name: 'Viewer' },
    { id: 'u_stranger', email: 'stranger@x.com', name: 'Stranger' },
  ];
  for (const u of users) repo.users.set(u.id, { ...u, passwordHash: 'x' });
  const toView = createDocViewBuilder(repo);
  const documents = createDocumentService({ repo, toView });
  const sharing = createSharingService({ repo, documents, toView });
  const [owner, viewer, stranger] = users;
  return { documents, sharing, owner, viewer, stranger };
}

describe('sharing rules (service layer)', () => {
  it('viewer → request edit → owner approves → viewer becomes editor and can save', async () => {
    const { documents, sharing, owner, viewer } = setup();
    const { doc } = await documents.create(owner, 'Plan');
    await sharing.share(owner, doc.id, viewer.email, 'viewer');

    await expect(documents.update(viewer, doc.id, { version: 1, title: 'Hijack' })).rejects.toMatchObject({ status: 403 });
    expect((await sharing.requestEdit(viewer, doc.id, 'pls')).hasRequested).toBe(true);
    const ownerView = await documents.get(owner, doc.id);
    expect(ownerView.accessRequests.map((r) => r.userId)).toEqual([viewer.id]);

    await sharing.approveRequest(owner, doc.id, viewer.id);
    const updated = await documents.update(viewer, doc.id, { version: 1, title: 'Plan v2' });
    expect(updated).toMatchObject({ access: 'editor', title: 'Plan v2', version: 2 });
    expect((await documents.get(owner, doc.id)).accessRequests).toEqual([]);
  });

  it('strangers get 404 (not 403) and collaborator details stay owner-only', async () => {
    const { documents, sharing, owner, viewer, stranger } = setup();
    const { doc } = await documents.create(owner, 'Secret');
    await sharing.share(owner, doc.id, viewer.email, 'viewer');

    await expect(documents.get(stranger, doc.id)).rejects.toMatchObject({ status: 404 });
    expect((await documents.get(viewer, doc.id)).sharedWith).toEqual([]);
    expect((await documents.get(owner, doc.id)).sharedWith[0]).toMatchObject({ email: viewer.email, role: 'viewer' });
  });

  it('only the owner can manage sharing or delete', async () => {
    const { documents, sharing, owner, viewer, stranger } = setup();
    const { doc } = await documents.create(owner, 'Doc');
    await sharing.share(owner, doc.id, viewer.email, 'editor');
    await expect(sharing.share(viewer, doc.id, stranger.email, 'editor')).rejects.toMatchObject({ status: 403 });
    await expect(documents.remove(viewer, doc.id)).rejects.toMatchObject({ status: 403 });
  });
});
