/** Id formats. Checked before any DB lookup so malformed ids are rejected cheaply. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const USER_ID_RE = /^u_[A-Za-z0-9_-]{1,64}$/;

export const isUuid = (s: string) => UUID_RE.test(s);
export const isUserId = (s: string) => USER_ID_RE.test(s);
