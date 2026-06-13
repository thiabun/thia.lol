SET @add_featured_post_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN featured_post_id BIGINT UNSIGNED NULL AFTER traits',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'featured_post_id'
);
PREPARE add_featured_post_id_statement FROM @add_featured_post_id;
EXECUTE add_featured_post_id_statement;
DEALLOCATE PREPARE add_featured_post_id_statement;

SET @add_featured_room_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN featured_room_id BIGINT UNSIGNED NULL AFTER featured_post_id',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'featured_room_id'
);
PREPARE add_featured_room_id_statement FROM @add_featured_room_id;
EXECUTE add_featured_room_id_statement;
DEALLOCATE PREPARE add_featured_room_id_statement;

SET @add_featured_post_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD KEY profiles_featured_post_idx (featured_post_id)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND INDEX_NAME = 'profiles_featured_post_idx'
);
PREPARE add_featured_post_idx_statement FROM @add_featured_post_idx;
EXECUTE add_featured_post_idx_statement;
DEALLOCATE PREPARE add_featured_post_idx_statement;

SET @add_featured_room_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD KEY profiles_featured_room_idx (featured_room_id)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND INDEX_NAME = 'profiles_featured_room_idx'
);
PREPARE add_featured_room_idx_statement FROM @add_featured_room_idx;
EXECUTE add_featured_room_idx_statement;
DEALLOCATE PREPARE add_featured_room_idx_statement;
