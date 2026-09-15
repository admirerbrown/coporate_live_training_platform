# Corporate Live Training Platform

> A real-time, instructor-led training experience where learners stay in sync with the session host without rewatching or drifting out of time.

## Demo Video

Watch the product walkthrough here: [Loom demo](https://www.loom.com/share/9f5c7e9fcbf44673a7fc8e114ac44b4a)

## The Problem with Standard Remote Training

Most online training experiences are fragmented. Participants join on different devices, video playback drifts, and the instructor loses control of the room once the content starts. In a live learning environment, that means:

- learners fall out of sync with the presenter
- pause and seek actions are inconsistent across participants
- late joiners miss the context of the current lesson
- the teaching flow becomes unpredictable whenever the video falls behind

We needed a platform that behaves more like a live classroom than a passive video stream.

## What This Platform Solves

This platform gives the instructor a single source of truth and keeps every connected participant aligned to the same authoritative playback state.

It lets teams:

- create a training session with a YouTube lesson
- generate a shareable session link for participants
- control playback in real time from the instructor view
- keep all participants synchronized on play, pause, seek, and late-join state
- persist session state in PostgreSQL for a reliable source of truth
- manage clock differences between browser and server for smooth playback continuity

---

## Core Features

### 1. Instructor-Led Session Control

The instructor acts as the single authority for playback. Only authenticated instructor connections can issue play, pause, or seek commands.

### 2. Real-Time Participant Synchronization

Participants receive live updates through WebSockets and follow the instructor's session state without manual resyncing.

### 3. Late-Join Recovery

A participant joining mid-session receives the current playback state immediately, so they can land in the right place instead of watching the wrong point in the video.

### 4. Drift Correction

The application compensates for browser/server clock differences and minor playback drift with a lightweight synchronization strategy that reduces unnecessary seeking.

### 5. Persistent Session State

Sessions, metadata, and playback state are stored in PostgreSQL so the platform can recover cleanly and behave consistently across refreshes.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite |
| Client Runtime | YouTube IFrame API |
| API | Node.js + Express |
| Real-Time Sync | WebSockets (`ws`) |
| Database | PostgreSQL |
| Validation & Testing | Vitest + Supertest |
| Containerization | Docker + Compose |

---

## System Architecture

The platform follows a simple but robust model: the server is authoritative, and the browser clients follow it.

```text
Browser (React + YouTube IFrame API)
        | REST + WebSocket
        v
Node.js + Express + ws
        |
        v
PostgreSQL
```

The server accepts playback commands only from the authenticated instructor connection. Each state change increments a version, and clients ignore stale or duplicate snapshots. This keeps the system deterministic and prevents competing control inputs from desynchronizing the room.

For active sessions, the server stores the latest playback position and timestamp. The client calculates the effective playback position using the server timestamp and the measured offset between client and server clocks. Drift is corrected in stages: small drift is tolerated, moderate drift triggers a subtle rate adjustment, and major drift is resolved with a direct seek.

---

## How It Works

### Session Creation

The instructor creates a session with a name and a YouTube URL. The server stores the recording and issues a session-scoped control token.

### Participant Join Flow

Participants join through a shareable URL. The backend records the join and serves the current session state so the participant lands on the same point in the lesson.

### Playback Synchronization

When the instructor plays, pauses, or seeks, the server broadcasts the new authoritative state to every client. Participants apply the update, while the client still maintains local playback safety for browser timing differences.

---

## Quick Start with Docker

Prerequisites: Docker with the Compose plugin installed.

```bash
docker compose up --build
```

Once the stack is running:

- Client: http://localhost:8080
- API: http://localhost:3000
- Health check: http://localhost:3000/api/health

To stop the stack:

```bash
docker compose down
```

To remove the persisted PostgreSQL volume as well:

```bash
docker compose down -v
```

The server automatically applies the schema from `server/db/schema.sql` before starting, and PostgreSQL data persists in the `postgres_data` Compose volume.

---

## Local Development

Prerequisites: Node.js 22+, npm, and PostgreSQL.

### 1. Prepare the environment

Create a database and copy `.env.example` to `.env`, then adjust `DATABASE_URL` if needed.

### 2. Install dependencies

```bash
cd server && npm ci
cd ../client && npm ci
```

### 3. Apply the schema and start the API

```bash
cd server
npm run migrate
npm run dev
```

### 4. Start the client

In a second terminal:

```bash
cd client
npm run dev
```

The app is available at http://localhost:5173. Vite proxies `/api` and `/ws` to the local server. The client can run with empty `VITE_API_BASE_URL` values in local development, and `VITE_WS_BASE_URL` defaults to `ws://localhost:3000` in the example environment.

---

## API Surface

- `POST /api/sessions` creates a session and returns the instructor token
- `GET /api/sessions/:sessionId` returns session metadata and playback state
- `POST /api/sessions/:sessionId/join` records a participant join
- `POST /api/sessions/:sessionId/start` starts a session with the instructor token
- `POST /api/sessions/:sessionId/end` ends a session with the instructor token
- `GET /api/health` reports service health
- `GET /ws?sessionId=<id>` opens the real-time session connection

WebSocket playback commands require the instructor token. Participants can receive session state and request a fresh snapshot, but they cannot issue playback instructions.

---

## Testing and Build Checks

```bash
cd client
npm test
npm run lint
npm run build

cd ../server
npm test
```

The client test suite covers the player, session flow, WebSocket client behavior, timing state, and synchronization logic. The server tests cover REST lifecycle operations, validation, authorization, playback timing, and broadcast behavior.

---

## Environment Variables

See [.env.example](.env.example) for the local setup template. Docker Compose injects its own values for the containerized environment.

- `DATABASE_URL`: PostgreSQL connection string used by the API server
- `PORT`: application port for the API and WebSocket server
- `CLIENT_ORIGIN`: allowed browser origin for CORS
- `VITE_API_BASE_URL`: API origin embedded into the client build
- `VITE_WS_BASE_URL`: WebSocket origin embedded into the client build

---

## Known Limitations

- YouTube startup time depends on browser performance, network speed, and iframe load conditions
- `seekTo` is not perfectly frame-exact, so the platform intentionally tolerates small drift rather than constantly seeking
- Instructor authentication is session-scoped, not a full user-account model
- Presence is recorded as join events, not as a dedicated live participant dashboard
- Redis and multi-instance broadcasting are not yet implemented; the current WebSocket broadcast is process-local, which matches the single-server Docker deployment

---

## Repository Structure

```text
client/       React + Vite frontend and browser tests
server/       Express API, WebSocket layer, PostgreSQL access, and server tests
shared/       Playback synchronization logic shared by client and server
docker-compose.yml
README.md
.env.example
```

---

## Roadmap

- [ ] Add richer participant presence and attendance tracking
- [ ] Add improved reconnection handling for dropped WebSocket clients
- [ ] Expand session analytics and lesson metadata
- [ ] Support additional video providers beyond YouTube

---

## License

This project is licensed under the MIT License.

---

*Built for modern, instructor-led digital training.*
