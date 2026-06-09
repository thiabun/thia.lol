-- thia.lol post replies migration.
--
-- New installs already get posts.parent_id from backend/database/schema.sql.
-- Existing installs should run these checks in phpMyAdmin or the cPanel MySQL tool.
-- Run each ALTER only when the matching check returns no rows.

-- 1. Check whether the parent post column exists.
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'posts'
  AND COLUMN_NAME = 'parent_id';

-- If the SELECT above returns no rows:
ALTER TABLE posts
  ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER room_id;

-- 2. Check whether the reply lookup index exists.
SELECT INDEX_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'posts'
  AND INDEX_NAME = 'posts_parent_created_idx';

-- If the SELECT above returns no rows:
ALTER TABLE posts
  ADD KEY posts_parent_created_idx (parent_id, created_at);

-- 3. Check whether the parent post foreign key exists.
SELECT CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'posts'
  AND CONSTRAINT_NAME = 'posts_parent_fk';

-- If the SELECT above returns no rows:
ALTER TABLE posts
  ADD CONSTRAINT posts_parent_fk
    FOREIGN KEY (parent_id) REFERENCES posts(id)
    ON DELETE SET NULL;
