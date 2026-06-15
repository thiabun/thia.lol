SET @add_profile_layout_preset = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_layout_preset VARCHAR(20) NOT NULL DEFAULT ''balanced'' AFTER profile_theme',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_layout_preset'
);
PREPARE add_profile_layout_preset_statement FROM @add_profile_layout_preset;
EXECUTE add_profile_layout_preset_statement;
DEALLOCATE PREPARE add_profile_layout_preset_statement;
