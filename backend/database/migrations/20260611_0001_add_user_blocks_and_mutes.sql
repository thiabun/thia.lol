CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id BIGINT UNSIGNED NOT NULL,
  blocked_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  KEY user_blocks_blocked_id_idx (blocked_id),
  KEY user_blocks_created_at_idx (created_at),
  CONSTRAINT user_blocks_blocker_id_fk
    FOREIGN KEY (blocker_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_blocks_blocked_id_fk
    FOREIGN KEY (blocked_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id BIGINT UNSIGNED NOT NULL,
  muted_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (muter_id, muted_id),
  KEY user_mutes_muted_id_idx (muted_id),
  KEY user_mutes_created_at_idx (created_at),
  CONSTRAINT user_mutes_muter_id_fk
    FOREIGN KEY (muter_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_mutes_muted_id_fk
    FOREIGN KEY (muted_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
