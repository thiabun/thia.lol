SET @add_posts_body_format = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD COLUMN body_format ENUM(''plain'', ''markdown'') NOT NULL DEFAULT ''plain'' AFTER body',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'body_format'
);
PREPARE add_posts_body_format_statement FROM @add_posts_body_format;
EXECUTE add_posts_body_format_statement;
DEALLOCATE PREPARE add_posts_body_format_statement;

SET @add_posts_content_version = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE posts ADD COLUMN content_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER body_format',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'content_version'
);
PREPARE add_posts_content_version_statement FROM @add_posts_content_version;
EXECUTE add_posts_content_version_statement;
DEALLOCATE PREPARE add_posts_content_version_statement;

CREATE TABLE IF NOT EXISTS post_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  kind ENUM('image', 'video', 'audio', 'integration') NOT NULL,
  url VARCHAR(500) NULL,
  mime VARCHAR(80) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  duration_seconds DECIMAL(10,3) NULL,
  poster_url VARCHAR(500) NULL,
  provider VARCHAR(40) NULL,
  resource_type VARCHAR(40) NULL,
  resource_id VARCHAR(191) NULL,
  resource_key VARCHAR(255) NULL,
  source_url VARCHAR(500) NULL,
  card_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY post_attachments_post_position_unique (post_id, position),
  KEY post_attachments_post_kind_idx (post_id, kind),
  KEY post_attachments_provider_resource_idx (provider, resource_key),
  CONSTRAINT post_attachments_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO post_attachments (
  post_id,
  position,
  kind,
  url,
  mime,
  poster_url
)
SELECT
  p.id,
  1,
  CASE
    WHEN p.media_type = 'video' OR p.media_url REGEXP '\\.(mp4|webm)$' THEN 'video'
    ELSE 'image'
  END,
  p.media_url,
  p.media_mime,
  p.media_poster_url
FROM posts p
LEFT JOIN post_attachments existing
  ON existing.post_id = p.id
 AND existing.position = 1
WHERE p.media_url IS NOT NULL
  AND p.media_url <> ''
  AND existing.id IS NULL;
