# AI workflow note

> **Before submitting:** the bracketed `[…]` parts are things only you can state truthfully (the tools and moments from your original build). Fill them in or delete them. The rest describes the restructuring pass, which happened as written.

## Tools used

- **Claude Code** (Anthropic, in VS Code): the structural refactor, test additions and documentation.
- `[Any other tools used for the initial build, e.g. Cursor / Copilot / ChatGPT, and what each was used for]`

## Where AI materially sped things up

- **Mechanical restructuring.** I split a 300-line all-in-one API handler (routing, auth, business rules and responses mixed together) into `router → routes → services → repositories`. I also extracted the editor's autosave and polling logic into hooks. Moving about 40 files and rewiring every import is exactly the kind of tedious, error-prone work AI does quickly.
- **Boilerplate with clear specs.** Zod schemas, repository adapters (Mongo, memory, file) behind one interface, and table-driven tests.
- **Documentation drafts.** README, architecture note and this file, which I then edited for accuracy against the code.
- `[Initial build: e.g. TipTap toolbar wiring, mammoth .docx style mapping, docx export]`

## What I changed or rejected

- **Router auth order (caught by a test).** The AI's first router authenticated only *after* a route matched. That quietly changed `GET /api/<unknown>` for anonymous users from `401` to `404`, which lets anyone probe which endpoints exist. The existing test `does not expose a public user list` failed. I made authentication run before any 404/405, and added router tests that pin this down.
- **Garbled error handling.** One generated line in the sharing service built its "user not found" error with a nonsensical optional-chaining expression. I replaced it with a proper `notFound(message, fields)` helper before it was ever run.
- **Path aliases rejected.** I kept relative imports instead of `@shared/*` aliases. Netlify's function bundler and Vite/Vitest would each need alias config, and a resolution mismatch would only show up after deploying.
- **Kept services free of HTTP.** Generated services initially took the web `File` type. I changed them to accept `{ name, bytes }`, so business logic can be tested without constructing requests.
- `[Initial build: things you rewrote, e.g. a suggestion to store raw unsanitized HTML, or to use 403 for strangers (leaks document existence), or the BSON Binary → Buffer bug in attachment downloads]`

## How I verified correctness, UX and reliability

- **Baseline first.** Before the refactor I ran the suite (45/45 passing) and the typecheck. The tests drive the real HTTP handler in-process, so I kept that contract (`createApp() → (Request) => Response`) stable and used the suite as a regression net through every step.
- **After each layer:** `tsc --noEmit` on client, server, shared and tests, then the full test run. I ended at **52/52**, adding router and service-level tests.
- **Production parity:** `vite build`, plus bundling the Netlify function with esbuild, to catch import or bundling issues that tests can't.
- **End-to-end smoke test** against `netlify dev`: log in, create, save (confirmed `<script>` is stripped and the version increments), share, import a `.md` file, a 401 for anonymous users, a 404 for unknown routes, and SPA deep links.
- **UX:** `[manual passes, e.g. two browsers (Alice + Bob) for the share → request → approve flow, .docx import of a real document, refresh-to-verify persistence, keyboard shortcuts]`
