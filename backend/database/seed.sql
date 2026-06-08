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
  'A secondary profile on the platform, present without making the whole room about her.',
  'Oslo',
  NULL,
  JSON_ARRAY('thia.lol'),
  JSON_ARRAY('frontend', 'soft systems', 'moon notes')
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
    'soft-launch',
    'Soft Launch',
    'A room for early notes, platform rituals, and what the day is asking for.',
    'quietly busy',
    284,
    1,
    'var(--accent-sun)',
    'public',
    @thia_user_id
  ),
  (
    'moon-table',
    'Moon Table',
    'Slow conversation, night work, tender critique, and tiny finished things.',
    'low blue',
    138,
    1,
    'var(--accent-frost)',
    'public',
    @thia_user_id
  ),
  (
    'garden-protocol',
    'Garden Protocol',
    'Designing care into tools, communities, defaults, and daily interfaces.',
    'green signal',
    402,
    0,
    'var(--accent-leaf)',
    'public',
    @thia_user_id
  ),
  (
    'afterglow',
    'Afterglow',
    'Music, fragments, long reads, and warm proof that people are still here.',
    'honey static',
    319,
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

INSERT INTO posts (
  author_id,
  room_id,
  body,
  mood,
  media_url,
  visibility,
  status
)
SELECT
  @thia_user_id,
  rooms.id,
  'The nicest launch state might be one where the platform feels awake before it asks anyone to perform.',
  'sunveil',
  '/ambient-veil.webp',
  'public',
  'published'
FROM rooms
WHERE rooms.slug = 'soft-launch'
  AND NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.author_id = @thia_user_id
      AND posts.room_id = rooms.id
      AND posts.body = 'The nicest launch state might be one where the platform feels awake before it asks anyone to perform.'
  );

INSERT INTO posts (
  author_id,
  room_id,
  body,
  mood,
  media_url,
  visibility,
  status
)
SELECT
  @thia_user_id,
  rooms.id,
  'A good room has affordances for entering, leaving, returning, and being forgiven for being quiet.',
  'garden',
  NULL,
  'public',
  'published'
FROM rooms
WHERE rooms.slug = 'garden-protocol'
  AND NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.author_id = @thia_user_id
      AND posts.room_id = rooms.id
      AND posts.body = 'A good room has affordances for entering, leaving, returning, and being forgiven for being quiet.'
  );

INSERT INTO posts (
  author_id,
  room_id,
  body,
  mood,
  media_url,
  visibility,
  status
)
SELECT
  @thia_user_id,
  rooms.id,
  'Tonight''s note: make the interface feel like it notices pressure without demanding speed.',
  'frostveil',
  NULL,
  'public',
  'published'
FROM rooms
WHERE rooms.slug = 'moon-table'
  AND NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.author_id = @thia_user_id
      AND posts.room_id = rooms.id
      AND posts.body = 'Tonight''s note: make the interface feel like it notices pressure without demanding speed.'
  );

INSERT INTO posts (
  author_id,
  room_id,
  body,
  mood,
  media_url,
  visibility,
  status
)
SELECT
  @thia_user_id,
  rooms.id,
  'Pinned a small loop for anyone writing after midnight. It does not solve the work. It makes the work kinder.',
  'afterglow',
  NULL,
  'public',
  'published'
FROM rooms
WHERE rooms.slug = 'afterglow'
  AND NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.author_id = @thia_user_id
      AND posts.room_id = rooms.id
      AND posts.body = 'Pinned a small loop for anyone writing after midnight. It does not solve the work. It makes the work kinder.'
  );
