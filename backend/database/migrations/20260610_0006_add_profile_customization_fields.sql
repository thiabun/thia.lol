SET @add_banner_url = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN banner_url VARCHAR(500) NULL AFTER avatar_url',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'banner_url'
);
PREPARE add_banner_url_statement FROM @add_banner_url;
EXECUTE add_banner_url_statement;
DEALLOCATE PREPARE add_banner_url_statement;

SET @add_profile_accent = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_accent VARCHAR(50) NULL AFTER banner_url',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_accent'
);
PREPARE add_profile_accent_statement FROM @add_profile_accent;
EXECUTE add_profile_accent_statement;
DEALLOCATE PREPARE add_profile_accent_statement;

SET @add_profile_background = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_background VARCHAR(500) NULL AFTER profile_accent',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_background'
);
PREPARE add_profile_background_statement FROM @add_profile_background;
EXECUTE add_profile_background_statement;
DEALLOCATE PREPARE add_profile_background_statement;

SET @add_profile_theme = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_theme VARCHAR(50) NULL AFTER profile_background',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_theme'
);
PREPARE add_profile_theme_statement FROM @add_profile_theme;
EXECUTE add_profile_theme_statement;
DEALLOCATE PREPARE add_profile_theme_statement;
