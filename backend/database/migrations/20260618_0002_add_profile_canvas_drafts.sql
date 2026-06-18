SET @add_profile_canvas_glass_opacity = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_canvas_glass_opacity TINYINT UNSIGNED NOT NULL DEFAULT 58 AFTER profile_canvas_version',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_canvas_glass_opacity'
);
PREPARE add_profile_canvas_glass_opacity_statement FROM @add_profile_canvas_glass_opacity;
EXECUTE add_profile_canvas_glass_opacity_statement;
DEALLOCATE PREPARE add_profile_canvas_glass_opacity_statement;

UPDATE profiles
SET profile_canvas_version = 2
WHERE profile_canvas_version < 2;

CREATE TABLE IF NOT EXISTS profile_canvas_drafts (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  draft_json JSON NOT NULL,
  selected_module_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT profile_canvas_drafts_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
