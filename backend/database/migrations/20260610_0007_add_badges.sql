CREATE TABLE IF NOT EXISTS badges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  badge_key VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  rarity VARCHAR(30) NOT NULL DEFAULT 'common',
  source VARCHAR(40) NOT NULL DEFAULT 'system',
  icon VARCHAR(80) NULL,
  accent VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY badges_badge_key_unique (badge_key),
  KEY badges_active_rarity_idx (is_active, rarity),
  KEY badges_source_idx (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  badge_id BIGINT UNSIGNED NOT NULL,
  granted_by BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  featured_order INT NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY user_badges_unique (user_id, badge_id),
  KEY user_badges_user_id_idx (user_id),
  KEY user_badges_badge_id_idx (badge_id),
  KEY user_badges_featured_order_idx (featured_order),
  CONSTRAINT user_badges_user_id_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT user_badges_badge_id_fk
    FOREIGN KEY (badge_id) REFERENCES badges(id)
    ON DELETE CASCADE,
  CONSTRAINT user_badges_granted_by_fk
    FOREIGN KEY (granted_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO badges (badge_key, name, description, rarity, source, icon, accent, is_active)
VALUES
  (
    'founder',
    'Founder',
    'Granted to people who helped establish thia.lol as a real community space.',
    'founder',
    'admin-granted',
    'sparkles',
    'founder',
    1
  ),
  (
    'early_user',
    'Early User',
    'Recognizes members who joined during the early platform era.',
    'rare',
    'admin-granted',
    'calendar-days',
    'sunveil',
    1
  ),
  (
    'bug_hunter',
    'Bug Hunter',
    'Granted for useful bug reports that improved the platform.',
    'epic',
    'admin-granted',
    'bug',
    'leaf',
    1
  ),
  (
    'moderator',
    'Moderator',
    'Identifies trusted members who help keep the platform safe and coherent.',
    'legendary',
    'admin-granted',
    'shield',
    'frostveil',
    1
  ),
  (
    'room_owner',
    'Room Owner',
    'Reserved for members who steward a public room with clear purpose.',
    'rare',
    'admin-granted',
    'radio',
    'cool',
    1
  ),
  (
    'mutual_magnet',
    'Mutual Magnet',
    'Recognizes members who build meaningful mutual connections without pressure loops.',
    'epic',
    'admin-granted',
    'users',
    'rose',
    1
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  rarity = VALUES(rarity),
  source = VALUES(source),
  icon = VALUES(icon),
  accent = VALUES(accent),
  is_active = VALUES(is_active);
