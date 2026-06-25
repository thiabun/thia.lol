ALTER TABLE posts
  ADD COLUMN media_type ENUM('image', 'video') NULL AFTER media_url,
  ADD COLUMN media_mime VARCHAR(80) NULL AFTER media_type,
  ADD COLUMN media_poster_url VARCHAR(500) NULL AFTER media_mime;
