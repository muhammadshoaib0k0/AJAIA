import { ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_BYTES } from '../../shared/constants';
import { HttpError } from '../http/errors';

const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  '.pdf': (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  '.png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  '.jpg': (b) => b[0] === 0xff && b[1] === 0xd8,
  '.jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  '.gif': (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  '.docx': (b) => b[0] === 0x50 && b[1] === 0x4b,
  '.xlsx': (b) => b[0] === 0x50 && b[1] === 0x4b,
  '.pptx': (b) => b[0] === 0x50 && b[1] === 0x4b,
};

export const MIME_BY_EXT: Record<string, string> = {
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.pdf': 'application/pdf',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function cleanFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>:|?*]/g, '').trim().slice(-150);
  return cleaned || 'file';
}

/** Extension allowlist + magic-byte check, so a renamed executable can't masquerade as a PDF. */
export function validateAttachment(name: string, bytes: Uint8Array): { name: string; mime: string } {
  const clean = cleanFilename(name);
  const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.')).toLowerCase() : '';
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new HttpError(415, `File type not allowed. Allowed: ${ATTACHMENT_EXTENSIONS.join(', ')}`);
  }
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new HttpError(413, 'Attachment is too large (max 5 MB).');
  const check = MAGIC[ext];
  if (check && !check(bytes)) throw new HttpError(422, `This file doesn't look like a valid ${ext} file.`);
  if (['.txt', '.md', '.csv'].includes(ext) && bytes.subarray(0, 4096).includes(0)) throw new HttpError(422, `This file doesn't look like a valid ${ext} text file.`);
  return { name: clean, mime: MIME_BY_EXT[ext] };
}
