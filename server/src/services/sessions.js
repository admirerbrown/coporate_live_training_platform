const crypto = require('crypto');

async function createSession({ name, youtubeUrl }, db) {
  const instructorToken = crypto.randomBytes(32).toString('hex');

  const result = await db.query(
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
    [name, youtubeUrl, instructorToken]
  );

  const session = result.rows[0];

  return {
    id: session.id,
    name: session.name,
    youtubeUrl: session.youtube_url,
    status: session.status,
    createdAt: session.created_at,
    instructorToken
  };
}

module.exports = {
  createSession
};