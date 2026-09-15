# Technical Design Answers

## 1. Approach, Learning Order, and Difficulties

I started with the core synchronization path because it is the highest-risk part of the application. I first traced the flow from an instructor playback command, through the REST/WebSocket server and PostgreSQL, to the participant's YouTube player. This established the central rule: the server owns the authoritative playback state, while browsers only apply server snapshots.

I then worked on the supporting pieces in this order:

1. Session creation, retrieval, joining, and lifecycle APIs.
2. Persistent playback state with version numbers and timestamps.
3. Instructor authorization for playback commands.
4. WebSocket broadcasting and late-join state delivery.
5. Client-side YouTube player control and loop prevention.
6. Drift reconciliation, clock synchronization, tests, and Docker deployment.

The main unexpected difficulty was a subtle clock problem. The client was calculating the effective position with its own local wall clock while the stored playback timestamps came from the server. A client clock that was slightly behind or ahead could create a persistent sync bias that remained hidden inside the tolerance band.

I resolved this with a lightweight clock-sync handshake. The client sends a timestamp, the server responds with its timestamp, and the client estimates the server offset using half of the measured round-trip time. The client then uses server-adjusted time when calculating the current playback position.

A second practical difficulty appeared during Dockerization: both client and server import `shared/playbackSync.js`, but each service originally built from its own subdirectory. The Docker builds were updated to use the repository root as context and include the shared module.

## 2. Seeking to Different Times

Seeking is instructor-controlled. The instructor enters a target position in the playback controls, and the client sends a playback seek command to the server. The server validates the command, writes the new position to PostgreSQL, increments the playback version, marks the state as paused or playing according to the current session behavior, and broadcasts the resulting authoritative snapshot to every connected client.

Each client applies the snapshot by calling the YouTube IFrame API's `seekTo(position, true)`. The second argument requests an allowed-to-play seek, and the player then reconciles its play/pause state with the authoritative state.

The implementation deliberately does not trust a local seek as the final truth. The instructor's local action becomes authoritative only after the server accepts and broadcasts it. This prevents different clients from independently deciding what the session position should be.

Other approaches considered:

- **Broadcast the seek directly from the instructor to participants:** simpler and lower latency, but unreliable because clients could miss messages, accept unauthorized commands, or disagree after reconnecting.
- **Use frequent absolute position broadcasts:** improves correction after packet loss, but creates more traffic and can cause visible seeking or playback jitter.
- **Use playback-rate correction only:** avoids hard seeks, but takes too long to correct a large jump and is unsuitable for an intentional instructor seek.
- **Use WebRTC data channels:** potentially lower latency for peer communication, but introduces peer-management complexity and still requires a server authority for authorization, persistence, and reconnect recovery.

The current approach favors correctness and recoverability. YouTube seeking is not frame-exact, so small differences around keyframes are expected.

## 3. How New Users Know What Time to Join

New users do not choose a join time manually. When a participant opens the session URL, the application:

1. Fetches the session metadata.
2. Opens a WebSocket connection for the session.
3. Receives the current playback snapshot immediately from the server.
4. Requests a fresh playback snapshot after the connection is established.
5. Initializes the YouTube player from that snapshot.

The snapshot contains the stored position, whether the session is playing, the state version, the state update time, and a server timestamp. If the session is playing, the client adds the elapsed time since the server update to the stored position before seeking.

Other approaches considered:

- **Start every participant at position zero:** easy to implement, but late users would not join the live training at the current point.
- **Ask users to manually enter a timestamp:** gives users control, but defeats the shared-session experience and creates avoidable errors.
- **Have the instructor announce a timestamp:** useful as a fallback, but slow and inaccurate compared with an authoritative snapshot.
- **Send periodic full video-position broadcasts:** can improve recovery, but uses more bandwidth than sending state changes plus local elapsed-time calculation.

The current snapshot-plus-elapsed-time approach is efficient and gives a late user the correct logical join position without requiring the server to stream constant position updates.

## 4. Accuracy of New-User Synchronization and Edge Cases

The system provides practical synchronization, not a mathematical guarantee of perfect frame-level synchronization.

The join calculation is:

```text
current position = stored position + elapsed server time
```

For a playing state, the client calculates elapsed time using a server-adjusted clock. The clock-sync handshake estimates the difference between the browser clock and the server clock using RTT/2. The client then applies the position when the YouTube player becomes ready.

The server also sends the initial state immediately on WebSocket connection, and the client requests another snapshot after connecting. Version checks prevent an older snapshot from replacing a newer one.

Important edge cases remain:

- **Network latency and jitter:** RTT/2 assumes roughly symmetric network delay. Cellular or congested networks may violate that assumption.
- **YouTube startup delay:** the player may become ready seconds after the snapshot. The client recalculates effective position at application time so it does not seek to a stale position.
- **Clock changes:** a user or operating system changing the wall clock can temporarily affect the estimate. The client refreshes the estimate periodically.
- **Background tabs:** browsers may throttle timers and delay WebSocket or player work. Reconnection and fresh state requests help recovery when the tab becomes active again.
- **Lost messages or reconnects:** a reconnecting client requests authoritative state rather than trusting its old local state.
- **YouTube keyframe behavior:** `seekTo` may land near a keyframe rather than at the exact requested frame.
- **Server failure between database write and broadcast:** a production implementation would need an outbox or durable event strategy if every broadcast must be guaranteed. The current system can recover through a fresh state request, but a client may briefly remain stale.
- **Multiple server instances:** the current in-process broadcast map does not fan out between instances. Redis or another broker is required before horizontal scaling.

Therefore, the system should be described as targeting a stable sub-second to roughly 1.5-second user experience under normal conditions, not perfect synchronization.

## 5. Other Race Conditions and Out-of-Sync Cases

Several race conditions are addressed directly:

- **Out-of-order snapshots:** every playback update has a monotonically increasing version. Clients ignore older versions.
- **Duplicate same-version snapshots:** clients compare server timestamps and ignore an older duplicate.
- **Unauthorized playback commands:** only an authenticated instructor connection may play, pause, seek, or request an instructor-only resync.
- **Programmatic playback loops:** client reconciliation applies server state without treating that application as a new user command.
- **Rapid instructor commands:** the server serializes database updates through the authoritative state write path and broadcasts the resulting versions. Clients converge on the newest version.
- **Late player readiness:** playback messages can arrive before the YouTube player is ready. The player keeps the latest playback state in a ref and applies it on `onReady`.
- **Reconnect with stale local state:** the client requests a fresh server snapshot and does not use its prior local position as authority.
- **Pause/play timing:** the server stores a fresh position when changing state, so elapsed time is added only while the authoritative state is playing.

Production traffic can still expose additional cases:

- A client can disconnect after receiving a command but before receiving the next broadcast.
- A server can crash after a database commit but before a WebSocket broadcast.
- Two commands can arrive very close together and be observed in different orders by different network paths.
- A browser can suspend JavaScript while the video element or iframe behaves differently.
- A slow client may apply an old message after a newer one unless every message continues to pass version validation.

The recovery principle is consistent: persist the authoritative state, version every transition, reject stale updates, and request a fresh snapshot after reconnect or visibility recovery.

## 6. Productionizing for 1M+ DAUs and 10,000 Users in One Session

The current Docker setup is suitable for development and a small deployment. It is not sufficient for 1M+ daily active users or 10,000 concurrent users in one session. I would scale the system in several layers.

### Infrastructure

- Put the client behind a CDN and serve immutable frontend assets from object storage or an edge platform.
- Run stateless API/WebSocket instances behind a load balancer with WebSocket support and connection draining.
- Add Redis, NATS, Kafka, or a managed pub/sub service for cross-instance session broadcasts.
- Use a managed PostgreSQL cluster with replicas, automated backups, connection pooling, monitoring, and partitioning or archival for participant history.
- Use a dedicated WebSocket gateway tier if connection counts become too high for the API processes.
- Add service discovery, autoscaling, health checks, distributed tracing, metrics, centralized logs, and alerting.
- Use rate limiting and abuse protection at the edge and API gateway.
- Store secrets in a secret manager rather than environment files committed to deployment systems.
- Separate development, staging, and production databases and deployment configurations.

### Backend and Data Model

- Keep session metadata and durable playback state in PostgreSQL, but move high-frequency ephemeral state and presence to Redis or a purpose-built real-time store.
- Use a session actor or partitioning model so commands for one session are processed in order by one logical owner.
- Add an outbox or transactional event log so a committed state transition cannot be lost before broadcast.
- Make commands idempotent with command IDs and client sequence numbers.
- Add optimistic concurrency checks or database transactions around version updates.
- Avoid writing every player tick to PostgreSQL. Persist only meaningful transitions such as play, pause, seek, and periodic checkpoints.
- Use compact binary or efficiently encoded messages when message volume makes JSON overhead material.
- Batch or coalesce broadcasts for very large sessions where appropriate, while preserving command ordering.
- Add authorization and session membership checks at the gateway, not only in the browser.
- Track presence with TTLs and heartbeats rather than treating database participant rows as live presence.

### Handling 10,000 Users in One Session

A single instructor command should become one ordered session event, not 10,000 independent database writes. The session broker should fan that event out to subscribed WebSocket workers, which deliver it to their connected clients.

For a large room, the server should avoid sending unnecessary per-user presence updates to every participant. Presence can be aggregated into counts or sampled summaries. Playback state is small and infrequent compared with video media, so the application should not proxy the video itself; every browser should load the YouTube media directly.

Use backpressure controls, connection limits, heartbeat timeouts, and message-size limits. A slow client should be disconnected or moved through a recovery path rather than allowing it to consume unbounded server memory.

### UX and Product Behavior

- Show connection and synchronization status clearly: connected, catching up, reconnecting, or unable to sync.
- Show a short loading state while the YouTube iframe initializes.
- Allow a participant to recover with a visible “sync now” action without affecting the whole room.
- Make instructor actions visibly authoritative and show when a command is still being acknowledged.
- Preserve the latest known session state during temporary outages, but label it as stale.
- Provide session capacity and participant-count feedback before a room reaches operational limits.
- Offer a controlled fallback for degraded mode, such as pausing new joins or switching to a read-only state while the real-time service recovers.
- Add operational dashboards for connection count, message latency, drift reports, reconnect rate, command failures, and YouTube readiness time.

At that scale, the core synchronization model can remain the same, but its transport and persistence boundaries must become distributed, observable, ordered, and resilient to partial failure.
