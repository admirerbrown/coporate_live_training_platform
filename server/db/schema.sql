CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(200) NOT NULL,

  youtube_url TEXT NOT NULL,

  instructor_token TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'LIVE', 'ENDED')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_playback_state (
  session_id UUID PRIMARY KEY REFERENCES training_sessions(id) ON DELETE CASCADE,
  position NUMERIC NOT NULL DEFAULT 0,
  is_playing BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

