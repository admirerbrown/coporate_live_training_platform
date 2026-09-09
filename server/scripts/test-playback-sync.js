require("dotenv").config();

const WebSocket = require("ws");
const pool = require("../src/db/pool");

const sessionId = process.argv[2];

if (!sessionId) {
  console.error("Usage: node scripts/test-playback-sync.js <sessionId>");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const WS_URL = `ws://localhost:${PORT}/ws?sessionId=${sessionId}`;

function waitForMessage(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();

      reject(new Error("Timed out waiting for expected WebSocket message"));
    }, timeoutMs);

    function handleMessage(data) {
      let message;

      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        return;
      }

      if (!predicate(message)) {
        return;
      }

      cleanup();
      resolve(message);
    }

    function handleError(error) {
      cleanup();
      reject(error);
    }

    function cleanup() {
      clearTimeout(timeout);
      socket.off("message", handleMessage);
      socket.off("error", handleError);
    }

    socket.on("message", handleMessage);
    socket.on("error", handleError);
  });
}

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);

    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function main() {
  let instructorSocket;
  let participantSocket;

  try {
    const result = await pool.query(
      `
        SELECT
          s.status,
          s.instructor_token,
          p.position,
          p.is_playing,
          p.version,
          p.updated_at
        FROM training_sessions s
        INNER JOIN session_playback_state p
          ON p.session_id = s.id
        WHERE s.id = $1
      `,
      [sessionId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = result.rows[0];

    console.log("Session:");
    console.log({
      id: sessionId,
      status: session.status,
      position: Number(session.position),
      isPlaying: session.is_playing,
      version: session.version,
      updatedAt: session.updated_at,
    });

    if (session.status !== "LIVE") {
      throw new Error(
        `Session is ${session.status}; playback commands require LIVE`,
      );
    }

    console.log("\nConnecting instructor...");
    instructorSocket = await connect();

    const instructorInitial = await waitForMessage(
      instructorSocket,
      (message) => message.type === "playback:state",
    );

    console.log("Instructor initial state:", instructorInitial);

    console.log("\nConnecting participant...");

    participantSocket = await connect();

    const participantInitial = await waitForMessage(
      participantSocket,
      (message) => message.type === "playback:state",
    );

    console.log("Participant initial state:", participantInitial);

    console.log("\nAuthenticating instructor...");

    instructorSocket.send(
      JSON.stringify({
        type: "auth",
        token: session.instructor_token,
      }),
    );

    const authMessage = await waitForMessage(
      instructorSocket,
      (message) => message.type === "auth:success",
    );

    console.log("Authentication:", authMessage);

    const nextVersion = session.version + 1;

    console.log("\nSending playback:play...");

    const instructorPlaybackPromise = waitForMessage(
      instructorSocket,
      (message) =>
        message.type === "playback:state" && message.version >= nextVersion,
    );

    const participantPlaybackPromise = waitForMessage(
      participantSocket,
      (message) =>
        message.type === "playback:state" && message.version >= nextVersion,
    );

    instructorSocket.send(
      JSON.stringify({
        type: "playback:play",
      }),
    );

    const [instructorPlayback, participantPlayback] = await Promise.all([
      instructorPlaybackPromise,
      participantPlaybackPromise,
    ]);

    console.log("\nInstructor received:", instructorPlayback);

    console.log("\nParticipant received:", participantPlayback);

    const synchronized =
      instructorPlayback.version === participantPlayback.version &&
      instructorPlayback.isPlaying === true &&
      participantPlayback.isPlaying === true;

    console.log("\nResult:");

    if (synchronized) {
      console.log("✅ Server playback broadcast is working.");
    } else {
      console.log("❌ Instructor/participant playback states differ.");
    }
  } catch (error) {
    console.error("\n❌ Playback sync test failed:", error.message);

    process.exitCode = 1;
  } finally {
    instructorSocket?.close();
    participantSocket?.close();

    await pool.end();
  }
}

main();
