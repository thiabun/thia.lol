UPDATE profiles
INNER JOIN users ON users.id = profiles.user_id
SET
  profiles.bio = 'Founder profile for thia.lol.',
  profiles.traits = JSON_ARRAY('founder', 'frontend', 'moderation'),
  profiles.updated_at = CURRENT_TIMESTAMP
WHERE users.handle = 'thia'
  AND (
    profiles.bio = 'A secondary profile on the platform, present without making the whole room about her.'
    OR profiles.traits LIKE '%soft systems%'
    OR profiles.traits LIKE '%moon notes%'
  );

UPDATE rooms
SET
  slug = 'general',
  name = 'General',
  summary = 'A public room for everyday posts.',
  mood = 'open',
  member_count = 0,
  is_live = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'soft-launch';

UPDATE rooms
SET
  slug = 'updates',
  name = 'Updates',
  summary = 'News and changes from thia.lol.',
  mood = 'updates',
  member_count = 0,
  is_live = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'moon-table';

UPDATE rooms
SET
  slug = 'questions',
  name = 'Questions',
  summary = 'Ask questions and help other members.',
  mood = 'help',
  member_count = 0,
  is_live = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'garden-protocol';

UPDATE rooms
SET
  slug = 'media',
  name = 'Media',
  summary = 'Share links, images, and videos when media uploads are available.',
  mood = 'media',
  member_count = 0,
  is_live = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'afterglow';

DELETE FROM posts
WHERE body IN (
  'The nicest launch state might be one where the platform feels awake before it asks anyone to perform.',
  'A good room has affordances for entering, leaving, returning, and being forgiven for being quiet.',
  'Tonight''s note: make the interface feel like it notices pressure without demanding speed.',
  'Pinned a small loop for anyone writing after midnight. It does not solve the work. It makes the work kinder.'
);
