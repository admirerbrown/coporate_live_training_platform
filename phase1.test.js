/**
 * Phase 1 TDD suite — Data Layer & REST API (Express + Node.js)
 *
 * These tests are written BEFORE the implementation. Expect all of them
 * to fail until app.js, db.js, and validators.js exist. That's the point:
 * build until this file is green, then stop.
 *
 * Assumed project layout (adjust require paths to match your repo):
 *   src/app.js          -> exports a configured Express app (no app.listen call)
 *   src/db.js           -> exports `pool` (pg.Pool) and `resetDb()` test helper
 *   src/validators.js   -> exports isValidSessionName, isValidYoutubeUrl
 *
 * Requires: jest, supertest, pg
 * A running Postgres test database is required for the integration suites.
 * Point DATABASE_URL at a disposable test DB before running this file.
 */

const request = require('supertest');
const { app } = require('../src/app');
const { pool, resetDb } = require('../src/db');
const { isValidSessionName, isValidYoutubeUrl } = require('../src/validators');

// ---------------------------------------------------------------------------
// Validators — pure functions, no DB or HTTP involved
// ---------------------------------------------------------------------------

describe('isValidSessionName', () => {
  test.each([
    ['Q3 Onboarding Training', true],
    ['A', false], // below min length (assumed min 3)
    ['', false],
    ['   ', false], // whitespace only
    ['x'.repeat(201), false], // above max length (assumed max 200)
    ['x'.repeat(200), true], // exactly at max length
  ])('isValidSessionName(%j) -> %p', (input, expected) => {
    expect(isValidSessionName(input)).toBe(expected);
  });

  test('rejects null', () => {
    expect(isValidSessionName(null)).toBe(false);
  });

  test('rejects undefined', () => {
    expect(isValidSessionName(undefined)).toBe(false);
  });

  test('rejects non-string input', () => {
    expect(isValidSessionName(123)).toBe(false);
  });

  test('accepts a name with leading/trailing whitespace (trimmed before storage, not rejected)', () => {
    expect(isValidSessionName('  Team Sync  ')).toBe(true);
  });
});

describe('isValidYoutubeUrl', () => {
  test.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', true],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', true], // no www
    ['https://youtu.be/dQw4w9WgXcQ', true], // short link
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', true], // mobile host
    ['https://vimeo.com/12345', false], // valid URL, wrong host
    ['not a url', false],
    ['https://www.youtube.com/watch', false], // missing v param
    ['', false],
    ['https://www.youtube.com/watch?v=', false], // empty video id
  ])('isValidYoutubeUrl(%j) -> %p', (input, expected) => {
    expect(isValidYoutubeUrl(input)).toBe(expected);
  });

  test('rejects null', () => {
    expect(isValidYoutubeUrl(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------

describe('POST /api/sessions', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  const validPayload = {
    name: 'Q3 Onboarding Training',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  };

  test('creates a session and returns 201 with the expected shape', async () => {
    const res = await request(app).post('/api/sessions').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: validPayload.name,
      youtubeUrl: validPayload.youtubeUrl,
      status: 'CREATED',
    });
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.body.createdAt).toBeDefined();
    expect(typeof res.body.instructorToken).toBe('string');
    expect(res.body.instructorToken.length).toBeGreaterThan(10);
  });

  test('two identical requests produce two distinct sessions and two distinct tokens', async () => {
    const res1 = await request(app).post('/api/sessions').send(validPayload);
    const res2 = await request(app).post('/api/sessions').send(validPayload);

    expect(res1.body.id).not.toBe(res2.body.id);
    expect(res1.body.instructorToken).not.toBe(res2.body.instructorToken);
  });

  test('rejects a request with no name field', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ youtubeUrl: validPayload.youtubeUrl });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  test('rejects a request with no youtubeUrl field', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: validPayload.name });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/youtubeUrl|youtube_url/i);
  });

  test('rejects an invalid session name', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ ...validPayload, name: '' });

    expect(res.status).toBe(400);
  });

  test('rejects an invalid YouTube URL', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ ...validPayload, youtubeUrl: 'https://vimeo.com/12345' });

    expect(res.status).toBe(400);
  });

  test('persists the session in the database', async () => {
    const res = await request(app).post('/api/sessions').send(validPayload);

    const { rows } = await pool.query(
      'SELECT name, youtube_url, status FROM training_sessions WHERE id = $1',
      [res.body.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: validPayload.name,
      youtube_url: validPayload.youtubeUrl,
      status: 'CREATED',
    });
  });

  test('returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json');

    expect(res.status).toBe(400);
  });

  test('ignores a client-supplied status and always creates with CREATED', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ ...validPayload, status: 'LIVE' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CREATED');
  });

  test('returns 500 with a generic message if the database insert fails', async () => {
    const spy = jest
      .spyOn(pool, 'query')
      .mockRejectedValueOnce(new Error('connection terminated'));

    const res = await request(app).post('/api/sessions').send(validPayload);

    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/connection terminated/); // no internals leaked
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:sessionId
// ---------------------------------------------------------------------------

describe('GET /api/sessions/:sessionId', () => {
  let sessionId;

  beforeEach(async () => {
    await resetDb();
    const res = await request(app).post('/api/sessions').send({
      name: 'Test Session',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    sessionId = res.body.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  test('returns the session for a valid, existing id', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: sessionId,
      name: 'Test Session',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'CREATED',
    });
  });

  test('does not include the instructor token in the response', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.body.instructorToken).toBeUndefined();
  });

  test('returns default playback state for a session with no events yet', async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.body.position).toBe(0);
    expect(res.body.isPlaying).toBe(false);
  });

  test('returns 404 for a well-formed but non-existent session id', async () => {
    const res = await request(app).get(
      '/api/sessions/00000000-0000-0000-0000-000000000000',
    );

    expect(res.status).toBe(404);
  });

  test('returns 400 for a malformed session id', async () => {
    const res = await request(app).get('/api/sessions/not-a-uuid');

    expect(res.status).toBe(400);
  });

  test('reflects ENDED status correctly once a session has ended', async () => {
    await pool.query(
      "UPDATE training_sessions SET status = 'ENDED' WHERE id = $1",
      [sessionId],
    );

    const res = await request(app).get(`/api/sessions/${sessionId}`);

    expect(res.body.status).toBe('ENDED');
  });
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('returns 200 and ok status when the database is reachable', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('returns 503 when the database is unreachable', async () => {
    const spy = jest
      .spyOn(pool, 'query')
      .mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.error).not.toMatch(/connection refused/); // no internals leaked
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Database constraints — run against a real (disposable) test database
// ---------------------------------------------------------------------------

describe('training_sessions schema constraints', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  test('rejects a NULL name', async () => {
    await expect(
      pool.query(
        "INSERT INTO training_sessions (youtube_url, status) VALUES ($1, 'CREATED')",
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      ),
    ).rejects.toThrow();
  });

  test('rejects a NULL youtube_url', async () => {
    await expect(
      pool.query(
        "INSERT INTO training_sessions (name, status) VALUES ($1, 'CREATED')",
        ['Test Session'],
      ),
    ).rejects.toThrow();
  });

  test('rejects an invalid status value', async () => {
    await expect(
      pool.query(
        "INSERT INTO training_sessions (name, youtube_url, status) VALUES ($1, $2, 'BOGUS')",
        ['Test Session', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      ),
    ).rejects.toThrow();
  });

  test('defaults status to CREATED when omitted', async () => {
    const { rows } = await pool.query(
      'INSERT INTO training_sessions (name, youtube_url) VALUES ($1, $2) RETURNING status',
      ['Test Session', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    );

    expect(rows[0].status).toBe('CREATED');
  });

  test('rejects a session_participants row referencing a non-existent session', async () => {
    await expect(
      pool.query(
        'INSERT INTO session_participants (session_id, joined_at) VALUES ($1, now())',
        ['00000000-0000-0000-0000-000000000000'],
      ),
    ).rejects.toThrow();
  });

  test('defaults created_at when omitted', async () => {
    const { rows } = await pool.query(
      'INSERT INTO training_sessions (name, youtube_url) VALUES ($1, $2) RETURNING created_at',
      ['Test Session', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    );

    expect(rows[0].created_at).not.toBeNull();
  });
});
