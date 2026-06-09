SET @thia_migration_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER room_id',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'parent_id'
);
PREPARE thia_migration_stmt FROM @thia_migration_sql;
EXECUTE thia_migration_stmt;
DEALLOCATE PREPARE thia_migration_stmt;

SET @thia_migration_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD KEY posts_parent_created_idx (parent_id, created_at)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND INDEX_NAME = 'posts_parent_created_idx'
);
PREPARE thia_migration_stmt FROM @thia_migration_sql;
EXECUTE thia_migration_stmt;
DEALLOCATE PREPARE thia_migration_stmt;

SET @thia_migration_sql = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD CONSTRAINT posts_parent_fk FOREIGN KEY (parent_id) REFERENCES posts(id) ON DELETE SET NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND CONSTRAINT_NAME = 'posts_parent_fk'
);
PREPARE thia_migration_stmt FROM @thia_migration_sql;
EXECUTE thia_migration_stmt;
DEALLOCATE PREPARE thia_migration_stmt;
