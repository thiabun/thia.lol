SET @add_room_icon_url = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN icon_url VARCHAR(500) NULL AFTER accent',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'icon_url'
);
PREPARE add_room_icon_url_statement FROM @add_room_icon_url;
EXECUTE add_room_icon_url_statement;
DEALLOCATE PREPARE add_room_icon_url_statement;

SET @add_room_banner_url = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN banner_url VARCHAR(500) NULL AFTER icon_url',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'banner_url'
);
PREPARE add_room_banner_url_statement FROM @add_room_banner_url;
EXECUTE add_room_banner_url_statement;
DEALLOCATE PREPARE add_room_banner_url_statement;

SET @add_room_rules = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN rules TEXT NULL AFTER banner_url',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'rules'
);
PREPARE add_room_rules_statement FROM @add_room_rules;
EXECUTE add_room_rules_statement;
DEALLOCATE PREPARE add_room_rules_statement;

CREATE TABLE IF NOT EXISTS room_memberships (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  muted_at DATETIME NULL,
  banned_at DATETIME NULL,
  UNIQUE KEY room_memberships_room_user_unique (room_id, user_id),
  KEY room_memberships_room_id_idx (room_id),
  KEY room_memberships_user_id_idx (user_id),
  KEY room_memberships_role_idx (role),
  CONSTRAINT room_memberships_room_id_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT room_memberships_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO room_memberships (room_id, user_id, role)
SELECT id, created_by, 'owner'
FROM rooms
WHERE created_by IS NOT NULL;

UPDATE room_memberships memberships
INNER JOIN rooms ON rooms.id = memberships.room_id
SET memberships.role = 'owner',
    memberships.banned_at = NULL
WHERE rooms.created_by = memberships.user_id;

UPDATE rooms
LEFT JOIN (
  SELECT room_id, COUNT(*) AS member_total
  FROM room_memberships
  WHERE banned_at IS NULL
  GROUP BY room_id
) membership_counts ON membership_counts.room_id = rooms.id
SET rooms.member_count = COALESCE(membership_counts.member_total, 0);
