# Ajaia Docs — a lightweight collaborative document editor

A focused Google-Docs-style slice: create and edit rich-text documents, import files, attach files, and share documents with other users (owner / editor / viewer), all persisted and deployed.

- **Live app:** https://thunderous-cannoli-4688a2.netlify.app/
- **Source:** https://github.com/muhammadshoaib0k0/AJAIA (`git clone https://github.com/muhammadshoaib0k0/AJAIA.git`)
- **Walkthrough video:** see [`VIDEO_URL.txt`](VIDEO_URL.txt)
- **Architecture note:** [`ARCHITECTURE.md`](ARCHITECTURE.md) · **AI workflow note:** [`AI_WORKFLOW.md`](AI_WORKFLOW.md) · **What's included:** [`SUBMISSION.md`](SUBMISSION.md)

## Demo accounts (for reviewing sharing)

All demo accounts share the password **`demo1234`**. The login screen also has one-click buttons for each account.

| Name | Email |
|---|---|
| Alice Johnson | `alice@example.com` |
| Bob Martinez | `bob@example.com` |
| Carol Singh | `carol@example.com` |

You can also sign up with any email. Accounts are real and have passwords, but there is no email verification.

**Two-minute sharing check:** sign in as Alice in one browser and Bob in another (or a private window). As Alice, create a document and click **Share**, then add `bob@example.com` as **View only**. Bob sees it under **Shared with me** within about 5 seconds. Bob clicks **Request edit access**, Alice approves it in the Share dialog, and Bob's editor unlocks without a reload.

## Features

| Area | What works |
|---|---|
| **Documents** | Create, rename (inline title), edit, delete (owner only). Autosave with a status indicator ("Saving…" / "All changes saved"). Reopening a document restores its exact formatting. |
| **Rich text** | Bold, italic, underline, strikethrough, sub/superscript, H1–H3, bulleted and numbered lists, quotes, code blocks, horizontal rule, alignment, links, images, tables. |
| **File upload** | 1) **Import a file as a new document** (dashboard). 2) **Import a file into the open document** (toolbar). 3) **Attachments** on a document (download / remove). |
| **Sharing** | One owner per document. Share by email as **Can edit** or **View only**, and revoke access. The dashboard separates **My documents** from **Shared with me**, with badges. Viewers can request edit access, and the owner approves or denies. |
| **Safety** | Concurrent edits are detected (version check), so a stale tab can't silently overwrite someone else's save. HTML is sanitized server-side against an allowlist. Uploads are type- and size-checked, including magic bytes. |
| **Export** (stretch) | Word (.docx), Markdown (.md), plain text (.txt). |

### Supported file types (also shown in the UI)

| Flow | Types | Limit |
|---|---|---|
| Import → editable document | `.txt`, `.md`, `.docx` | 2 MB |
| Attachments | `.txt .md .docx .pdf .png .jpg .jpeg .gif .csv .xlsx .pptx` | 5 MB each, 10 per document |
| Inline images | PNG, JPEG, GIF, WebP | 1 MB |

`.docx` import keeps headings, bold/italic/underline, lists, tables, links and images. Anything it can't convert is simplified, and the app shows an "Import note" saying what was dropped.

## Run locally

**Prerequisites:** Node.js **20.19+** and npm. Nothing else: local dev uses a JSON file store, so no database or env vars are needed.

```bash
git clone https://github.com/muhammadshoaib0k0/AJAIA.git && cd AJAIA
npm install
npm run dev          # http://localhost:8888  (Netlify Dev: Vite frontend + API function)
```

Sign in with a demo account above. Data is stored in `.data/dev-store.json`; delete that file to reset.

To run locally against MongoDB instead, copy `.env.example` to `.env` and set `MONGODB_URI` and `SESSION_SECRET`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Full app (frontend + API) on :8888 |
| `npm test` | Vitest suite (API integration, router, services, import/export, sanitizer) |
| `npm run typecheck` | `tsc --noEmit` across client, server, shared and tests |
| `npm run build` | Typecheck and production build to `dist/` |

## Deploy (Netlify + MongoDB Atlas, both free tier)

1. Create a free MongoDB Atlas M0 cluster and copy its connection string. Include a database name in the path, e.g. `.../ajaia-docs?...`.
2. Create a Netlify site from this repo. `netlify.toml` already sets the build command (`npm run build`), the publish directory (`dist`) and the functions bundler.
3. In Netlify, add the environment variables `MONGODB_URI` and `SESSION_SECRET` (e.g. from `openssl rand -hex 32`).
4. Deploy. Demo users are created automatically on the first API request.

Neither service requires a paid plan.

## Project structure

```
shared/              Code used by BOTH client and server
  types.ts           Domain types (DocRecord, DocView, Share, ...)
  constants.ts       Limits, supported file types, demo users
  access.ts          The access rules (owner/editor/viewer → canRead/canEdit)
  extensions.ts      TipTap schema = what a document can contain

server/              Backend, framework-agnostic: (Request) => Response
  app.ts             Composition root: repo → services → routes
  config.ts          Env parsing + storage selection
  http/              Router, request readers, response helpers, HttpError
  routes/            Thin controllers: parse/validate input → call service → JSON
  services/          Business rules: documents, sharing, attachments, auth
  repositories/      Storage port (repository.ts) + Mongo / memory / file adapters
  content/           HTML sanitizer, file importer (.txt/.md/.docx), safe image fetch
  validation/        Zod schemas, id formats, attachment type checks
  auth/              Session JWT cookie, scrypt password hashing

netlify/functions/api.ts   ~25-line adapter that mounts the server app at /api/*

src/                 React frontend (Vite)
  app/               App-wide providers (session, toasts)
  features/          One folder per feature: auth, documents, editor, sharing, attachments
    editor/hooks/    useAutosave (debounce + version conflict), useEditAccessWatcher
  components/        Shared UI primitives
  hooks/             Generic hooks (usePolling)
  lib/               API client, client-side validation, formatting

tests/               Vitest: API integration, router, service-level rules, import/export
```

For the reasoning behind this layout, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Known limitations

- **No real-time co-editing.** Two editors on the same document are protected by a version check: the second save gets a "changed by someone else, reload" banner instead of overwriting. Shared-list and access-request updates arrive by polling (4–5 s), not websockets.
- Login throttling is per serverless instance (in memory), not global.
- Attachments are stored in MongoDB (fine at a 5 MB cap). At scale they belong in object storage.
- There is no password reset, email verification or notifications.
