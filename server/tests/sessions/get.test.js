import 'dotenv/config';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';

const { app } = require('../../src/app');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

beforeEach(async () => {
  await pool.query('DELETE FROM training_sessions');
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/sessions/:sessionId', () => {
  it('returns an existing session', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Q3 Onboarding Training',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

    const response = await request(app)
      .get(`/api/sessions/${created.body.id}`);

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      id: created.body.id,
      name: 'Q3 Onboarding Training',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'CREATED'
    });

    expect(response.body).toHaveProperty('createdAt');
  });

  it('does not expose the instructor token', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Security Training',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

    const response = await request(app)
      .get(`/api/sessions/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('instructorToken');
  });

  it('returns the default playback state', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .send({
        name: 'New Employee Training',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

    const response = await request(app)
      .get(`/api/sessions/${created.body.id}`);

    expect(response.status).toBe(200);

    expect(response.body).toHaveProperty('position', 0);
    expect(response.body).toHaveProperty('isPlaying', false);
  });

  it('returns 404 when the session does not exist', async () => {
    const response = await request(app)
      .get('/api/sessions/550e8400-e29b-41d4-a716-446655440000');

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: 'Session not found'
    });
  });

  it('returns 400 for an invalid session ID', async () => {
    const response = await request(app)
      .get('/api/sessions/not-a-uuid');

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Invalid session ID'
    });
  });

  it('returns an ended session', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Completed Training',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

    await pool.query(
      `
        UPDATE training_sessions
        SET status = 'ENDED'
        WHERE id = $1
      `,
      [created.body.id]
    );

    const response = await request(app)
      .get(`/api/sessions/${created.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ENDED');
  });
});