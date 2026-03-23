# Todo

## Current Backlog
- [x] [1-document-tracking-foundation](plans/1-document-tracking-foundation.md) — establish the project tracking system, seed the core docs, and migrate planning/auth notes into `docs/`
- [ ] [2-overleaf-extension-mvp](plans/2-overleaf-extension-mvp.md) — build the Cursor/VS Code extension MVP for browsing, editing, and near-realtime syncing Overleaf projects
  - [ ] **[active]** [2-1-overleaf-request-discovery](plans/2-1-overleaf-request-discovery.md) — validate the authenticated request contract, using the source-verified contract and local discovery CLI; extension-shell work stays blocked until live write/refresh checks close the gate
  - [ ] 2-2: Extension scaffold and project browser → (not yet planned)
  - [ ] 2-3: Remote document open/read/write flow → (not yet planned)
  - [ ] 2-4: Near-realtime sync and conflict UX → (not yet planned)
- [x] [3-codex-instruction-alignment](plans/3-codex-instruction-alignment.md) — replace the non-discovered root `AGENT.md` setup with a canonical `AGENTS.md` that mirrors the Cursor tracking rule
- [ ] Compile/PDF integration follow-up → (not yet planned)

## Backlog (unphased)
- [ ] Evaluate websocket-based remote change detection after HTTP polling is stable
- [ ] Decide whether the MVP should expose a virtual workspace root or a file-by-file open model
- [ ] Add a user-facing help flow for importing session cookies safely
- [ ] Validate the source-verified request contract against a live hosted Overleaf session
