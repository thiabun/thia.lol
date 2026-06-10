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

INSERT INTO rooms (
  slug,
  name,
  summary,
  mood,
  member_count,
  is_live,
  accent,
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
    'var(--accent-sun)',
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
    'var(--accent-frost)',
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
    'var(--accent-leaf)',
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
    'var(--accent-rose)',
    'public',
    @thia_user_id
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  summary = VALUES(summary),
  mood = VALUES(mood),
  member_count = VALUES(member_count),
  is_live = VALUES(is_live),
  accent = VALUES(accent),
  visibility = VALUES(visibility),
  created_by = VALUES(created_by),
  updated_at = CURRENT_TIMESTAMP;
