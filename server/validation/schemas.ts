import { z } from 'zod';
import { MAX_DOC_BYTES, PASSWORD_MAX, PASSWORD_MIN } from '../../shared/constants';
import { HttpError } from '../http/errors';

const noControl = (s: string) => !/[\u0000-\u001f\u007f]/.test(s);
const noMarkup = (s: string) => !/[<>]/.test(s);

export const emailField = z
  .string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'));

export const passwordField = z
  .string({ error: 'Password is required.' })
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Password is too long (max ${PASSWORD_MAX}).`)
  .refine((s) => s.trim().length > 0, 'Password cannot be only spaces.');

export const nameField = z
  .string({ error: 'Name is required.' })
  .trim()
  .min(1, 'Name is required.')
  .max(80, 'Name is too long (max 80).')
  .refine(noControl, 'Name contains invalid characters.')
  .refine(noMarkup, 'Name cannot contain < or >.');

export const titleField = z
  .string({ error: 'Title is required.' })
  .trim()
  .min(1, 'Title cannot be empty.')
  .max(200, 'Title is too long (max 200).')
  .refine(noControl, 'Title contains invalid characters.');

export const signupSchema = z.object({ name: nameField, email: emailField, password: passwordField });
export const loginSchema = z.object({
  email: z.string({ error: 'Email is required.' }).trim().toLowerCase().min(1, 'Email is required.').max(254),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(PASSWORD_MAX, 'Invalid email or password.'),
});
export const createDocSchema = z.object({ title: titleField.optional() });
export const patchDocSchema = z
  .object({
    version: z.number({ error: 'version is required.' }).int('version must be an integer.').nonnegative('version must be ≥ 0.'),
    title: titleField.optional(),
    contentHtml: z.string({ error: 'contentHtml must be a string.' }).max(MAX_DOC_BYTES, 'Document is too large (max 5 MB).').optional(),
  })
  .refine((v) => v.title !== undefined || v.contentHtml !== undefined, { message: 'Nothing to update.' });
export const shareSchema = z.object({
  email: emailField,
  role: z.enum(['editor', 'viewer'], { error: 'Role must be "editor" or "viewer".' }),
});
export const requestSchema = z.object({
  message: z.string().trim().max(300, 'Message is too long (max 300).').refine(noControl.bind(null), 'Message contains invalid characters.').optional(),
});


/** Validates with zod and throws a 400 carrying a per-field error map the UI can render inline. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
  throw new HttpError(400, r.error.issues[0].message, fields);
}
