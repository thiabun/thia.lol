SET @add_posts_public_id = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD COLUMN public_id VARCHAR(16) NULL AFTER id',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'public_id'
);
PREPARE add_posts_public_id_statement FROM @add_posts_public_id;
EXECUTE add_posts_public_id_statement;
DEALLOCATE PREPARE add_posts_public_id_statement;

UPDATE posts
SET public_id = CONCAT('p', LOWER(HEX(RANDOM_BYTES(6))))
WHERE public_id IS NULL OR public_id = '';

SET @require_posts_public_id = (
  SELECT IF(
    IS_NULLABLE = 'YES',
    'ALTER TABLE posts MODIFY COLUMN public_id VARCHAR(16) NOT NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'public_id'
  LIMIT 1
);
PREPARE require_posts_public_id_statement FROM @require_posts_public_id;
EXECUTE require_posts_public_id_statement;
DEALLOCATE PREPARE require_posts_public_id_statement;

SET @add_posts_public_id_unique = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD UNIQUE KEY posts_public_id_unique (public_id)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND INDEX_NAME = 'posts_public_id_unique'
);
PREPARE add_posts_public_id_unique_statement FROM @add_posts_public_id_unique;
EXECUTE add_posts_public_id_unique_statement;
DEALLOCATE PREPARE add_posts_public_id_unique_statement;
