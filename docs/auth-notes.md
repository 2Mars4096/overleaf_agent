# Auth Notes: Cookie-Backed Overleaf Session

## Purpose

Define the MVP authentication approach for the Overleaf editor extension.

The MVP will not implement a full embedded login flow. It will accept an existing authenticated Overleaf session from the user, store it securely, validate it, and reuse it for project and file requests.

## MVP Decision

Use a cookie-backed session as the default V1 authentication path.

This is the fastest route to a working prototype because it avoids:
- browser-login/OAuth work
- password handling inside the extension
- tight coupling to an unstable sign-in flow

## MVP Boundary

The first auth-enabled editor flow only needs to support writable text project files such as:
- `.tex`
- `.bib`
- `.sty`
- `.cls`
- similar text-based source/config files

Binary assets can be listed in the project tree, but they do not need full editable support in the first release.

## Core Principle

Treat auth as a session bundle, not as "just one cookie."

The extension may need:
- one or more cookies
- a CSRF token
- request headers expected by the web app
- additional bootstrap state for writes or remote-refresh channels

## Trusted Host Boundary

- Bind each imported session bundle to one trusted Overleaf base URL such as `https://www.overleaf.com` or a self-hosted deployment origin.
- Reuse that same base URL for validation, project listing, file-tree discovery, document download, and CSRF extraction.
- Assume the realtime socket path belongs to the same deployment and uses the same signed session cookie unless a live hosted probe proves the deployment splits it onto a separate origin.
- Never forward imported cookies or CSRF tokens to any non-Overleaf or third-party host.

## User Flow

### 1. Import Session

Expose a command such as `Overleaf: Import Session`.

For MVP, support pasting a raw `Cookie` header string:

```text
cookie_a=value_a; cookie_b=value_b; cookie_c=value_c
```

### 2. Validate Session

After import, make a lightweight authenticated request to confirm:
- the cookies are accepted
- the account is authenticated
- the extension can reach an authenticated project endpoint

Current source-verified first probe:
- `GET /user/projects`

### 3. Discover CSRF State

If writes require CSRF protection, extract the token during validation or from the first authenticated page/bootstrap response.

Possible sources:
- a cookie
- a meta tag
- inline page data
- a response header

Current source-verified expectation:
- mutating web routes are CSRF-protected by default
- the frontend sends `X-Csrf-Token`
- the token is available in authenticated HTML via the `ol-csrfToken` meta tag

### 4. Persist Securely

Store sensitive session material in editor secret storage.

Never store cookies or tokens in:
- `settings.json`
- workspace files
- plaintext logs
- diagnostic dumps

### 5. Reuse For Requests

All Overleaf requests should reuse one central session bundle:
- cookie header for reads and writes
- CSRF token/header for mutating requests if required
- shared headers assembled in one request helper

### 6. Expiry Handling

If the session is rejected, mark auth as expired and prompt the user to re-import fresh cookies.

## Recommended Data Model

```ts
type SessionBundle = {
  cookieHeader: string;
  csrfToken?: string;
  accountId?: string;
  userEmail?: string;
  validatedAt?: number;
  expiresAt?: number;
};
```

Notes:
- keep `cookieHeader` opaque for MVP
- keep `csrfToken` optional until discovery proves it is required
- rely on server rejection if expiry cannot be derived locally

## Storage Strategy

### Secret Storage

Use editor secret storage for:
- cookie header
- CSRF token
- any other sensitive session artifact

### Non-Secret Storage

Regular extension storage can hold:
- validation timestamp
- selected account metadata
- last-used project id
- auth health state

## Request Strategy

### Read Requests

For project lists, file trees, and file reads:
- send imported cookies
- add only the minimum confirmed headers
- avoid hard-coding extra browser headers until they are proven necessary

Current source-verified public routes:
- `GET /user/projects` for session validation and simple project listing
- `GET /project/:Project_id/entities` for path/type inventory only
- `GET /Project/:Project_id/doc/:Doc_id/download` for plain-text document reads

Current minimum header set:
- required: `Cookie`
- practical default: `Accept`
- not source-verified as required: `Origin`, `Referer`

### Write Requests

For file updates:
- send cookies
- attach CSRF token/header if required
- include required origin/referrer/content-type headers in one shared helper

Current source-verified caveat:
- no public cookie-auth HTTP text-write route has been confirmed yet
- the inspected upstream code routes document writes through the real-time socket path after project/doc join

Current minimum header set for CSRF-protected web `POST`s:
- required: `Cookie`
- required when protected: `X-Csrf-Token`
- required for JSON payloads: `Content-Type: application/json`
- `Origin` and `Referer` stay optional until a live hosted probe proves they are enforced

### Near-Realtime Requests

For the first implementation:
- probe authenticated HTTP polling first because it is cheaper to ship
- do not treat polling-only refresh as decided until discovery task `3-3` is closed
- pull websocket or channel support forward if live validation shows polling cannot provide safe refresh/conflict behavior

Current source-verified caveat:
- the richer project snapshot and versioned doc join flow currently come from the real-time service
- polling is still a possible MVP fallback for coarse doc re-download, but it is not yet a verified replacement for the versioned socket flow

## Discovery Deliverable

Before extension implementation starts, capture one validated request contract that records:
- session validation request
- project list request
- project file tree request
- text file read request
- text file write request
- required cookies, headers, and CSRF behavior
- whether remote refresh can stay HTTP-only for MVP

This can live as notes inside the tracking docs, but it should be concrete enough that the extension work is wiring, not guesswork.

Current canonical contract doc:
- `docs/overleaf-request-contract.md`

## Security Requirements

- Never print full cookie strings in logs.
- Never expose session secrets in UI notifications.
- Redact auth material in error reports.
- Clear secrets on sign-out.
- Scope requests to trusted Overleaf domains only.
- Never forward imported cookies to third-party hosts.

## Discovery Checklist

The executable discovery checklist is tracked in [2-1-overleaf-request-discovery](plans/2-1-overleaf-request-discovery.md). The validated answers will be recorded back here once discovery is complete.

Current live-probe entrypoint:
- `npm run discovery`

## Auth Abstraction

Keep auth behind a small interface so browser login can be added later:

```ts
interface AuthProvider {
  getSessionBundle(): Promise<SessionBundle | undefined>;
  importSession(rawInput: string): Promise<void>;
  validateSession(): Promise<boolean>;
  clearSession(): Promise<void>;
}
```

Initial implementation:
- `CookieAuthProvider`

Possible later implementation:
- `BrowserLoginAuthProvider`

## Suggested Implementation Order

1. Reproduce the authenticated request flow outside the extension with a repeatable manual or scripted probe.
2. Add a secret-storage wrapper.
3. Add `Overleaf: Import Session`.
4. Save the raw cookie header securely.
5. Implement one authenticated validation request.
6. Extract CSRF state if required.
7. Implement project listing.
8. Reuse the same auth path for file-tree and file-read requests.
9. Add write requests only after reads are stable.

## Open Questions

- Should the extension accept raw cookie headers only, or also exported cookie formats later?
- Do we need account scoping if users import cookies from multiple Overleaf accounts?
- Should validation happen on startup or lazily on first use?
- Can the hosted target instance reuse the same signed session cookie for realtime joins exactly as the upstream source suggests?
- Should binary assets be browse-only in V1, or hidden until later support exists?
