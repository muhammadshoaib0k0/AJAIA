# Architecture note

## What I prioritized, and why

The brief asks for a coherent product slice, not Google Docs. I ranked the work by what a reviewer would actually hit in a five-minute test, and by what would be embarrassing if it broke:

1. **The editing loop has to be trustworthy.** Typing, formatting, refreshing and finding everything intact is the core of the product. So: a real rich-text editor (TipTap/ProseMirror), debounced **autosave** with a visible status, and **optimistic concurrency** (every save carries a `version`). A stale tab gets a clear conflict banner instead of silently overwriting someone else's work.
2. **Sharing has to be correct, not just present.** Access control is the part that is easy to fake and costly to get wrong. Every document-scoped request goes through one access gate on the server. Strangers get `404` (not `403`) so document IDs don't leak. Collaborator details are visible only to the owner.
3. **Upload should be product-relevant.** Uploads turn into editable documents (`.txt/.md/.docx`), can be imported into an open draft, or are attached as files. Unsupported content degrades with an explicit "Import note" rather than silently.
4. **It has to actually run for reviewers.** It is deployed on free tiers (Netlify + MongoDB Atlas), local dev needs zero setup, and demo accounts have one-click login.

**Deliberately cut:** real-time co-editing (CRDT/OT), comments, version history, notifications, password reset, folders and search. Real-time collaboration is the biggest gap. I chose conflict *detection* over a half-working real-time sync. It is honest and safe, and it fits serverless.

## Shape of the system

```
Browser (React + TipTap)
   │  fetch /api/*  (httpOnly session cookie)
   ▼
netlify/functions/api.ts      adapter: config → createApp() once per warm instance
   ▼
server/app.ts                 composition root
   ├─ http/router.ts          METHOD + /path/:param → handler; auth required unless marked public
   ├─ routes/*.routes.ts      parse + validate input (zod) → call service → shape response
   ├─ services/*.service.ts   business rules: access checks, sharing, autosave versioning, attachments
   └─ repositories/           Repo interface ← Mongo (prod) | Memory (tests) | JSON file (local dev)
shared/                       types, constants, access rules, editor schema — used by client AND server
```

**Separation of concerns, concretely:**

- **Routes** know HTTP (bodies, status codes, cookies) and nothing about storage.
- **Services** hold every business rule and know nothing about `Request`/`Response`. They take plain inputs (`UploadedFile = { name, bytes }`) and throw `HttpError` with a status and a user-facing message. `tests/services.test.ts` exercises the sharing rules with no HTTP at all.
- **Repositories** are the only code that touches storage. Moving to Postgres means one new adapter, with no service or route changes.
- **`server/` is framework-agnostic.** `createApp()` returns a plain `(Request) => Promise<Response>`. Netlify is a roughly 25-line adapter, and the same app runs in tests or behind any Fetch-API server.
- **Frontend by feature** (`features/editor`, `features/sharing`, ...). The stateful logic lives in hooks (`useAutosave`, `useEditAccessWatcher`, `useDocumentList`), so page components are mostly layout.

## Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| **TipTap**, stored as **sanitized HTML** | Mature editor and a clean schema. HTML round-trips through import, export and the editor, and is easy to inspect. | HTML is less structured than ProseMirror JSON. This is mitigated by the server **allowlist sanitizer**, which mirrors exactly the nodes `shared/extensions.ts` can produce, so stored content is always editor-valid. |
| **Optimistic concurrency** (`version` compare-and-set) | Prevents lost updates with a single atomic DB op. Works on stateless functions. | No live merging; the second writer has to reload. |
| **MongoDB Atlas** behind a `Repo` interface | Free hosted tier. The document shape (shares embedded on the doc) maps naturally. Atomic `findOneAndUpdate` gives the version check. | Attachments live in Mongo (5 MB cap). They should move to object storage at scale. |
| **Netlify Functions** (single `/api/*` function + SPA) | One deploy for frontend and API, free, and HTTPS by default. | Cold starts; in-memory login throttling is per instance. |
| **Real auth** (scrypt + signed JWT in an httpOnly cookie) plus seeded demo users | Sharing is only meaningful when identities are real. Demo users keep review friction low. | No email verification or password reset (out of scope). |
| **Share by email, roles `editor` / `viewer`**, plus edit-access requests | This is the smallest model that shows owner vs. shared and least-privilege access. The request/approve flow shows the access logic end to end. | No link sharing, groups or transfer of ownership. |
| **Polling** for "shared with me" and access approval | Simple and serverless-friendly. Visibility-aware, so idle tabs don't poll. | Updates take 4–5 s to appear; websockets would be instant. |

## Validation and error handling

- All input is validated with **zod** on the server. Errors come back as `{ error, fields }`, and the UI renders field errors inline. The client mirrors the rules for instant feedback, but the server is the authority.
- Uploads go through size caps, an extension allowlist and **magic-byte checks** (a renamed `.exe` is rejected as a fake `.pdf`). Attachment downloads are always `Content-Disposition: attachment` with `nosniff`.
- Remote images in Markdown imports are fetched once over https, from public IPs only, with a 1 MB limit and a timeout, and inlined as data URIs (SSRF-guarded).
- Unknown server errors are logged and returned as a generic 500. Save failures retry automatically when transient and stop with a clear message when they aren't.

## Testing

Vitest, 52 tests:

- **API integration** (`api`, `auth-access`, `attachments`). The real app runs in-process against the in-memory repo, with real cookies and real HTTP semantics.
- **Service layer** (`services`): the sharing rules (request → approve → edit; 404 for strangers; owner-only actions) without HTTP.
- **Router** (`router`): params, auth-before-404, 405s.
- **Content** (`rendering`, `export`): the sanitizer allowlist, `.md`/`.docx` import fidelity, the export round-trip and SSRF IP checks.

## What I'd build next (2–4 hours)

1. **Version history**: snapshot on each Nth save, with a "restore" action. The version counter already exists.
2. **Presence indicators** ("Bob is viewing") via a lightweight heartbeat, as a first step toward real-time.
3. A **Playwright e2e** test for the two-browser sharing flow.
4. Move attachments to **object storage** (Netlify Blobs/S3), and move login throttling to a shared store.
