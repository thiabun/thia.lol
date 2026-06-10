CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  type VARCHAR(50) NOT NULL,
  post_id BIGINT UNSIGNED NULL,
  room_id BIGINT UNSIGNED NULL,
  data JSON NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY notifications_user_read_created_idx (user_id, read_at, created_at),
  KEY notifications_actor_idx (actor_id),
  KEY notifications_post_idx (post_id),
  KEY notifications_room_idx (room_id),
  CONSTRAINT notifications_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT notifications_actor_fk
    FOREIGN KEY (actor_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT notifications_post_fk
    FOREIGN KEY (post_id) REFERENCES posts(id)
    ON DELETE SET NULL,
  CONSTRAINT notifications_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
