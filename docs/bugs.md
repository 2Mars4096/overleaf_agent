# Known Issues & Failed Approaches

## Open Bugs / Discovery Risks

- **Unverified auth contract.** Session cookies alone may not be enough for write operations; CSRF tokens, bootstrap state, or extra headers may still be required.
- **Unverified realtime transport.** Near-realtime sync may need HTTP polling in the MVP if Overleaf's websocket or event channel is private, brittle, or not worth reproducing yet.
- **Undocumented integration surface.** Project listing, file reads, and file writes may depend on internal web endpoints that can change without notice.
- **MVP file-support boundary was previously underspecified.** Overleaf projects include binary assets as well as text sources, so the plan now treats editable text files as the first-class MVP scope and defers broader asset handling until discovery proves it is low-risk.
- **Public HTTP write path is still unconfirmed.** The inspected upstream source exposes document text writes through the realtime stack and private APIs, so a cookie-only HTTP write flow should not be assumed.
- **Public HTTP file-tree route is incomplete for editor use.** `GET /project/:Project_id/entities` returns paths and types, but the richer tree with entity ids comes from the realtime join flow.
- **Cookie name may vary by deployment.** Community Edition defaults to `overleaf.sid`, but hosted or legacy instances may present a different browser cookie name, so the extension must treat the imported cookie header as opaque.

## Rejected / Failed Approaches

- **Git-sync-first workflow is not the target product.** It is simpler technically, but it does not match the intended extension UX of opening and editing Overleaf files directly in the editor.
- **Extension-first implementation before request discovery is rejected.** Starting with the editor shell before reproducing auth, read, and write requests would mix UI bugs with integration-contract failures and slow down feasibility work.
