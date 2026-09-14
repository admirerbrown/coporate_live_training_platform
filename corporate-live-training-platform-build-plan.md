# Corporate Live Training Platform Build Plan

## Delivered

- React/Vite client with instructor and participant session flows.
- Express REST API backed by PostgreSQL.
- WebSocket session transport with instructor authorization.
- Server-authoritative playback state with version ordering.
- Late-join and reconnect state requests.
- Clock-sync handshake that estimates client/server offset using RTT.
- Drift reconciliation with tolerance, playback-rate correction, and hard seeking.
- YouTube API preload, connection preconnect, and player loading feedback.
- Client and server test suites.
- Docker Compose setup for client, server, and PostgreSQL.

## Current Runtime Architecture

The Docker stack runs one Nginx-served client, one Node.js server, and one PostgreSQL database. The server applies the schema on startup. The browser connects to the published server port, while the server connects to PostgreSQL through the Compose service name.

## Sync Model

1. The server stores `position`, `is_playing`, `version`, and `updated_at`.
2. An instructor command updates the row and broadcasts a snapshot.
3. A playing client adds elapsed server time to the stored position.
4. The client estimates server time through `clock:sync` messages and RTT/2.
5. Snapshots with older versions are ignored.
6. Reconciliation keeps small drift untouched, rate-corrects moderate drift, and seeks large drift.

This targets a stable, usable training experience rather than frame-perfect synchronization, which is not guaranteed by the YouTube IFrame API.

## Deliberate Non-Goals

- Redis pub/sub and multi-instance WebSocket fan-out.
- Full user accounts, SSO, or enterprise administration.
- Video hosting or upload support.
- SCORM, certificates, payments, or analytics.
- Kubernetes or multi-environment deployment management.

These can be added later without changing the core playback contract, but they are not required for the current single-server product.

## Verification Checklist

```bash
docker compose config
docker compose up --build
curl http://localhost:3000/api/health
```

For local checks, run the client tests/build and server tests described in the repository [README](README.md).
