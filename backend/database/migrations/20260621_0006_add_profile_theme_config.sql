SET @add_profile_theme_config_json = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_theme_config_json JSON NULL AFTER profile_theme',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_theme_config_json'
);
PREPARE add_profile_theme_config_json_statement FROM @add_profile_theme_config_json;
EXECUTE add_profile_theme_config_json_statement;
DEALLOCATE PREPARE add_profile_theme_config_json_statement;
