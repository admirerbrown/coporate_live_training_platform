import 'dotenv/config';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';

const { app } = require('../src/app');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const {
  createSessionController
} = require('../src/controllers/sessions');

describe('POST /api/sessions', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM training_sessions');
  });

  afterAll(async () => {
    await pool.end();
  });
  

  it('C1: creates a training session with valid input', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Q3 Onboarding Training',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      });

    expect(response.status).toBe(201);

    expect(response.body).toMatchObject({
      name: 'Q3 Onboarding Training',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'CREATED'
    });

    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.createdAt).toEqual(expect.any(String));
    expect(response.body.instructorToken).toEqual(expect.any(String));
  });

  it('C2: creates distinct sessions for identical requests', async () => {
    const input = {
      name: 'Team Training',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ'
    };

    const first = await request(app)
      .post('/api/sessions')
      .send(input);

    const second = await request(app)
      .post('/api/sessions')
      .send(input);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    expect(first.body.id).not.toBe(second.body.id);
    expect(first.body.instructorToken)
      .not.toBe(second.body.instructorToken);
  });

  it('C3: rejects a request missing name', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('C4: rejects a request missing youtubeUrl', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Team Training'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });

  it('C5: rejects an invalid session name', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'A',
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ'
      });

    expect(response.status).toBe(400);
  });

  it('C6: rejects an invalid YouTube URL', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Team Training',
        youtubeUrl: 'https://vimeo.com/12345'
      });

    expect(response.status).toBe(400);
  });

  it('C7: stores the created session in the database', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Team Training',
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ'
      });

    expect(response.status).toBe(201);

    const result = await pool.query(
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
      [response.body.id]
    );

    expect(result.rows).toHaveLength(1);

    expect(result.rows[0]).toMatchObject({
      name: 'Team Training',
      youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
      status: 'CREATED'
    });

    expect(result.rows[0].created_at).toBeInstanceOf(Date);
  });

  it('C8: does not expose internal database fields', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Team Training',
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ'
      });

    expect(response.status).toBe(201);

    expect(response.body.updatedAt).toBeUndefined();
    expect(response.body.updated_at).toBeUndefined();
  });

  it('C9: rejects malformed JSON with 400', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .set('Content-Type', 'application/json')
      .send('{"name":"Team Training"');

    expect(response.status).toBe(400);
  });

  it('C10: ignores client-supplied status', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        name: 'Team Training',
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
        status: 'LIVE'
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('CREATED');
  });
  it('C11: returns 500 when database insertion fails', async () => {
  const failingDb = {
    query: async () => {
      throw new Error('database connection failed');
    }
  };

  const controller = createSessionController(failingDb);

  const req = {
    body: {
      name: 'Team Training',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ'
    }
  };

  const response = {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    }
  };

  await controller(req, response);

  expect(response.statusCode).toBe(500);
  expect(response.body).toEqual({
    error: 'Failed to create session'
  });
  });
});