const crypto = require("crypto");

async function createSession({ name, youtubeUrl }, db) {
  const instructorToken = crypto.randomBytes(32).toString("hex");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO training_sessions (
          name,
          youtube_url,
          instructor_token,
          status
        )
        VALUES ($1, $2, $3, 'CREATED')
        RETURNING
          id,
          name,
          youtube_url,
          status,
          created_at
      `,
      [name, youtubeUrl, instructorToken],
    );

    const session = result.rows[0];

    await client.query(
      `
        INSERT INTO session_playback_state (
          session_id
        )
        VALUES ($1)
      `,
      [session.id],
    );

    await client.query("COMMIT");

    return {
      id: session.id,
      name: session.name,
      youtubeUrl: session.youtube_url,
      status: session.status,
      createdAt: session.created_at,
      instructorToken,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getSession(sessionId, db) {
  const result = await db.query(
    `
      SELECT
        s.id,
        s.name,
        s.youtube_url,
        s.status,
        s.created_at,
        p.position,
        p.is_playing
      FROM training_sessions s
      LEFT JOIN session_playback_state p
        ON p.session_id = s.id
      WHERE s.id = $1
    `,
    [sessionId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];

  return {
    id: session.id,
    name: session.name,
    youtubeUrl: session.youtube_url,
    status: session.status,
    createdAt: session.created_at,
    position: Number(session.position),
    isPlaying: session.is_playing,
  };
}

async function joinSession({ sessionId, participantName }, db) {
  const sessionResult = await db.query(
    `
      SELECT
        id,
        status
      FROM training_sessions
      WHERE id = $1
    `,
    [sessionId],
  );

  if (sessionResult.rows.length === 0) {
    return {
      type: "NOT_FOUND",
    };
  }

  const session = sessionResult.rows[0];

  if (session.status === "ENDED") {
    return {
      type: "ENDED",
    };
  }

  const result = await db.query(
    `
      INSERT INTO session_participants (
        session_id,
        participant_name
      )
      VALUES ($1, $2)
      RETURNING
        id,
        session_id,
        participant_name,
        joined_at
    `,
    [sessionId, participantName],
  );

  const participant = result.rows[0];

  return {
    type: "JOINED",
    participant: {
      sessionId: participant.session_id,
      participantName: participant.participant_name,
      participantId: participant.id,
      joinedAt: participant.joined_at,
    },
  };
}

async function verifyInstructorToken({ sessionId, instructorToken }, db) {
  const result = await db.query(
    `
      SELECT instructor_token
      FROM training_sessions
      WHERE id = $1
    `,
    [sessionId],
  );

  if (result.rows.length === 0) {
    return {
      type: "NOT_FOUND",
    };
  }

  if (result.rows[0].instructor_token !== instructorToken) {
    return {
      type: "UNAUTHORIZED",
    };
  }

  return {
    type: "AUTHORIZED",
  };
}

async function startSession({ sessionId, instructorToken }, db) {
  const authorization = await verifyInstructorToken(
    { sessionId, instructorToken },
    db,
  );

  if (authorization.type !== "AUTHORIZED") {
    return authorization;
  }

  const result = await db.query(
    `
      SELECT
        id,
        name,
        youtube_url,
        status,
        created_at
      FROM training_sessions
      WHERE id = $1
    `,
    [sessionId],
  );

  const session = result.rows[0];

  if (session.status === "LIVE") {
    return {
      type: "ALREADY_LIVE",
    };
  }

  if (session.status === "ENDED") {
    return {
      type: "ENDED",
    };
  }

  const updateResult = await db.query(
    `
      UPDATE training_sessions
      SET
        status = 'LIVE',
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        name,
        youtube_url,
        status,
        created_at
    `,
    [sessionId],
  );

  const updatedSession = updateResult.rows[0];

  return {
    type: "STARTED",
    session: {
      id: updatedSession.id,
      name: updatedSession.name,
      youtubeUrl: updatedSession.youtube_url,
      status: updatedSession.status,
      createdAt: updatedSession.created_at,
    },
  };
}

async function endSession({ sessionId, instructorToken }, db) {
  const authorization = await verifyInstructorToken(
    { sessionId, instructorToken },
    db,
  );

  if (authorization.type !== "AUTHORIZED") {
    return authorization;
  }

  const result = await db.query(
    `
      SELECT
        id,
        name,
        youtube_url,
        status,
        created_at
      FROM training_sessions
      WHERE id = $1
    `,
    [sessionId],
  );

  const session = result.rows[0];

  if (session.status === "CREATED") {
    return {
      type: "NOT_STARTED",
    };
  }

  if (session.status === "ENDED") {
    return {
      type: "ALREADY_ENDED",
    };
  }

  const updateResult = await db.query(
    `
      UPDATE training_sessions
      SET
        status = 'ENDED',
        updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        name,
        youtube_url,
        status,
        created_at
    `,
    [sessionId],
  );

  const updatedSession = updateResult.rows[0];

  return {
    type: "ENDED",
    session: {
      id: updatedSession.id,
      name: updatedSession.name,
      youtubeUrl: updatedSession.youtube_url,
      status: updatedSession.status,
      createdAt: updatedSession.created_at,
    },
  };
}

module.exports = {
  createSession,
  getSession,
  joinSession,
  verifyInstructorToken,
  startSession,
  endSession,
};