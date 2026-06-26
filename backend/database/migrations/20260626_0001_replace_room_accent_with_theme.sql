SET @add_room_theme = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN theme VARCHAR(80) NULL AFTER is_live',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'theme'
);
PREPARE add_room_theme_statement FROM @add_room_theme;
EXECUTE add_room_theme_statement;
DEALLOCATE PREPARE add_room_theme_statement;

SET @add_room_theme_config_json = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN theme_config_json JSON NULL AFTER theme',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'theme_config_json'
);
PREPARE add_room_theme_config_json_statement FROM @add_room_theme_config_json;
EXECUTE add_room_theme_config_json_statement;
DEALLOCATE PREPARE add_room_theme_config_json_statement;

SET @backfill_room_theme = (
  SELECT IF(
    COUNT(*) = 1,
    'UPDATE rooms
     SET theme = CASE accent
          WHEN ''var(--accent-sun)'' THEN ''sunveil''
          WHEN ''var(--accent-frost)'' THEN ''frostveil''
          WHEN ''var(--accent-leaf)'' THEN ''leafveil''
          WHEN ''var(--accent-rose)'' THEN ''roseveil''
          ELSE NULL
        END,
        theme_config_json = CASE accent
          WHEN ''var(--accent-sun)'' THEN JSON_OBJECT(''mode'', ''preset'', ''preset'', ''sunveil'')
          WHEN ''var(--accent-frost)'' THEN JSON_OBJECT(''mode'', ''preset'', ''preset'', ''frostveil'')
          WHEN ''var(--accent-leaf)'' THEN JSON_OBJECT(''mode'', ''preset'', ''preset'', ''leafveil'')
          WHEN ''var(--accent-rose)'' THEN JSON_OBJECT(''mode'', ''preset'', ''preset'', ''roseveil'')
          ELSE NULL
        END
     WHERE theme IS NULL
       AND theme_config_json IS NULL',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'accent'
);
PREPARE backfill_room_theme_statement FROM @backfill_room_theme;
EXECUTE backfill_room_theme_statement;
DEALLOCATE PREPARE backfill_room_theme_statement;

SET @drop_room_accent = (
  SELECT IF(
    COUNT(*) = 1,
    'ALTER TABLE rooms DROP COLUMN accent',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'accent'
);
PREPARE drop_room_accent_statement FROM @drop_room_accent;
EXECUTE drop_room_accent_statement;
DEALLOCATE PREPARE drop_room_accent_statement;
