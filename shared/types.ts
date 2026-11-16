export type Role = 'editor' | 'viewer';
export type AccessLevel = 'owner' | Role;

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Share {
  userId: string;
  role: Role;
  /** Populated only in the owner's view of a document. */
  name?: string;
  email?: string;
}

export interface AccessRequest {
  userId: string;
  createdAt: string;
  message?: string;
}

export interface AccessRequestView extends AccessRequest {
  name: string;
  email: string;
}

export interface DocRecord {
  id: string;
  title: string;
  contentHtml: string;
  ownerId: string;
  sharedWith: Share[];
  accessRequests: AccessRequest[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** What the API returns to a client for a given viewer. Collaborator details are owner-only. */
export interface DocView extends Omit<DocRecord, 'accessRequests'> {
  access: AccessLevel;
  ownerName: string;
  /** Owner only: pending edit-access requests with names. */
  accessRequests: AccessRequestView[];
  /** Viewer only: whether I already asked the owner for edit access. */
  hasRequested: boolean;
}

export interface AttachmentMeta {
  id: string;
  docId: string;
  name: string;
  size: number;
  mime: string;
  uploadedBy: string;
  createdAt: string;
}

export interface ImportResponse {
  html: string;
  title?: string;
  warnings: string[];
}
