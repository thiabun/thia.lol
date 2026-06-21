CREATE TABLE IF NOT EXISTS profile_stars (
  starrer_id BIGINT UNSIGNED NOT NULL,
  starred_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (starrer_id, starred_user_id),
  KEY profile_stars_starred_user_id_idx (starred_user_id),
  KEY profile_stars_created_at_idx (created_at),
  CONSTRAINT profile_stars_starrer_id_fk
    FOREIGN KEY (starrer_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT profile_stars_starred_user_id_fk
    FOREIGN KEY (starred_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
