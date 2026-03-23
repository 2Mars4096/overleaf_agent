# 2-1: Overleaf Request Discovery

**Parent:** [2-overleaf-extension-mvp](2-overleaf-extension-mvp.md)
**Status:** in-progress
**Goal:** Validate the authenticated request contract for cookie-backed session auth, text-file read/write, and MVP remote refresh before building the extension UI.

## Tasks
- [ ] 1. Capture the auth prerequisites
  - [x] 1-1. Identify the required Overleaf domains and cookie names
  - [x] 1-2. Determine whether a CSRF token or bootstrap page load is required
  - [x] 1-3. Record the minimum required headers for authenticated requests
- [ ] 2. Validate the text-file read path
  - [x] 2-1. Confirm a session-validation request
  - [x] 2-2. Confirm the project-list request
  - [x] 2-3. Confirm the project file-tree request
  - [x] 2-4. Confirm a text-file content request for `.tex`/similar files
- [ ] 3. Validate the write and refresh path
  - [ ] 3-1. Confirm a safe text-file write request against a throwaway file or project
  - [x] 3-2. Determine how remote version or last-modified state is exposed
  - [ ] 3-3. Decide whether MVP remote refresh can stay HTTP-polling-only
- [ ] 4. Lock the MVP boundary and artifacts
  - [x] 4-1. Define the editable text file types for MVP
  - [x] 4-2. Define how binary assets are handled in MVP
  - [x] 4-3. Update `docs/auth-notes.md` and `docs/development-plan.md` with the current contract state and go/no-go outcome

## Decisions
- Treat the imported cookie header as opaque; do not hard-code a single cookie name even though Community Edition defaults to `overleaf.sid`.
- Use `GET /user/projects` as the first live session-validation probe.
- Use the public HTTP routes for validation, simple listing, path/type inventory, and doc download.
- Treat the richer project tree and document-write flow as real-time-path work until a live probe proves otherwise.
- Keep the Milestone 0 gate closed until a live cookie-backed write probe is confirmed on a throwaway project or file.
- Current go/no-go outcome: no-go for extension-shell implementation until the remaining live checks in `docs/overleaf-request-contract.md` are closed.

## Notes
- Do this work outside the extension first with repeatable manual or scripted requests.
- The output of this plan should remove guesswork from extension implementation.
- Do not start `2-2` until this plan has a validated request contract.
- Added `npm run discovery` as the local probe entrypoint.
- Captured the current source-verified contract in `docs/overleaf-request-contract.md`.
- Remaining blockers are the live cookie-backed write probe and the final refresh decision.
