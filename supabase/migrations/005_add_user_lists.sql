-- supabase/migrations/005_add_user_lists.sql

-- Listes personnalisées en tant qu'entités (nom + cover), pour permettre :
-- renommage propre, image de couverture, et listes vides persistantes.
-- Les films restent liés par user_media_lists.list_type = user_lists.name.

CREATE TABLE IF NOT EXISTS user_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cover_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_lists_profile_name_unique UNIQUE (profile_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_lists_profile_id ON user_lists(profile_id);

ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_lists_owner" ON user_lists
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Backfill : créer une entité pour chaque liste perso existante (tags actuels)
INSERT INTO user_lists (user_id, profile_id, name)
SELECT DISTINCT uml.user_id, uml.profile_id, uml.list_type
FROM user_media_lists uml
WHERE uml.list_type NOT IN ('watchlist', 'watched')
  AND uml.profile_id IS NOT NULL
ON CONFLICT (profile_id, name) DO NOTHING;
