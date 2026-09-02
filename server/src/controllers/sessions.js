const { isValidSessionName } = require("../validators/sessionName");
const { isValidYoutubeUrl } = require("../validators/youtubeUrl");
const { isValidParticipantName } = require("../validators/participantName");

const {
  createSession,
  getSession,
  joinSession,
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

module.exports = {
  createSessionController,
  getSessionController,
  joinSessionController,
};
