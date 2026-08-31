# Corporate Live Training Platform — Build Plan

**Goal:** ship a focused, working portfolio project by the September deadline that demonstrates real-time distributed state engineering, matched to the Dexwin Senior Full Stack Engineer JD.

**Principle:** build the sync engine and authorization deeply and correctly. Keep everything else (UI polish, test breadth, docs beyond what's needed) lean. A smaller project that fully works beats a larger one that's half-finished.

---

## Phase 1 — Data Layer & REST API

**Build:**
- Postgres schema: `training_sessions` (id, name, youtube_url, created_by, status, created_at, updated_at), `session_participants` (id, session_id, user_id, joined_at, left_at). Add `users` only if you need it for the instructor-token flow below; otherwise skip it.
- `POST /api/sessions` — create a session, return id + instructor token
- `GET /api/sessions/:sessionId` — session metadata + current state
- `GET /api/health` — service health check
- Basic input validation (valid name, valid YouTube URL)

**Keep lean:** don't add tables or fields "to demonstrate Postgres." No pagination, filtering, or admin endpoints. One index on `training_sessions.id` is enough.

**Why first:** everything downstream depends on this contract existing and being stable.

---

## Phase 2 — Real-Time Core (the hard 20%, build this well)

This is the part of the project that actually gets you hired. Don't rush it.

**Build:**
- WebSocket server: `SESSION_JOIN`, `PLAY`, `PAUSE`, `SEEK`, `RECONNECT` (client→server); `SESSION_STATE`, `PLAYER_PLAY/PAUSE/SEEK`, `PARTICIPANT_JOINED/LEFT`, `ERROR` (server→client)
- Authoritative state object: `{ sessionId, videoId, status, position, updatedAt, updatedBy, version }`, held server-side, never trusted from the client
- **Version-based stale-event rejection** — reject any event referencing an older version than the server's current state
- **Loop prevention** — distinguish user-generated player events from programmatic sync updates, so a broadcast doesn't re-trigger itself
- **Late-join sync** — new client receives `status + position + serverTimestamp`, calculates elapsed time itself to land at the correct live position
- **Reconnection** — client detects drop, attempts reconnect, receives fresh authoritative state, reconciles local state (never trusts its own stale copy)
- **Instructor authorization** — a session-scoped instructor token issued at creation; WS server rejects `PLAY`/`PAUSE`/`SEEK` from any connection that isn't holding it

**Test this before touching the frontend.** Use wscat, Postman, or a throwaway script to send raw events and confirm: stale events get rejected, non-instructor state changes get rejected, late-join returns the correct calculated position.

**Keep lean:** no complex session lifecycle state machine beyond `CREATED → LIVE → ENDED` as a plain status field. Don't build a general-purpose event-sourcing system, just enough versioning to prove correctness.

---

## Phase 3 — Redis Pub/Sub

**Build:**
- Move state broadcast from in-process to a Redis pub/sub channel per session, so the design is provably ready for multiple backend instances
- Use Redis for ephemeral session state and presence (who's connected), not durable data

**Keep lean:** one pub/sub pattern is enough. No Redis Streams, no complex presence TTL tuning. Document in the README exactly which Redis responsibilities you used and why, that's worth more than extra Redis features.

---

## Phase 4 — Frontend

**Build:**
- `/create` — name + YouTube URL inputs, validation, redirect to `/training/:sessionId` on success
- `/training/:sessionId` — embedded YouTube player (IFrame API), playback controls, participant list, connection status badge, shareable link
- Wire the player's user-generated events to `PLAY`/`PAUSE`/`SEEK` sends, and programmatic sync updates to player method calls only (this is where loop prevention has to hold on the client side too)

**De-risk early:** spike the YouTube IFrame integration in isolation before Phase 4 properly starts (can run in parallel with Phase 1-2), since it's the one part of the frontend with real unknowns.

**Keep lean:** connection status is a single badge with three states (connected / reconnecting / disconnected), not four. Presence is a plain name list with a count, no per-user reconnecting indicators or animations. No responsive-design deep dive, functional and clean is enough.

---

## Phase 5 — Infrastructure

**Build:**
- `docker-compose.yml`: frontend, backend, postgres, redis, running with one `docker compose up`
- Single production Dockerfile for the backend (multi-stage: build, then slim runtime)
- GitHub Actions workflow: install → lint → test → build on push/PR
- Targeted unit tests only on the highest-value logic: state version handling, stale-event rejection, YouTube URL validation. Skip chasing full test coverage.

**Keep lean:** no k8s manifests, no multi-environment config management. `.env` files and Compose are enough for this scope.

---

## Phase 6 — Documentation

**Build (do this last, once you've actually lived through the trade-offs):**
- README: prerequisites, env vars, startup, how to access the app
- Simple architecture diagram (the one in the spec doc is fine to adapt)
- Short explanation of the sync model, and why the version field and instructor-token check exist
- Known limitations and a brief production-scaling discussion (this is where the Redis pub/sub design pays off, you can honestly say "this is built to extend to multiple backend instances")

**Keep lean:** no polished diagram tooling investment, a clear hand-drawn-equivalent diagram beats a slick one that took three hours.

---

## Cut list (deliberately out of scope for this deadline)

- Full automated test suite (test the sync/versioning logic only)
- Elaborate session-ended flow beyond a basic status change
- Kubernetes manifests, LLM integration, microservices split
- Full user accounts/OAuth (the instructor token is enough)
- Exhaustive error-handling for every infra failure mode listed in the original spec (DB down, Redis down) — document the reasoning, don't build full resilience for a portfolio project
