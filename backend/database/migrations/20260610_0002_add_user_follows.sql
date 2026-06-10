CREATE TABLE IF NOT EXISTS user_follows (
  follower_id BIGINT UNSIGNED NOT NULL,
  following_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  KEY user_follows_following_id_index (following_id),
  CONSTRAINT user_follows_follower_id_fk
    FOREIGN KEY (follower_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_follows_following_id_fk
    FOREIGN KEY (following_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
