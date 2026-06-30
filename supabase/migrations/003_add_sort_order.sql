ALTER TABLE user_media_lists
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_user_media_lists_sort_order
  ON user_media_lists(profile_id, list_type, sort_order);
