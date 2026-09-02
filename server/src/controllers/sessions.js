const { isValidSessionName } = require("../validators/sessionName");
const { isValidYoutubeUrl } = require("../validators/youtubeUrl");
const { isValidParticipantName } = require("../validators/participantName");

const {
  createSession,
  getSession,
  joinSession,
  startSession,
  endSession,
} = require("../services/sessions");

function createSessionController(db) {
  return async function (req, res) {
    const { name, youtubeUrl } = req.body;

    if (!isValidSessionName(name)) {
      return res.status(400).json({
        error: "Invalid session name",
      });
    }

    if (!isValidYoutubeUrl(youtubeUrl)) {
      return res.status(400).json({
        error: "Invalid YouTube URL",
      });
    }

    try {
      const session = await createSession(
        {
          name: name.trim(),
          youtubeUrl,
        },
        db,
      );

      return res.status(201).json(session);
    } catch (error) {
      console.error("Failed to create session:", error);

      return res.status(500).json({
        error: "Failed to create session",
      });
    }
  };
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getSessionController(db) {
  return async function (req, res) {
    const { sessionId } = req.params;

    if (!isValidUuid(sessionId)) {
      return res.status(400).json({
        error: "Invalid session ID",
      });
    }

    try {
      const session = await getSession(sessionId, db);

      if (!session) {
        return res.status(404).json({
          error: "Session not found",
        });
      }

      return res.status(200).json(session);
    } catch (error) {
      console.error("Failed to get session:", error);

      return res.status(500).json({
        error: "Failed to get session",
      });
    }
  };
}

function joinSessionController(db) {
  return async function (req, res) {
    const { sessionId } = req.params;
    const { participantName } = req.body;

    if (!isValidUuid(sessionId)) {
      return res.status(400).json({
        error: "Invalid session ID",
      });
    }

    if (!isValidParticipantName(participantName)) {
      return res.status(400).json({
        error: "Invalid participant name",
      });
    }

    try {
      const result = await joinSession(
        {
          sessionId,
          participantName: participantName.trim(),
        },
        db,
      );

      if (result.type === "NOT_FOUND") {
        return res.status(404).json({
          error: "Session not found",
        });
      }

      if (result.type === "ENDED") {
        return res.status(409).json({
          error: "Session has ended",
        });
      }

      return res.status(201).json(result.participant);
    } catch (error) {
      console.error("Failed to join session:", error);

      return res.status(500).json({
        error: "Failed to join session",
      });
    }
  };
}

function getBearerToken(req) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function startSessionController(db) {
  return async function (req, res) {
    const { sessionId } = req.params;

    if (!isValidUuid(sessionId)) {
      return res.status(400).json({
        error: "Invalid session ID",
      });
    }

    const instructorToken = getBearerToken(req);

    if (!instructorToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    try {
      const result = await startSession(
        {
          sessionId,
          instructorToken,
        },
        db,
      );

      if (result.type === "NOT_FOUND") {
        return res.status(404).json({
          error: "Session not found",
        });
      }

      if (result.type === "UNAUTHORIZED") {
        return res.status(401).json({
          error: "Unauthorized",
        });
      }

      if (result.type === "ALREADY_LIVE") {
        return res.status(409).json({
          error: "Session is already live",
        });
      }

      if (result.type === "ENDED") {
        return res.status(409).json({
          error: "Session has ended",
        });
      }

      return res.status(200).json(result.session);
    } catch (error) {
      console.error("Failed to start session:", error);

      return res.status(500).json({
        error: "Failed to start session",
      });
    }
  };
}

function endSessionController(db) {
  return async function (req, res) {
    const { sessionId } = req.params;

    if (!isValidUuid(sessionId)) {
      return res.status(400).json({
        error: "Invalid session ID",
      });
    }

    const instructorToken = getBearerToken(req);

    if (!instructorToken) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    try {
      const result = await endSession(
        {
          sessionId,
          instructorToken,
        },
        db,
      );

      if (result.type === "NOT_FOUND") {
        return res.status(404).json({
          error: "Session not found",
        });
      }

      if (result.type === "UNAUTHORIZED") {
        return res.status(401).json({
          error: "Unauthorized",
        });
      }

      if (result.type === "NOT_STARTED") {
        return res.status(409).json({
          error: "Session has not started",
        });
      }

      if (result.type === "ALREADY_ENDED") {
        return res.status(409).json({
          error: "Session has already ended",
        });
      }

      return res.status(200).json(result.session);
    } catch (error) {
      console.error("Failed to end session:", error);

      return res.status(500).json({
        error: "Failed to end session",
      });
    }
  };
}

module.exports = {
  createSessionController,
  getSessionController,
  joinSessionController,
  startSessionController,
  endSessionController,
};
