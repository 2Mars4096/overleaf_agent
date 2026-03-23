# 2: Overleaf Extension MVP

**Status:** in-progress
**Goal:** Build the first usable Cursor/VS Code extension that can browse Overleaf projects, open editable files, and sync local changes back in near real time.

## Tasks
- [ ] 1. Prove feasibility before extension UI work
  - [ ] 1-1. Confirm the cookie/session and CSRF requirements
  - [ ] 1-2. Reproduce project-list, file-tree, text-file-read, and text-file-write flows outside the extension
  - [ ] 1-3. Define the MVP boundary for editable text files versus browse-only or deferred binary assets
  - [ ] 1-4. Decide whether MVP remote updates use polling only or a stable event channel
- [ ] 2. Build the extension shell
  - [ ] 2-1. Scaffold the TypeScript extension project
  - [ ] 2-2. Add commands for session import, refresh, and project open
  - [ ] 2-3. Add a sidebar tree view and sync status surface
- [ ] 3. Implement the remote document read path
  - [ ] 3-1. Map Overleaf files to stable editor document URIs
  - [ ] 3-2. Open `.tex`, `.bib`, `.sty`, and related text files
  - [ ] 3-3. Add loading, retry, and missing-file error handling
- [ ] 4. Implement save and sync
  - [ ] 4-1. Detect saves for Overleaf-backed documents
  - [ ] 4-2. Upload changes with the validated session bundle
  - [ ] 4-3. Surface sync, error, and offline states in the UI
- [ ] 5. Add near-realtime refresh and conflict safety
  - [ ] 5-1. Add debounced autosync after stable save behavior exists
  - [ ] 5-2. Refresh open-file state from remote changes
  - [ ] 5-3. Preserve local buffers and surface explicit conflict resolution
- [ ] 6. Harden and test
  - [ ] 6-1. Add unit and integration coverage for auth, sync, and conflict state
  - [ ] 6-2. Add diagnostics and reconnect handling
  - [ ] 6-3. Revisit websocket/event support only after polling is stable

## Exit Gates

- Do not start extension-shell implementation until Task 1 produces a validated request contract.
- Do not enable autosync by default until save-based writes are proven reliable.

## Decisions

- Cookie-backed session import is the MVP authentication path.
- Save-based sync ships before more aggressive autosync behavior.
- HTTP polling is acceptable for MVP if a stable realtime channel is not practical.
- Conflict safety is more important than silent background merging.
- MVP editing is text-first; binary asset support is deferred unless discovery proves it is cheap and low-risk.

## Notes

- The roadmap detail lives in `docs/development-plan.md`.
- The auth-specific design and discovery checklist live in `docs/auth-notes.md`.
- The active child plan should start with `2-1` request discovery before any extension-shell work.
- Later sub-plans under `2-*` should be created just in time once their gate is reached.
