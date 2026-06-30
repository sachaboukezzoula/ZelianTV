-- supabase/migrations/004_add_liked_media.sql

-- Films / séries « aimés » (❤). Indépendant des listes À voir / Déjà vu / perso :
-- un titre peut être aimé ET présent dans une liste en même temps.

CREATE TABLE IF NOT EXISTS user_liked_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id     INTEGER NOT NULL,
  media_type  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_liked_media_profile_tmdb_media_unique UNIQUE (profile_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_user_liked_media_profile_id ON user_liked_media(profile_id);

ALTER TABLE user_liked_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_liked_media_owner" ON user_liked_media
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
