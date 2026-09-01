const {
  isValidSessionName
} = require('../validators/sessionName');

const {
  isValidYoutubeUrl
} = require('../validators/youtubeUrl');

const {
  createSession
} = require('../services/sessions');

function createSessionController(db) {
  return async function (req, res) {
    const { name, youtubeUrl } = req.body;

    if (!isValidSessionName(name)) {
      return res.status(400).json({
        error: 'Invalid session name'
      });
    }

    if (!isValidYoutubeUrl(youtubeUrl)) {
      return res.status(400).json({
        error: 'Invalid YouTube URL'
      });
    }

    try {
      const session = await createSession(
        {
          name: name.trim(),
          youtubeUrl
        },
        db
      );

      return res.status(201).json(session);
    } catch (error) {
      console.error('Failed to create session:', error);

      return res.status(500).json({
        error: 'Failed to create session'
      });
    }
  };
}

module.exports = {
  createSessionController
};