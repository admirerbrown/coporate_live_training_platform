# Phase 1 Test Cases — Data Layer & REST API

Scope: `POST /api/sessions`, `GET /api/sessions/:sessionId`, `GET /api/health`, and the input validators they depend on. No WebSocket, no Redis, no instructor-token enforcement on reads (that arrives in Phase 2).

---

## Validators (pure functions, test before wiring to any route)

### `isValidSessionName(name)`

| # | Given | Expect |
|---|---|---|
| V1 | `"Q3 Onboarding Training"` | valid |
| V2 | `"A"` (below min length, e.g. min 3) | invalid |
| V3 | `""` | invalid |
| V4 | `"   "` (whitespace only) | invalid |
| V5 | string of 201 characters (above max length 200) | invalid |
| V6 | string of exactly 200 characters | valid |
| V7 | `null` | invalid |
| V8 | `undefined` | invalid |
| V9 | `123` (non-string) | invalid |
| V10 | name with leading/trailing whitespace, e.g. `"  Team Sync  "` | valid, and trimmed before storage |

### `isValidYoutubeUrl(url)`

| # | Given | Expect |
|---|---|---|
| Y1 | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | valid |
| Y2 | `https://youtube.com/watch?v=dQw4w9WgXcQ` (no www) | valid |
| Y3 | `https://youtu.be/dQw4w9WgXcQ` (short link) | valid |
| Y4 | `https://m.youtube.com/watch?v=dQw4w9WgXcQ` (mobile) | valid |
| Y5 | `https://vimeo.com/12345` (valid URL, wrong host) | invalid |
| Y6 | `not a url` | invalid |
| Y7 | `https://www.youtube.com/watch` (missing `v` param) | invalid |
| Y8 | `""` | invalid |
| Y9 | `null` | invalid |
| Y10 | `https://www.youtube.com/watch?v=` (empty video id) | invalid |

---

## `POST /api/sessions`

| # | Given | Expect |
|---|---|---|
| C1 | valid name + valid YouTube URL | 201; body has `id` (UUID), `name`, `youtubeUrl`, `status: "CREATED"`, `createdAt`, `instructorToken` |
| C2 | valid name + valid URL, called twice with identical input | 201 both times; two distinct `id` values and two distinct `instructorToken` values |
| C3 | missing `name` field | 400; error body identifies `name` as the problem field |
| C4 | missing `youtubeUrl` field | 400; error identifies `youtubeUrl` |
| C5 | invalid `name` (per validator cases V2–V9) | 400 |
| C6 | invalid `youtubeUrl` (per validator cases Y5–Y10) | 400 |
| C7 | valid request | row exists in `training_sessions` with matching `name`, `youtube_url`, `status = 'CREATED'`, `created_at` set |
| C8 | valid request | response body does NOT include any DB-internal fields not part of the public contract (e.g. no raw `updated_at` if not intended for clients yet) |
| C9 | request body is not valid JSON | 400, not a 500 |
| C10 | extra unexpected fields in body (e.g. `status: "LIVE"` sent by client) | 201; ignored server-side, session still created with `status: "CREATED"` (server never trusts client-supplied status) |
| C11 | DB insert fails (simulate connection error) | 500; generic error message, no stack trace or DB details leaked in response |

---

## `GET /api/sessions/:sessionId`

| # | Given | Expect |
|---|---|---|
| R1 | existing session id | 200; body has `id`, `name`, `youtubeUrl`, `status`, `createdAt` |
| R2 | existing session id | response does NOT include `instructorToken` (only returned once, at creation) |
| R3 | freshly created session with no playback events yet | 200; state fields reflect defaults (e.g. `position: 0`, `isPlaying: false`) rather than null/undefined |
| R4 | sessionId that is well-formed but does not exist | 404 |
| R5 | sessionId that is not a valid UUID (e.g. `"abc123"`) | 400, not 404 or 500 |
| R6 | sessionId is missing entirely (`GET /api/sessions/`) | 404 (route not matched) |
| R7 | session exists with `status: "ENDED"` | 200; `status` field correctly reflects `"ENDED"` |

---

## `GET /api/health`

| # | Given | Expect |
|---|---|---|
| H1 | database reachable | 200; body indicates `status: "ok"` |
| H2 | database unreachable (mock connection failure) | 503; body indicates the failing dependency, no stack trace leaked |
| H3 | endpoint responds | response time is fast (no heavy queries); this is a liveness check, not a deep diagnostic |

---

## Database constraints (schema-level, can run as a small separate suite against a real test DB)

| # | Given | Expect |
|---|---|---|
| D1 | insert into `training_sessions` with `name = NULL` | insert rejected (NOT NULL constraint) |
| D2 | insert into `training_sessions` with `youtube_url = NULL` | insert rejected |
| D3 | insert into `training_sessions` with `status = 'BOGUS'` | insert rejected if a CHECK/enum constraint is used |
| D4 | insert into `training_sessions` without explicit `status` | defaults to `'CREATED'` |
| D5 | insert into `session_participants` with a `session_id` that doesn't exist in `training_sessions` | insert rejected (foreign key constraint) |
| D6 | insert into `training_sessions` without explicit `created_at` | defaults to current timestamp |

---

## Explicitly out of scope for Phase 1 tests

- Instructor token *enforcement* on state-changing WebSocket events (Phase 2)
- Redis-backed anything (Phase 3)
- Rate limiting, pagination, concurrent-write stress tests
