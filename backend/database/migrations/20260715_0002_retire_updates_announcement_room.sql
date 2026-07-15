UPDATE rooms
SET visibility = 'private',
    is_live = 0,
    deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP())
WHERE slug = 'updates';
