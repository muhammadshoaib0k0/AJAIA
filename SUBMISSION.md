# Submission — Ajaia AI-Native Full Stack Developer Assignment

**Candidate:** Muhammad Shoaib (muhammadshoaib0k0@gmail.com)

| | |
|---|---|
| **Live app** | https://thunderous-cannoli-4688a2.netlify.app/ |
| **Source repo** | https://github.com/muhammadshoaib0k0/AJAIA |
| **Walkthrough video** | https://www.loom.com/share/5453028364994f05962d4a7ab4ccfe78 (also in `VIDEO_URL.txt`) |
| **Demo accounts** | `alice@example.com`, `bob@example.com`, `carol@example.com`. Password **`demo1234`** for all (one-click buttons on the login screen). |
| **Run locally** | `git clone https://github.com/muhammadshoaib0k0/AJAIA.git && cd AJAIA && npm install && npm run dev` → http://localhost:8888 (Node 20.19+, no database or env vars needed). |

## What's included in this folder

| Item | Path |
|---|---|
| Source code: React frontend | `src/` |
| Source code: backend (routes → services → repositories) | `server/` |
| Source code: code shared by client and server (types, access rules, editor schema) | `shared/` |
| Netlify function adapter and deploy config | `netlify/functions/api.ts`, `netlify.toml`, `redirects/_redirects` |
| Automated tests (Vitest, 52 tests across 7 files) | `tests/` |
| Setup, run, deploy and supported file types | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Walkthrough video URL | `VIDEO_URL.txt` |
| Environment variable template (production only) | `.env.example` |
| This file | `SUBMISSION.md` |

There are no screenshots: the live URL and zero-setup local run need no extra steps.

## Requirement checklist

| Requirement | Status | Where to see it |
|---|---|---|
| Create, rename, edit, save and reopen documents | ✅ | Dashboard → **New document**; the title is editable inline; autosave status sits next to the title. |
| Bold, italic, underline, headings, bulleted/numbered lists | ✅ | Editor toolbar (plus strike, sub/sup, quote, code, alignment, links, images, tables). |
| File upload | ✅ | `.txt/.md/.docx` → new document (dashboard **Import file**) or into the open doc (toolbar **Import**), plus **Attachments** under each doc. Types and limits are shown in the UI. |
| Owner, grant access, owned vs. shared distinction | ✅ | **Share** dialog (Can edit / View only, revoke). Dashboard has **My documents** and **Shared with me**, with badges. |
| Persistence of documents, formatting and shares | ✅ | MongoDB Atlas in production. Refresh at any point. |
| Validation and error handling | ✅ | Zod on the server with inline field errors, upload type/size/magic-byte checks, conflict banner, save retry. |
| Automated tests | ✅ | `npm test` |
| Deployment | ✅ | Netlify + MongoDB Atlas (both free tier). |
| Stretch | ✅ Export (.docx/.md/.txt) and role-based sharing (editor/viewer plus an edit-access request flow) | Editor → **Export**; viewer → **Request edit access**. |

## Working / incomplete / next

**Working end to end:** auth (sign-up, login, demo users); document CRUD with autosave and conflict detection; rich-text editing; the three upload flows; sharing with roles and access requests; export; persistence; deployment.

**Intentionally not built:**
- Real-time co-editing. Concurrent saves are *detected* (version check) rather than merged.
- Comments, version history, notifications and password reset.
- Updates to "Shared with me" and to access approvals arrive by polling (about 5 s), not push.

**Next 2–4 hours:**
1. Version history with restore.
2. Presence indicators ("Bob is viewing").
3. A Playwright e2e test for the two-browser sharing flow.
4. Moving attachments to object storage.
