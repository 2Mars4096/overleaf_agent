# Changelog

## 2026-03-23
- [repo] Added `.gitignore` for local junk/dependency folders and published the tracked project docs, rules, and discovery tooling to the GitHub repository.
- [discovery] Verified `tools/overleaf-discovery.mjs` with local dry runs, fixed the human-readable `contract` output so it prints the source-verified route summary, improved the dry-run preview placeholders, clarified the trusted Overleaf host boundary and minimum header set in the auth/contract docs, aligned the roadmap wording so polling stays provisional until discovery task `3-3` is closed, and marked plan item `2-1 / 4-3` complete after the auth/development docs were updated with the current no-go gate.
- [discovery] Added `package.json` and `tools/overleaf-discovery.mjs` as the local Milestone 0 probe harness, captured the current source-verified Overleaf request contract in `docs/overleaf-request-contract.md`, and updated the planning docs to keep extension-shell work blocked on a live cookie-backed write/refresh validation.
- [docs] Replaced the non-discovered root `AGENT.md` with a canonical `AGENTS.md` that mirrors `.cursor/rules/project-tracking.mdc`, and updated the tracking docs to reference the Codex-loaded file.
- [docs] Patch pass: de-duplicated milestone task lists in `development-plan.md` (now references plan files), collapsed the discovery checklist in `auth-notes.md` to point at plan 2-1, tagged 2-1 as `[active]` in `todo.md`, and noted that `src/` does not exist yet in `architecture.md`.
- [docs] Reviewed and tightened the planning set: added a hard discovery/go-no-go gate, clarified the MVP as text-first, created the active `2-1-overleaf-request-discovery` sub-plan, and updated the tracking docs to reflect the new execution order.
- [docs] Established the project tracking system with `.cursor/rules/project-tracking.mdc`, `AGENT.md`, `docs/todo.md`, `docs/architecture.md`, `docs/bugs.md`, and initial plan files under `docs/plans/`.
- [docs] Migrated the Overleaf extension roadmap and cookie-auth design into `docs/development-plan.md` and `docs/auth-notes.md`, and added a project `README.md`.
