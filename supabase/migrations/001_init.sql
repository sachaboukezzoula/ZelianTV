CREATE TABLE IF NOT EXISTS user_media_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  tmdb_id     INTEGER NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  list_type   TEXT NOT NULL CHECK (list_type IN ('watchlist', 'watched')),
  rating      INTEGER CHECK (rating >= 1 AND rating <= 10),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tmdb_id, media_type)
);

ALTER TABLE user_media_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own lists"
  ON user_media_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id          UUID REFERENCES auth.users PRIMARY KEY,
  preferred_genres INTEGER[] DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
