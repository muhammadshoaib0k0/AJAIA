import type { User } from './types';

export const DEFAULT_TITLE = 'Untitled document';
export const BLANK_HTML = '<p></p>';

/** Demo accounts for reviewers. Real users sign up; these exist so sharing can be tried instantly. */
export const SEED_USERS: User[] = [
  { id: 'u_alice', email: 'alice@example.com', name: 'Alice Johnson' },
  { id: 'u_bob', email: 'bob@example.com', name: 'Bob Martinez' },
  { id: 'u_carol', email: 'carol@example.com', name: 'Carol Singh' },
];
export const DEMO_PASSWORD = 'demo1234';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // import files
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_DOC = 10;
export const MAX_DOC_BYTES = 5_000_000;
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const SUPPORTED_UPLOADS = ['.txt', '.md', '.docx'] as const;
export const ATTACHMENT_EXTENSIONS = ['.txt', '.md', '.docx', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.csv', '.xlsx', '.pptx'] as const;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
