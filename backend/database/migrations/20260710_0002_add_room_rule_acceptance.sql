SET @add_rooms_rules_version = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN rules_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER rules',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'rules_version'
);
PREPARE add_rooms_rules_version_statement FROM @add_rooms_rules_version;
EXECUTE add_rooms_rules_version_statement;
DEALLOCATE PREPARE add_rooms_rules_version_statement;

CREATE TABLE IF NOT EXISTS room_rule_acceptances (
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  rules_version INT UNSIGNED NOT NULL,
  accepted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id, rules_version),
  KEY room_rule_acceptances_user_idx (user_id, accepted_at),
  CONSTRAINT room_rule_acceptances_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT room_rule_acceptances_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  invitee_id BIGINT UNSIGNED NOT NULL,
  invited_by BIGINT UNSIGNED NULL,
  status ENUM('pending', 'accepted', 'revoked') NOT NULL DEFAULT 'pending',
  accepted_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY room_invitations_room_invitee_unique (room_id, invitee_id),
  KEY room_invitations_invitee_status_idx (invitee_id, status, updated_at),
  KEY room_invitations_room_status_idx (room_id, status, updated_at),
  KEY room_invitations_invited_by_idx (invited_by),
  CONSTRAINT room_invitations_room_fk
    FOREIGN KEY (room_id) REFERENCES rooms(id)
    ON DELETE CASCADE,
  CONSTRAINT room_invitations_invitee_fk
    FOREIGN KEY (invitee_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT room_invitations_invited_by_fk
    FOREIGN KEY (invited_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO room_rule_acceptances (room_id, user_id, rules_version, accepted_at)
SELECT memberships.room_id,
       memberships.user_id,
       rooms.rules_version,
       memberships.joined_at
FROM room_memberships memberships
INNER JOIN rooms ON rooms.id = memberships.room_id
WHERE memberships.banned_at IS NULL;

INSERT IGNORE INTO room_invitations (
  room_id,
  invitee_id,
  invited_by,
  status,
  accepted_at,
  revoked_at
)
SELECT memberships.room_id,
       memberships.user_id,
       rooms.created_by,
       'accepted',
       memberships.joined_at,
       NULL
FROM room_memberships memberships
INNER JOIN rooms ON rooms.id = memberships.room_id
WHERE memberships.banned_at IS NULL
  AND memberships.role <> 'owner'
  AND rooms.visibility IN ('private', 'view_only');
