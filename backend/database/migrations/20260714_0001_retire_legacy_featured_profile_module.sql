UPDATE profile_modules
SET status = 'deleted',
    visibility = 'hidden',
    updated_at = CURRENT_TIMESTAMP()
WHERE type = 'featured'
  AND status <> 'deleted';
