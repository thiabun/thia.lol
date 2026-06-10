SET @thia_migration_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE post_reblogs ADD KEY post_reblogs_created_at_index (created_at)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'post_reblogs'
    AND INDEX_NAME = 'post_reblogs_created_at_index'
);
PREPARE thia_migration_stmt FROM @thia_migration_sql;
EXECUTE thia_migration_stmt;
DEALLOCATE PREPARE thia_migration_stmt;
