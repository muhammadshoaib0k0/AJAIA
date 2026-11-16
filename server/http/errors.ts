/**
 * The one error type that crosses layers. Services throw it with a status + user-facing message;
 * the app boundary (app.ts) turns it into a JSON response. Anything else becomes a generic 500.
 */
export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) { super(message); }
}

export const badRequest = (msg: string, fields?: Record<string, string>) => new HttpError(400, msg, fields);
export const unauthorized = (msg = 'Please sign in.') => new HttpError(401, msg);
export const forbidden = (msg: string) => new HttpError(403, msg);
export const notFound = (msg = 'Not found.', fields?: Record<string, string>) => new HttpError(404, msg, fields);
export const conflict = (msg: string, fields?: Record<string, string>) => new HttpError(409, msg, fields);
