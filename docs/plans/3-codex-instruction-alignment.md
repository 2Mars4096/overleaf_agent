# 3: Codex Instruction Alignment

**Status:** completed
**Goal:** Make Codex load the same project-tracking guidance that Cursor already applies from `./.cursor`.

## Tasks
- [x] 1. Audit the existing instruction files
  - [x] 1-1. Compare `AGENT.md` with `.cursor/rules/project-tracking.mdc`
  - [x] 1-2. Confirm that Codex auto-discovers `AGENTS.md`, not `AGENT.md`
- [x] 2. Align the root Codex instruction file
  - [x] 2-1. Add `AGENTS.md` with the same workflow guidance as `.cursor/rules/project-tracking.mdc`
  - [x] 2-2. Remove the obsolete root `AGENT.md` to avoid drift
- [x] 3. Update the tracking docs
  - [x] 3-1. Update `docs/todo.md`
  - [x] 3-2. Update `docs/changelog.md`
  - [x] 3-3. Update `docs/architecture.md`

## Decisions
- `AGENTS.md` is the canonical Codex instruction file for this repository.
- `.cursor/rules/project-tracking.mdc` remains the source of truth for the Cursor-side always-on rule.

## Notes
- The previous singular `AGENT.md` was not auto-discovered by Codex in the default configuration.
- `AGENTS.md` intentionally matches the Cursor rule content so the two tools apply the same tracking workflow.
