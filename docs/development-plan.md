# Development Plan: Realtime Overleaf Editing in Cursor

## Objective

Build a Cursor/VS Code extension that lets users browse Overleaf projects, open text-based project files directly in the editor, and sync local edits back to Overleaf in near real time.

The intended experience is editor-native, not Git-native:
- sign in by importing an existing session
- browse projects and files in a sidebar
- open `.tex` and related files as normal editor documents
- save locally and sync back automatically
- detect remote changes without silently overwriting local work

## Product Goals

- Make Overleaf projects editable from Cursor without a Git workflow.
- Keep sync fast enough to feel live for normal writing workflows.
- Surface sync state and conflicts clearly.
- Keep the MVP narrow enough to ship despite undocumented integration details.

## Non-Goals For V1

- Full collaborative cursor or character-level multiplayer semantics
- PDF compile/download management
- Comment/review workflows
- Full parity with every Overleaf web feature
- Multi-account workspace management

## MVP

The first usable release should include:
- session-cookie import
- project listing
- project file browsing
- open/read for text-based project files
- save-based remote writes
- basic autosync after stable writes
- provisional polling for remote updates on open files if discovery confirms polling-only refresh is acceptable
- visible sync/error/conflict state

MVP file boundary:
- editable text files first (`.tex`, `.bib`, `.sty`, `.cls`, and similar text assets)
- binary assets may appear in the project tree but do not need full editable support in V1

If live validation shows polling is sufficient, it is acceptable for MVP. Otherwise the MVP should adopt the realtime path earlier.

## Key Decisions

### Authentication

- Use cookie-backed session import for V1.
- Treat auth as a session bundle, not a single-cookie assumption.
- Validate the session before enabling project access or writes.
- Keep auth behind an interface so a browser login flow can be added later.

### Editor Model

- Use normal text documents so users keep native editor behavior.
- Prefer a lightweight document/provider model first; expand to a fuller virtual filesystem only if the remote semantics are stable enough.

### Sync Strategy

- Start with save-based sync.
- Add debounced autosync only after writes are reliable.
- Prefer polling open files first if discovery confirms it is sufficient; otherwise pull the realtime transport forward.

Current source-verified caveat:
- the upstream code exposes simple auth/list/read routes over cookie-auth HTTP, but the richer project snapshot and text-write flow currently ride on the real-time service.

### Delivery Principle

- Prove auth, read, and write flows outside the extension before investing in editor UI wiring.
- Treat Milestone 0 as a hard gate, not a parallel nice-to-have.
- Treat the current request contract as source-verified only until the local discovery tool confirms it against a live cookie-backed session.

### Conflict Handling

- Do not auto-merge in V1.
- Preserve the local buffer when local and remote versions diverge.
- Fetch the remote version and require an explicit user choice.

## High-Level Architecture

### Extension Host

Owns commands, tree views, status UI, document/provider wiring, and sync orchestration.

### Overleaf Client Layer

Encapsulates:
- session restoration and validation
- project listing
- file tree discovery
- file reads
- file writes
- remote refresh checks

This layer should be isolated so the transport can change without rewriting the editor surface.

### Document Layer

Maps remote files into editor-openable documents with stable URIs and local dirty-state handling.

### Sync Engine

Tracks:
- open files
- last synced version
- pending uploads
- dirty local state
- remote version metadata
- conflict state

### Local Cache

Stores:
- secure session material
- recent project/file metadata
- non-secret sync metadata

## Milestones

Executable task tracking lives in `docs/plans/`. The milestones below describe scope and exit criteria; see the linked plan files for current task status.

### Milestone 0: Discovery

Goal: confirm that the integration path is technically viable.

**Plan:** [2-1-overleaf-request-discovery](plans/2-1-overleaf-request-discovery.md)

Exit criteria:
- one validated request flow for auth and project access
- one validated request flow for file read/write
- a documented go/no-go decision for the extension build path

### Milestone 1: Extension Skeleton

Goal: create a runnable extension shell.

Exit criteria:
- extension loads in development mode
- commands and sidebar contributions render in the editor

### Milestone 2: Auth and Project Browser

Goal: connect to Overleaf and browse projects.

Exit criteria:
- a user can import a valid session and see their projects

### Milestone 3: Read Path

Goal: open Overleaf files as editor documents.

Exit criteria:
- users can browse and open supported files with current remote content

### Milestone 4: Write Path

Goal: save changes back to Overleaf reliably.

Exit criteria:
- a saved local change is reflected remotely

### Milestone 5: Near-Realtime Refresh

Goal: make editing feel live during normal use.

Exit criteria:
- local edits sync with low friction
- remote changes appear promptly or trigger a safe warning

### Milestone 6: Conflict UX and Hardening

Goal: handle edge cases safely.

Exit criteria:
- no silent overwrite in local/remote edit collisions
- auth and sync failures are actionable

## Major Risks

### Unstable Integration Surface

Overleaf access may depend on undocumented or semi-public endpoints.

Mitigation:
- keep the client layer isolated
- document assumptions as they are discovered
- keep the MVP narrow

### Auth Fragility

Cookie-backed auth may expire, rotate, or require CSRF/bootstrap state not obvious at first.

Mitigation:
- secure storage
- centralized validation and refresh handling
- explicit re-import path

### Realtime Complexity

True collaborative editing may be harder than near-realtime sync.

Mitigation:
- ship polling first only if discovery closes that path safely
- keep websocket/event support optional until later
- note that the current upstream source already uses real-time joins for the richer project snapshot and text-write path

### Conflict Complexity

Simultaneous edits can cause overwrite risk.

Mitigation:
- version tracking
- preserve local buffers
- explicit resolution flow instead of auto-merge

## Success Criteria

- Users can authenticate with session cookies and browse Overleaf projects from Cursor.
- Users can open and edit project text files without using Git manually.
- Local saves sync back reliably.
- Remote changes are detected without data loss.
- Sync state is understandable from the UI.

## Immediate Next Steps

1. Run `npm run discovery` against a real cookie-backed session to validate the source-verified contract on the target host.
2. Confirm one safe write against a throwaway project or file before opening Milestone 1.
3. Decide whether refresh can stay HTTP-polling-only or must depend on the real-time socket path.
4. Only then scaffold the extension in TypeScript.
