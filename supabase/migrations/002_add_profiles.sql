-- supabase/migrations/002_add_profiles.sql

-- 1. Table profiles
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  color       TEXT NOT NULL DEFAULT '#f97316',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner" ON profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Ajouter profile_id à user_media_lists (nullable pour la migration)
ALTER TABLE user_media_lists
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Ajouter profile_id à user_preferences (nullable pour la migration)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Créer un profil "Par défaut" pour chaque utilisateur ayant des données
--    et backfiller profile_id
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT u.id as user_id,
           u.raw_user_meta_data->>'display_name' as display_name,
           u.raw_user_meta_data->>'avatar_url' as avatar_url
    FROM auth.users u
    WHERE EXISTS (
      SELECT 1 FROM user_media_lists uml WHERE uml.user_id = u.id
      UNION
      SELECT 1 FROM user_preferences up WHERE up.user_id = u.id
    )
  LOOP
    INSERT INTO profiles (user_id, name, avatar_url, color)
    VALUES (
      r.user_id,
      COALESCE(r.display_name, 'Mon profil'),
      r.avatar_url,
      '#f97316'
    )
    RETURNING id INTO new_profile_id;

    UPDATE user_media_lists
    SET profile_id = new_profile_id
    WHERE user_id = r.user_id AND profile_id IS NULL;

    UPDATE user_preferences
    SET profile_id = new_profile_id
    WHERE user_id = r.user_id AND profile_id IS NULL;
  END LOOP;
END $$;

-- 5. Rendre profile_id NOT NULL après backfill (seulement pour les lignes existantes)
--    Note: nouvelles lignes sans utilisateur existant sont couvertes par le DO block
--    On laisse nullable pour permettre l'insertion initiale via trigger ou app

-- 6. Corriger la contrainte CHECK list_type (bug audit CRITIQUE)
ALTER TABLE user_media_lists
  DROP CONSTRAINT IF EXISTS user_media_lists_list_type_check;

-- 7. Mettre à jour la contrainte UNIQUE pour utiliser profile_id
ALTER TABLE user_media_lists
  DROP CONSTRAINT IF EXISTS user_media_lists_user_id_tmdb_id_media_type_key;

ALTER TABLE user_media_lists
  ADD CONSTRAINT user_media_lists_profile_tmdb_media_unique
  UNIQUE (profile_id, tmdb_id, media_type);

-- 8. Index sur profile_id pour les deux tables
CREATE INDEX IF NOT EXISTS idx_user_media_lists_profile_id ON user_media_lists(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_profile_id ON user_preferences(profile_id);
