# Architecture

## Project State

- This repo is currently in planning/discovery mode, with a local request-contract probe tool in place.
- The project target is a Cursor/VS Code extension for editing Overleaf projects from the editor with near-realtime sync.

## Current Repository Layout

- `README.md` — user-facing project summary
- `AGENTS.md` — Codex-loaded tracking workflow mirrored from the Cursor rule
- `.cursor/rules/project-tracking.mdc` — always-on tracking rule
- `package.json` — local scripts, currently used for the discovery CLI
- `tools/overleaf-discovery.mjs` — local probe CLI for Milestone 0 request-contract work
- `docs/` — canonical tracking and design docs
- `docs/plans/` — executable plan files with numbered tasks

## Planned Code Layout

No `src/` directory exists yet. The layout below is the target structure once discovery (plan 2-1) is complete and extension implementation begins.

```text
src/
  extension.ts
  auth/
  client/
  sync/
  providers/
  views/
  models/
  utils/
test/
docs/
```

## Planned Tech Stack

- TypeScript
- VS Code Extension API, compatible with Cursor
- Editor secret storage for session cookies and auth metadata
- HTTP client layer for authenticated Overleaf requests
- Save-based sync first, then debounced autosync and remote refresh

## Core Module Intent

- `auth/` — session import, validation, secure storage, CSRF handling
- `client/` — Overleaf request layer for projects, files, and sync
- `sync/` — local/remote version tracking, upload scheduling, conflict state
- `providers/` — document/file abstractions such as filesystem or text providers
- `views/` — project tree, commands, status bar, and sync UX
- `models/` — shared types for projects, files, sessions, and sync state
- `utils/` — shared helpers, logging, and request utilities

## Conventions

- `docs/` is the canonical home for project tracking documents.
- Authentication is modeled as an opaque session bundle, not a single cookie assumption.
- Validate auth/read/write request flows outside the extension before wiring them into editor UI.
- Use `npm run discovery` for repeatable live probes before starting extension-shell work.
- Prefer save-based sync and polling first, but keep the realtime transport available if discovery shows polling-only refresh is not safe enough.
- Do not assume a public cookie-auth HTTP write route exists; the current source-verified contract still points at the realtime path for text writes.
- MVP editing scope is text-based project files first; binary assets are deferred or browse-only until proven cheap and safe.
- Never store cookies or CSRF tokens in plaintext config or workspace files.
- Keep the transport layer behind interfaces so browser-login or websocket support can be added later without rewriting the extension surface.
