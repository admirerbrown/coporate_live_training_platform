# Corporate Live Training Platform

A focused full-stack application for instructor-led YouTube training sessions. An instructor controls playback and connected participants follow the same authoritative session state in real time.

## What It Does

- Creates a session with a name and YouTube URL.
- Gives the instructor a session-scoped control token.
- Lets participants join through a shareable URL.
- Synchronizes play, pause, seek, and late-join position over WebSockets.
- Persists session and playback state in PostgreSQL.
- Corrects client/server clock differences with a lightweight clock-sync handshake.
- Reconciles normal playback drift without constantly seeking the player.

## Architecture

```text
Browser (React + YouTube IFrame API)
        | REST and WebSocket
        v
Node.js + Express + ws
        |
        v
PostgreSQL
```

The server is authoritative. Playback commands are accepted only from an authenticated instructor connection. Each update increments a version, and clients ignore older or duplicate snapshots.

For a playing session, the server stores the position and timestamp of the last state change. The client calculates the current effective position using the server timestamp and its measured clock offset. Drift is handled in three bands: small drift is ignored, moderate drift uses a temporary playback-rate adjustment, and large drift seeks directly.

## Quick Start With Docker

Prerequisite: Docker with the Compose plugin.

```bash
docker compose up --build
```

Open the client at [http://localhost:8080](http://localhost:8080). The API is available at [http://localhost:3000](http://localhost:3000), and the health check is [http://localhost:3000/api/health](http://localhost:3000/api/health).

Stop the stack with:

```bash
docker compose down
```

To remove the persisted PostgreSQL volume as well:

```bash
docker compose down -v
```

The server container applies `server/db/schema.sql` before starting. PostgreSQL data is stored in the `postgres_data` Compose volume.

## Local Development

Prerequisites: Node.js 22+, npm, and PostgreSQL.

1. Create a database and copy `.env.example` to `.env`, then adjust `DATABASE_URL` if needed.
2. Install dependencies:

   ```bash
   cd server && npm ci
   cd ../client && npm ci
   ```

3. Apply the schema and start the API:

   ```bash
   cd server
   npm run migrate
   npm run dev
   ```

4. In a second terminal, start the Vite client:

   ```bash
   cd client
   npm run dev
   ```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` and `/ws` to the local server. `VITE_API_BASE_URL` can remain empty for this setup; `VITE_WS_BASE_URL` defaults to `ws://localhost:3000` in the example environment.

## API Surface

- `POST /api/sessions` creates a session and returns the instructor token.
- `GET /api/sessions/:sessionId` returns session metadata and playback state.
- `POST /api/sessions/:sessionId/join` records a participant join.
- `POST /api/sessions/:sessionId/start` starts a session with the instructor token.
- `POST /api/sessions/:sessionId/end` ends a session with the instructor token.
- `GET /api/health` reports service health.
- `GET /ws?sessionId=<id>` opens the real-time session connection.

WebSocket playback commands require the instructor token. Participants can receive state and request a fresh snapshot but cannot control playback.

## Testing and Build Checks

```bash
cd client
npm test
npm run lint
npm run build

cd ../server
npm test
```

The client tests cover the player, session flow, WebSocket client, clock-offset state, and synchronization behavior. The server tests cover REST lifecycle operations, validation, authorization, broadcast behavior, and playback timing.

## Environment Variables

See [.env.example](.env.example). Docker Compose supplies its own values:

- `DATABASE_URL`: PostgreSQL connection string used by the server.
- `PORT`: API and WebSocket port.
- `CLIENT_ORIGIN`: allowed browser origin for CORS.
- `VITE_API_BASE_URL`: API origin embedded into the client build.
- `VITE_WS_BASE_URL`: WebSocket origin embedded into the client build.

## Known Limitations

- YouTube startup time depends on the browser, network, and YouTube iframe resources.
- `seekTo` is not frame-exact, and the application intentionally tolerates small drift instead of constantly seeking.
- Instructor authentication is session-scoped rather than a full user-account system.
- Presence is persisted as participant join records; there is no separate live participant dashboard.
- Redis and multi-instance broadcast are not implemented. The current WebSocket broadcast is process-local, which is appropriate for the single-server Docker setup.

## Repository Layout

```text
client/       React/Vite frontend and browser tests
server/       Express, WebSocket, PostgreSQL access, and server tests
shared/       Playback calculations shared by client and server
docker-compose.yml
```
