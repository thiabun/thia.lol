-- thia.lol starter seed data.
--
-- Import order:
-- 1. Import backend/database/schema.sql first.
-- 2. Import this file second.
--
-- This seed creates public starter content only. It does not create usable
-- login credentials, real passwords, sessions, reports, or moderation records.

INSERT INTO users (handle, email, password_hash, role)
VALUES ('thia', 'thia@example.invalid', NULL, 'admin')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  password_hash = users.password_hash,
  role = VALUES(role),
  updated_at = CURRENT_TIMESTAMP;

SET @thia_user_id := (
  SELECT id
  FROM users
  WHERE handle = 'thia'
  LIMIT 1
);

INSERT INTO profiles (
  user_id,
  display_name,
  bio,
  location,
  avatar_url,
  links,
  traits
)
VALUES (
  @thia_user_id,
  'Thia',
  'Founder profile for thia.lol.',
  'Oslo',
  NULL,
  JSON_ARRAY('thia.lol'),
  JSON_ARRAY('founder', 'frontend', 'moderation')
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  bio = VALUES(bio),
  location = VALUES(location),
  avatar_url = VALUES(avatar_url),
  links = VALUES(links),
  traits = VALUES(traits),
  updated_at = CURRENT_TIMESTAMP;

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
    'glinda',
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
    'elphaba',
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

INSERT INTO rooms (
  slug,
  name,
  summary,
  mood,
  member_count,
  is_live,
  theme,
  theme_config_json,
  visibility,
  created_by
)
VALUES
  (
    'general',
    'General',
    'A public room for everyday posts.',
    'open',
    0,
    1,
    'glinda',
    JSON_OBJECT('mode', 'preset', 'preset', 'glinda'),
    'public',
    @thia_user_id
  ),
  (
    'updates',
    'Updates',
    'News and changes from thia.lol.',
    'updates',
    0,
    1,
    'elphaba',
    JSON_OBJECT('mode', 'preset', 'preset', 'elphaba'),
    'public',
    @thia_user_id
  ),
  (
    'questions',
    'Questions',
    'Ask questions and help other members.',
    'help',
    0,
    0,
    'leafveil',
    JSON_OBJECT('mode', 'preset', 'preset', 'leafveil'),
    'public',
    @thia_user_id
  ),
  (
    'media',
    'Media',
    'Share links, images, and videos when media uploads are available.',
    'media',
    0,
    0,
    'roseveil',
    JSON_OBJECT('mode', 'preset', 'preset', 'roseveil'),
    'public',
    @thia_user_id
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  summary = VALUES(summary),
  mood = VALUES(mood),
  member_count = VALUES(member_count),
  is_live = VALUES(is_live),
  theme = VALUES(theme),
  theme_config_json = VALUES(theme_config_json),
  visibility = VALUES(visibility),
  created_by = VALUES(created_by),
  updated_at = CURRENT_TIMESTAMP;
