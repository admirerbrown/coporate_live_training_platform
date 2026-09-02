import 'dotenv/config';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll
} from 'vitest';
import request from 'supertest';

const { app } = require('../../src/app');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createSession() {
  const response = await request(app)
    .post('/api/sessions')
    .send({
      name: 'Leadership Training',
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123'
    });

  return response.body;
}

async function createLiveSession() {
  const session = await createSession();

  await request(app)
    .post(`/api/sessions/${session.id}/start`)
    .set('Authorization', `Bearer ${session.instructorToken}`)
    .send();

  return session;
}

beforeEach(async () => {
  await pool.query('DELETE FROM training_sessions');
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/sessions/:sessionId/end', () => {
  it('ends a live session with a valid instructor token', async () => {
    const session = await createLiveSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', `Bearer ${session.instructorToken}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(session.id);
    expect(response.body.status).toBe('ENDED');
  });

  it('persists the ENDED status in the database', async () => {
    const session = await createLiveSession();

    await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', `Bearer ${session.instructorToken}`)
      .send();

    const result = await pool.query(
      `
        SELECT status
        FROM training_sessions
        WHERE id = $1
      `,
      [session.id]
    );

    expect(result.rows[0].status).toBe('ENDED');
  });

  it('rejects a missing instructor token', async () => {
    const session = await createLiveSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .send();

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  it('rejects an invalid instructor token', async () => {
    const session = await createLiveSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', 'Bearer invalid-token')
      .send();

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  it('rejects an invalid session ID', async () => {
    const response = await request(app)
      .post('/api/sessions/not-a-uuid/end')
      .set('Authorization', 'Bearer some-token')
      .send();

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid session ID');
  });

  it('returns 404 for an unknown session', async () => {
    const session = await createLiveSession();

    const response = await request(app)
      .post(
        '/api/sessions/00000000-0000-4000-8000-000000000000/end'
      )
      .set('Authorization', `Bearer ${session.instructorToken}`)
      .send();

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Session not found');
  });

  it('does not allow a created session to end', async () => {
    const session = await createSession();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', `Bearer ${session.instructorToken}`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Session has not started');
  });

  it('does not allow an already ended session to end again', async () => {
    const session = await createLiveSession();

    await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', `Bearer ${session.instructorToken}`)
      .send();

    const response = await request(app)
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', `Bearer ${session.instructorToken}`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Session has already ended');
  });
});