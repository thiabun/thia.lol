SET @add_profile_module_grid_pinned = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profile_modules ADD COLUMN grid_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER grid_row_span',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profile_modules'
    AND COLUMN_NAME = 'grid_pinned'
);
PREPARE add_profile_module_grid_pinned_statement FROM @add_profile_module_grid_pinned;
EXECUTE add_profile_module_grid_pinned_statement;
DEALLOCATE PREPARE add_profile_module_grid_pinned_statement;
