# Corporate Live Training Platform
## Full-Stack Portfolio Project — Requirements & User Stories

**Status:** Draft v1.0  
**Purpose:** Portfolio project demonstrating full-stack, real-time, distributed-state and production-oriented engineering.

---

# 1. Product Overview

## 1.1 What are we building?

A web-based **Corporate Live Training Platform** that allows an instructor to host a live training session for a distributed group of employees.

An instructor creates a training session around a YouTube-hosted training video. Employees join the session through a shareable link.

Once participants are connected, the training experience is synchronized in real time.

If the instructor:

- starts the training video,
- pauses it,
- seeks to another point,

the same state is reflected for all participants.

A participant who joins after the training has already started should automatically receive the current training state and be synchronized with the rest of the session.

The application is therefore both:

1. A useful corporate training product concept; and
2. A demonstration of real-time multi-client synchronization.

---

# 2. Project Motivation

The project is intentionally designed around a non-trivial full-stack engineering problem:

> **How do we maintain a consistent shared state across multiple independently running browser clients in real time?**

The original Nooks challenge uses collaborative video watching to explore this problem.

This project applies the same underlying engineering challenge to an instructor-led corporate training scenario.

The goal is **not** to build a complete enterprise Learning Management System.

The goal is to build a focused, technically rigorous live-training application that demonstrates:

- frontend engineering
- backend engineering
- REST API design
- WebSocket communication
- shared state management
- real-time synchronization
- persistence
- concurrency handling
- reconnection
- late-join synchronization
- testing
- containerization
- CI/CD
- architectural reasoning

---

# 3. Product Goal

Enable a distributed training group to participate in the same live training session while maintaining a consistent view of the instructor-controlled training content.

### Primary success criterion

If multiple participants are connected to the same training session, their training player should remain synchronized regardless of:

- who joined first,
- who joined late,
- temporary network interruptions,
- normal play/pause/seek interactions,
- multiple clients generating events.

---

# 4. Scope

## 4.1 In Scope

### Training Sessions

- Create a training session.
- Give the session a name.
- Provide a YouTube training-video URL.
- Generate a unique session ID.
- Generate a shareable session URL.
- Redirect the creator into the live training room.
- Allow participants to join an existing session.

### Live Training

- Display the embedded YouTube training video.
- Play the training video.
- Pause the training video.
- Seek to another point in the video.
- Synchronize playback state between participants.
- Synchronize playback position.
- Synchronize newly joined participants.
- Maintain a server-authoritative session state.
- Detect participant connections/disconnections.
- Support participant reconnection.
- Prevent synchronization feedback loops.
- Handle stale or out-of-order events.

### Participants

- Join through a shareable link.
- See the current training session.
- See other active participants.
- See whether the session is currently playing or paused.
- See the current training position.
- Receive real-time state updates.

### Instructor

- Create the training session.
- Start the training.
- Pause the training.
- Seek to a specific training point.
- Control the shared training state.

### Backend

- Session creation API.
- Session retrieval API.
- Session join functionality.
- WebSocket connection handling.
- Session state management.
- Participant presence management.
- Validation.
- Error handling.

### Persistence

PostgreSQL stores durable application data including:

- training sessions
- session metadata
- participants/users where applicable
- session history/metadata

### Real-Time Infrastructure

WebSockets provide real-time communication between:

- browser clients
- backend server
- connected session participants

Redis may be used for:

- ephemeral session state
- presence
- pub/sub
- coordinating multiple backend instances

### Infrastructure

- Docker
- Docker Compose
- environment-based configuration
- GitHub Actions
- automated tests
- linting/build checks

---

# 5. Explicit Non-Goals

This is **not** intended to become a complete LMS.

The following are outside the initial scope:

- video hosting
- video uploading
- SCORM support
- certificates
- HR/payroll integrations
- enterprise SSO
- advanced employee analytics
- payment processing
- complex course authoring
- mobile applications
- AI tutoring
- AI-generated training material
- enterprise administration suites

These may be future extensions but should not distract from the core real-time engineering problem.

---

# 6. Core User Roles

## 6.1 Instructor

The person responsible for conducting the live training session.

Capabilities:

- create training sessions
- start/stop training
- control playback
- seek through training content
- monitor connected participants
- end the session

## 6.2 Participant

An employee attending the training session.

Capabilities:

- join a session
- view the training content
- receive synchronized state
- see active participants
- reconnect to an active session

For the initial version, the instructor is the authoritative controller of the shared training state.

---

# 7. Core User Flow

## Flow A — Create Training Session

```text
Instructor
    ↓
Open /create
    ↓
Enter training name
    ↓
Enter YouTube training video URL
    ↓
Submit
    ↓
Backend creates session
    ↓
Unique session ID generated
    ↓
Instructor redirected to /training/:sessionId
```

---

# 8. Flow B — Join Training Session

```text
Participant receives shareable link
              ↓
      /training/:sessionId
              ↓
        Backend validates
              ↓
      WebSocket connection
              ↓
 Receive current session state
              ↓
Initialize player
              ↓
Participant becomes synchronized
```

---

# 9. Flow C — Start Training

```text
Instructor clicks Play
        ↓
Frontend detects play event
        ↓
Client sends event to server
        ↓
Server validates event
        ↓
Server updates authoritative state
        ↓
Server broadcasts state update
        ↓
All connected participants receive update
        ↓
All players begin playback
```

---

# 10. Flow D — Pause Training

```text
Instructor clicks Pause
        ↓
Client sends PAUSE event
        ↓
Server updates session state
        ↓
Server broadcasts PAUSE
        ↓
All connected participants pause
```

---

# 11. Flow E — Seek

```text
Instructor moves player
        ↓
Client detects seek
        ↓
Client sends SEEK event
        ↓
Server validates target position
        ↓
Server updates authoritative position
        ↓
Server broadcasts new state
        ↓
All clients seek to same position
```

---

# 12. Flow F — Late Participant

Example:

```text
Training currently:

Playing
Position: 18:42
```

A new employee joins.

The new client must **not** start at 00:00.

Instead:

```text
New client connects
        ↓
Server retrieves current state
        ↓
Server returns:

status: playing
position: 18:42
serverTimestamp: ...
        ↓
Client calculates current position
        ↓
Player starts at correct position
```

The system should account for the time elapsed between the server's state snapshot and the client applying it.

---

# 13. Synchronization Model

The backend is the **authoritative source of truth** for the live session state.

A session state should conceptually contain:

```text
sessionId
videoId
status
position
updatedAt
updatedBy
version
```

Where:

### status

One of:

```text
playing
paused
```

### position

Current video position in seconds.

### updatedAt

Server-side timestamp indicating when the state became authoritative.

### updatedBy

Participant/instructor responsible for the latest state transition.

### version

Monotonically increasing state version used to help identify stale/out-of-order updates.

---

# 14. Real-Time Events

The WebSocket layer should support events equivalent to:

## Client → Server

```text
SESSION_JOIN
PLAY
PAUSE
SEEK
PING / HEARTBEAT
RECONNECT
```

## Server → Client

```text
SESSION_STATE
PLAYER_PLAY
PLAYER_PAUSE
PLAYER_SEEK
PARTICIPANT_JOINED
PARTICIPANT_LEFT
SESSION_ENDED
ERROR
```

The exact event naming is an implementation decision.

---

# 15. Synchronization Requirements

## Requirement SR-01 — Play

When the instructor starts playback:

- server receives the play event
- server updates authoritative state
- all connected clients receive the new state
- clients begin playback

## Requirement SR-02 — Pause

When the instructor pauses:

- server records the current position
- state becomes paused
- all connected clients pause at the corresponding position

## Requirement SR-03 — Seek

When the instructor seeks:

- target position is transmitted
- server validates it
- server updates authoritative state
- all clients seek to that position

## Requirement SR-04 — Late Join

A newly connected participant must receive enough information to reconstruct the current state.

If the session is:

```text
playing @ 15:30
```

the new participant should join approximately at the current playback position rather than the beginning.

## Requirement SR-05 — Reconnection

If a participant temporarily loses their WebSocket connection:

- the client should attempt to reconnect
- the server should send the current authoritative state
- the client should resynchronize
- stale local state must not override current server state

---

# 16. Preventing Synchronization Loops

A critical implementation concern:

```text
Server sends PLAY
      ↓
Client plays video
      ↓
Player emits PLAY event
      ↓
Client sends PLAY back to server
      ↓
Server broadcasts PLAY
      ↓
...
```

The implementation must distinguish between:

1. **User-generated player events**
2. **Programmatic player state changes caused by synchronization**

The latter must not generate another broadcast cycle.

---

# 17. Race Conditions

The system must consider concurrent actions.

Example:

```text
Instructor → PLAY

Participant → PAUSE
```

arriving almost simultaneously.

The architecture must define:

- event ordering
- authoritative state
- stale-event handling
- state versioning
- whether only the instructor can issue state-changing commands
- what happens when an event arrives after a newer state has already been committed

For this project, the recommended initial model is:

> **The instructor is the authoritative actor for player state changes.**

Participants receive synchronized state but do not independently control the shared training player.

This preserves the Nooks synchronization challenge while making the business model coherent.

---

# 18. Player Requirements

The training video must be embedded directly in the application.

The implementation may use:

- YouTube IFrame API
- React player library
- another appropriate YouTube-compatible player integration

The player must expose:

- play
- pause
- seek
- current playback position
- playback state

Controls should be intuitive and behave as expected.

---

# 19. Frontend Requirements

Technology:

```text
React
TypeScript
```

Required routes:

```text
/create

/training/:sessionId
```

## /create

Must provide:

- training session name input
- YouTube URL input
- validation
- create action
- useful error feedback

After successful creation:

```text
/create
   ↓
/training/:sessionId
```

## /training/:sessionId

Must provide:

- training title
- video player
- playback controls
- participant list/presence
- connection status
- session status
- useful errors
- shareable session link

---

# 20. Backend Requirements

Technology:

```text
Node.js
TypeScript
```

Responsibilities:

- session creation
- session retrieval
- session validation
- participant management
- WebSocket connections
- authoritative session state
- state broadcasting
- synchronization
- reconnection
- validation
- error handling

The backend should not rely on the browser as the authoritative source of truth.

---

# 21. REST API

Initial API design:

### Create Session

```http
POST /api/sessions
```

Request:

```json
{
  "name": "Engineering Onboarding",
  "youtubeUrl": "https://youtube.com/watch?v=..."
}
```

Response:

```json
{
  "id": "abc123",
  "name": "Engineering Onboarding",
  "youtubeUrl": "https://youtube.com/watch?v=..."
}
```

### Get Session

```http
GET /api/sessions/:sessionId
```

Returns session metadata and current relevant state.

### Health Check

```http
GET /api/health
```

Returns service health.

Additional endpoints may be introduced only when justified by the application's needs.

---

# 22. Database

PostgreSQL is the primary persistent database.

Initial conceptual schema:

```text
users
-----
id
name
email
role
created_at


training_sessions
-----------------
id
name
youtube_url
created_by
status
created_at
updated_at


session_participants
--------------------
id
session_id
user_id
joined_at
left_at
```

The exact schema should evolve based on implementation requirements.

We should avoid adding tables simply to demonstrate PostgreSQL.

---

# 23. Redis

Redis should have a meaningful role rather than being included only because a job description mentions it.

Potential uses:

### Ephemeral session state

Fast access to active session information.

### Presence

Track active connections.

### Pub/Sub

Support broadcasting across multiple backend instances.

### Future horizontal scaling

```text
WebSocket Server A
        │
        ├── Redis Pub/Sub
        │
WebSocket Server B
        │
        └── Redis Pub/Sub
```

The final implementation should document exactly which Redis responsibilities are used and why.

---

# 24. Docker

The application must be runnable locally using Docker Compose.

Expected services:

```text
frontend
backend
postgres
redis
```

Example:

```bash
docker compose up
```

The README must explain:

- prerequisites
- environment variables
- startup
- database initialization
- how to access the application

---

# 25. Testing

Testing should cover the most important system behavior rather than simply maximizing test count.

## Unit Tests

Examples:

- YouTube URL validation
- session state transitions
- event validation
- state version handling
- playback-position calculations

## Integration Tests

Examples:

- create session
- retrieve session
- join session
- state transition
- persistence

## Real-Time Tests

Examples:

- instructor plays → participant receives play
- instructor pauses → participant receives pause
- instructor seeks → participant receives seek
- late participant receives current state
- reconnecting participant resynchronizes
- stale event does not overwrite newer state

---

# 26. Error Handling

The system must handle at least:

- invalid YouTube URL
- invalid session ID
- session does not exist
- malformed WebSocket event
- disconnected client
- failed reconnection
- stale state
- invalid seek position
- backend failure
- database failure
- Redis failure
- YouTube player failure

Errors should be:

- logged appropriately
- surfaced to the user when relevant
- prevented from crashing the entire session

---

# 27. Connection Management

The client should display a meaningful connection state:

```text
Connected
Connecting...
Reconnecting...
Disconnected
```

When reconnecting:

```text
Client reconnects
       ↓
Server authenticates/identifies connection
       ↓
Server returns authoritative state
       ↓
Client reconciles local state
       ↓
Client becomes synchronized
```

---

# 28. Presence

Participants should be able to see who is currently connected.

Example:

```text
Live Participants

● Samuel
● Alex
● David
○ Michael — reconnecting
```

Presence should be treated as ephemeral state rather than durable business data.

---

# 29. Session Lifecycle

A session can conceptually move through:

```text
CREATED
   ↓
LIVE
   ↓
ENDED
```

### CREATED

Session exists but training has not started.

### LIVE

Participants can connect and receive synchronized state.

### ENDED

The instructor has ended the training session.

The exact lifecycle may be simplified if implementation experience shows that a smaller state machine is preferable.

---

# 30. Security & Validation

Minimum requirements:

- validate all API input
- validate WebSocket messages
- sanitize user-controlled text
- validate YouTube URLs
- never trust client-provided session state
- keep secrets in environment variables
- do not commit credentials
- restrict state-changing operations to authorized users
- prevent arbitrary users from impersonating the instructor

Authentication may be implemented using a lightweight mechanism appropriate for the portfolio scope.

---

# 31. Architecture

Initial architecture:

```text
                         ┌─────────────────────┐
                         │       Browser       │
                         │ React + TypeScript  │
                         └──────────┬──────────┘
                                    │
                       REST + WebSocket
                                    │
                         ┌──────────▼──────────┐
                         │      Node.js        │
                         │    API + WS Server  │
                         └──────┬────────┬──────┘
                                │        │
                         ┌──────▼───┐ ┌──▼─────┐
                         │PostgreSQL│ │ Redis  │
                         └──────────┘ └────────┘
```

Docker Compose runs the services locally.

GitHub Actions runs:

```text
push / pull request
       ↓
install
       ↓
lint
       ↓
test
       ↓
build
```

---

# 32. Production Architecture Discussion

The application does not need to actually operate at massive production scale for this portfolio project.

However, the architecture must demonstrate awareness of how it could scale.

The project must address the equivalent of the Nooks question:

> How would this system be reliably operated with 1M+ daily active users and 10,000 participants connected to a single training session?

Areas to discuss:

### Backend

- horizontal scaling
- load balancing
- stateless HTTP services
- dedicated WebSocket infrastructure
- connection management

### Redis

- cross-instance event propagation
- pub/sub
- distributed presence
- session state

### Database

- connection pooling
- indexes
- read replicas
- partitioning where appropriate
- avoiding unnecessary writes during playback

### WebSockets

- connection limits
- heartbeats
- reconnect/backoff
- connection draining
- sticky sessions where appropriate
- fan-out strategy

### Session fan-out

A single instructor event may need to reach thousands of participants.

We should consider:

```text
Instructor
    ↓
WebSocket Gateway
    ↓
Session Event
    ↓
Pub/Sub / Fan-out
    ↓
10,000 connected clients
```

### UX

At extreme scale, UX may need:

- degraded synchronization precision
- adaptive update frequency
- participant limits
- session moderation
- connection quality indicators

---

# 33. Architecture Questions

The final README should explicitly answer these questions.

## Q1 — Implementation Approach

How did we approach the problem?

- What did we build first?
- What assumptions did we make?
- What unexpected difficulties appeared?
- How did we resolve them?

## Q2 — Seeking

How is seeking implemented?

What alternatives were considered?

What are the trade-offs?

## Q3 — Late Join

How does a participant joining an active session know where the training currently is?

What alternatives were considered?

## Q4 — Synchronization Accuracy

How do we ensure that a participant joining an active session receives an accurate playback position?

What edge cases can still introduce drift?

## Q5 — Race Conditions & Edge Cases

Examples:

- simultaneous events
- stale events
- reconnects
- browser throttling
- network latency
- client clock differences
- duplicate events
- server restart
- Redis failure

How are these handled?

## Q6 — Production Scale

How would we redesign the application for:

```text
1M+ DAUs
10,000 participants
per training session
```

Discuss:

- infrastructure
- code
- data
- WebSockets
- Redis
- database
- observability
- UX

---

# 34. Observability

The application should provide enough information to diagnose synchronization problems.

Useful events:

```text
session.created
session.joined
session.left
session.play
session.pause
session.seek
session.reconnected
session.sync
session.error
```

Logs should include:

- session ID
- connection/client ID
- event type
- state version
- timestamp
- error information where applicable

Do not log sensitive information unnecessarily.

---

# 35. Performance Requirements

The application should feel responsive under normal local usage.

The implementation should minimize:

- unnecessary WebSocket messages
- repeated database writes
- synchronization loops
- unnecessary React renders
- excessive Redis operations

Playback position should not be persisted to PostgreSQL on every second of video playback.

The system should treat playback as primarily ephemeral real-time state and persist durable session information separately.

---

# 36. User Stories

## Instructor Stories

### US-01 — Create Training Session

**As an instructor, I want to create a training session with a name and training video so that I can host a live training session.**

Acceptance criteria:

- I can enter a session name.
- I can enter a YouTube URL.
- Invalid input is rejected.
- A unique session ID is created.
- I am redirected to the training room.

---

### US-02 — Share Training Session

**As an instructor, I want a shareable session link so that employees can join my training.**

Acceptance criteria:

- A unique session URL exists.
- I can copy the URL.
- A participant can open the URL and join the session.

---

### US-03 — Start Training

**As an instructor, I want to start the training video so that all participants begin together.**

Acceptance criteria:

- Instructor presses play.
- Backend receives the state transition.
- Connected participants receive the update.
- Participant players begin playback.

---

### US-04 — Pause Training

**As an instructor, I want to pause the training so that everyone stops at the same point.**

Acceptance criteria:

- Instructor pauses.
- Server records the authoritative position.
- Participants pause at the corresponding position.

---

### US-05 — Seek During Training

**As an instructor, I want to jump to another part of the training so that I can move the group to a specific section.**

Acceptance criteria:

- Instructor seeks.
- Server receives target position.
- All connected participants seek to the same position.

---

### US-06 — Monitor Participants

**As an instructor, I want to see who is connected so that I know who is currently attending.**

Acceptance criteria:

- Connected participants appear in the participant list.
- Participants leaving are removed or marked disconnected.
- Reconnecting participants are reflected appropriately.

---

### US-07 — End Training

**As an instructor, I want to end a training session so that participants can no longer interact with the live session.**

Acceptance criteria:

- Session enters an ended state.
- Participants receive the session-ended event.
- The UI reflects that the session has ended.

---

# 37. Participant Stories

### US-08 — Join Training

**As an employee, I want to join a training session through a shared link so that I can participate without manually configuring the session.**

Acceptance criteria:

- Valid session links open the training room.
- Invalid session IDs produce a useful error.
- The participant connects to the live session.

---

### US-09 — Receive Current Training State

**As an employee joining an active session, I want the application to place me at the current training position so that I do not have to manually catch up.**

Acceptance criteria:

- Current session state is retrieved.
- Current playback position is calculated.
- Player begins at the correct position.
- Playing/paused state is respected.

---

### US-10 — Stay Synchronized

**As an employee, I want my training player to stay synchronized with the instructor so that I experience the same training session as everyone else.**

Acceptance criteria:

- Play is synchronized.
- Pause is synchronized.
- Seek is synchronized.
- State changes arrive in real time.

---

### US-11 — Recover From Connection Loss

**As an employee, I want the application to recover if my connection drops so that I can continue training without manually refreshing the page.**

Acceptance criteria:

- Connection loss is detected.
- UI shows reconnecting state.
- Client attempts reconnection.
- Current server state is retrieved after reconnection.
- Local state is reconciled.

---

# 38. System Stories

### US-12 — Reject Invalid State Changes

**As the system, I want to validate incoming events so that invalid clients cannot corrupt the training session state.**

Acceptance criteria:

- Invalid event types are rejected.
- Invalid session IDs are rejected.
- Invalid playback positions are rejected.
- Unauthorized state changes are rejected.

---

### US-13 — Maintain Authoritative State

**As the system, I want the backend to own the authoritative session state so that individual clients cannot cause inconsistent states.**

Acceptance criteria:

- Client state is not blindly trusted.
- Server determines the accepted state transition.
- Server broadcasts accepted state.

---

### US-14 — Prevent Synchronization Loops

**As the system, I want synchronized player updates to avoid generating duplicate events so that one state change does not produce an infinite broadcast loop.**

Acceptance criteria:

- Programmatic playback changes are distinguishable from user actions.
- Server does not receive repeated events caused by its own broadcasts.
- Event propagation terminates correctly.

---

### US-15 — Handle Stale Events

**As the system, I want to detect stale events so that older state cannot overwrite newer state.**

Acceptance criteria:

- State has an ordering/version mechanism.
- Older events can be identified.
- Newer authoritative state wins.

---

# 39. Definition of Done

The project is considered complete when:

### Product

- [ ] Instructor can create a training session.
- [ ] Instructor can share the session.
- [ ] Participant can join.
- [ ] Training video loads.
- [ ] Play synchronizes.
- [ ] Pause synchronizes.
- [ ] Seek synchronizes.
- [ ] Late join synchronizes.
- [ ] Participant presence works.
- [ ] Reconnection resynchronizes.
- [ ] Session can be ended.

### Frontend

- [ ] React + TypeScript.
- [ ] Responsive UI.
- [ ] Clear loading states.
- [ ] Clear error states.
- [ ] Connection status visible.
- [ ] Intuitive controls.

### Backend

- [ ] Node.js + TypeScript.
- [ ] REST API.
- [ ] WebSocket server.
- [ ] Validation.
- [ ] Authoritative session state.
- [ ] Error handling.

### Data

- [ ] PostgreSQL persistence.
- [ ] Appropriate indexes.
- [ ] Redis used for justified real-time concerns.

### Infrastructure

- [ ] Docker Compose.
- [ ] Environment configuration.
- [ ] GitHub Actions.
- [ ] Automated tests.
- [ ] Lint/build checks.

### Documentation

- [ ] README setup instructions.
- [ ] Architecture diagram.
- [ ] Data-flow explanation.
- [ ] Synchronization explanation.
- [ ] Trade-offs.
- [ ] Edge cases.
- [ ] Production scaling discussion.
- [ ] Known limitations.
- [ ] Demo instructions.

---

# 40. Portfolio Positioning

The project should be presented as:

> **Corporate Live Training Platform — Real-Time Full-Stack Application**

### Short description

A real-time corporate training platform that allows instructors to conduct synchronized live training sessions for distributed teams. Participants join through a shared session and automatically remain synchronized with the instructor-controlled training content.

### Technical highlights

- React
- TypeScript
- Node.js
- REST APIs
- WebSockets
- PostgreSQL
- Redis
- Docker
- GitHub Actions
- Automated testing
- Real-time distributed state synchronization

### Engineering challenge

The central engineering problem is maintaining a consistent session state across multiple independently connected clients while handling late joins, reconnections, event ordering, stale state, and concurrent activity.

---

# 41. Project Principle

The project should follow one rule throughout development:

> **Build the smallest product that creates a genuine reason for the Nooks-style real-time synchronization problem to exist, then use the engineering depth to demonstrate full-stack capability.**

We are not trying to build a complete corporate LMS.

We are building a **focused, production-minded real-time system wrapped in a believable business use case.**