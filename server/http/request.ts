import { HttpError } from './errors';

/** Body readers with size/content-type guards. Route handlers use these; services never see a Request. */
const MAX_BODY = 6_500_000; // Netlify's request cap is ~6 MB; reject early with a clear message.

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) throw new HttpError(413, 'Request is too large.');
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Content-Type must be application/json.');
  try { return await req.json(); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}

export async function readUpload(req: Request, maxBytes: number, tooBig: string): Promise<File> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes + 100_000) throw new HttpError(413, tooBig);
  if (!(req.headers.get('content-type') ?? '').includes('multipart/form-data')) throw new HttpError(415, 'Upload as multipart/form-data.');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'Attach a file in the "file" field.');
  if (file.size === 0) throw new HttpError(400, 'The file is empty.');
  if (file.size > maxBytes) throw new HttpError(413, tooBig);
  return file;
}
