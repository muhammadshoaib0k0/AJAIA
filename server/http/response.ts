import { HttpError } from './errors';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Maps any thrown value to a response. Unknown errors are logged and hidden from the client. */
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message, ...(err.fields && { fields: err.fields }) }, err.status);
  console.error(err);
  return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
}

/** Streams a stored file as a forced download (never rendered inline). */
export function download(file: { data: Uint8Array; mime: string; size: number; name: string }): Response {
  const ascii = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return new Response(file.data as BodyInit, {
    headers: {
      'content-type': file.mime,
      'content-length': String(file.size),
      'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'x-content-type-options': 'nosniff', // a hostile upload can't be reinterpreted as HTML/JS
      'cache-control': 'private, no-store',
    },
  });
}
