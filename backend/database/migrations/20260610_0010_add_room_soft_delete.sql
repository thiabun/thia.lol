SET @add_room_deleted_at = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD COLUMN deleted_at DATETIME NULL AFTER updated_at',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND COLUMN_NAME = 'deleted_at'
);
PREPARE add_room_deleted_at_statement FROM @add_room_deleted_at;
EXECUTE add_room_deleted_at_statement;
DEALLOCATE PREPARE add_room_deleted_at_statement;

SET @add_room_deleted_at_index = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE rooms ADD KEY rooms_deleted_at_idx (deleted_at)',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND INDEX_NAME = 'rooms_deleted_at_idx'
);
PREPARE add_room_deleted_at_index_statement FROM @add_room_deleted_at_index;
EXECUTE add_room_deleted_at_index_statement;
DEALLOCATE PREPARE add_room_deleted_at_index_statement;
