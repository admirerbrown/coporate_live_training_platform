CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(200) NOT NULL,

  youtube_url TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'LIVE', 'ENDED')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);