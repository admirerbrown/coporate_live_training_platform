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

describe('POST /api/sessions/:sessionId/join', () => {
  async function createSession() {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Q3 Onboarding Training',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

    return response.body;
  }

  it('allows a participant to join an existing session', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'Samuel'
      });

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      sessionId: session.id,
      participantName: 'Samuel'
    });

    expect(response.body).toHaveProperty('participantId');
    expect(response.body).toHaveProperty('joinedAt');
  });

  it('persists the participant in the database', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'Samuel'
      });

    const result = await pool.query(
      `
        SELECT
          id,
          session_id,
          participant_name,
          joined_at,
          left_at
        FROM session_participants
        WHERE id = $1
      `,
      [response.body.participantId]
    );

    expect(result.rows).toHaveLength(1);

    expect(result.rows[0]).toMatchObject({
      id: response.body.participantId,
      session_id: session.id,
      participant_name: 'Samuel',
      left_at: null
    });
  });

  it('allows multiple participants to join the same session', async () => {
    const session = await createSession();

    const first = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'Samuel'
      });

    const second = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'John'
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    expect(first.body.participantId).not.toBe(
      second.body.participantId
    );

    const result = await pool.query(
      `
        SELECT id, participant_name
        FROM session_participants
        WHERE session_id = $1
        ORDER BY joined_at
      `,
      [session.id]
    );

    expect(result.rows).toHaveLength(2);
  });

  it('returns 400 for an invalid session ID', async () => {
    const response = await request(app)
      .post('/api/sessions/not-a-uuid/join')
      .send({
        participantName: 'Samuel'
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Invalid session ID'
    });
  });

  it('returns 404 when the session does not exist', async () => {
    const response = await request(app)
      .post('/api/sessions/550e8400-e29b-41d4-a716-446655440000/join')
      .send({
        participantName: 'Samuel'
      });

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      error: 'Session not found'
    });
  });

  it('returns 400 when participant name is missing', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({});

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Invalid participant name'
    });
  });

  it('returns 400 when participant name is too short', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'A'
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Invalid participant name'
    });
  });

  it('returns 400 when participant name is too long', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'A'.repeat(101)
      });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Invalid participant name'
    });
  });

  it('trims whitespace from the participant name', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: '  Samuel  '
      });

    expect(response.status).toBe(201);
    expect(response.body.participantName).toBe('Samuel');
  });

  it('does not allow participants to join an ended session', async () => {
    const session = await createSession();

    await pool.query(
      `
        UPDATE training_sessions
        SET status = 'ENDED'
        WHERE id = $1
      `,
      [session.id]
    );

    const response = await request(app)
      .post(`/api/sessions/${session.id}/join`)
      .send({
        participantName: 'Samuel'
      });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      error: 'Session has ended'
    });
  });
});