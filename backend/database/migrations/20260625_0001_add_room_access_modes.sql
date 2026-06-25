SET @update_rooms_visibility_modes = (
  SELECT IF(
    COLUMN_TYPE NOT LIKE "%'view_only'%",
    "ALTER TABLE rooms MODIFY COLUMN visibility ENUM('public', 'private', 'invite', 'view_only') NOT NULL DEFAULT 'public'",
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'visibility'
  LIMIT 1
);
PREPARE update_rooms_visibility_modes_statement FROM @update_rooms_visibility_modes;
EXECUTE update_rooms_visibility_modes_statement;
DEALLOCATE PREPARE update_rooms_visibility_modes_statement;

SET @add_rooms_visibility_idx = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD KEY rooms_visibility_idx (visibility)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND INDEX_NAME = 'rooms_visibility_idx'
);
PREPARE add_rooms_visibility_idx_statement FROM @add_rooms_visibility_idx;
EXECUTE add_rooms_visibility_idx_statement;
DEALLOCATE PREPARE add_rooms_visibility_idx_statement;

CREATE TABLE IF NOT EXISTS room_access_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'approved', 'denied', 'canceled') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY room_access_requests_room_requester_unique (room_id, requester_id),
  KEY room_access_requests_room_status_idx (room_id, status, created_at),
  KEY room_access_requests_requester_status_idx (requester_id, status),
  KEY room_access_requests_reviewed_by_idx (reviewed_by),
  CONSTRAINT room_access_requests_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT room_access_requests_requester_fk
    FOREIGN KEY (requester_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT room_access_requests_reviewer_fk
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
