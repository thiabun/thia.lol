SET @add_profile_background_blur = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_background_blur VARCHAR(20) NOT NULL DEFAULT ''medium'' AFTER profile_background',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_background_blur'
);
PREPARE add_profile_background_blur_statement FROM @add_profile_background_blur;
EXECUTE add_profile_background_blur_statement;
DEALLOCATE PREPARE add_profile_background_blur_statement;

SET @add_profile_canvas_version = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profiles ADD COLUMN profile_canvas_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER profile_layout_preset',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profiles'
    AND COLUMN_NAME = 'profile_canvas_version'
);
PREPARE add_profile_canvas_version_statement FROM @add_profile_canvas_version;
EXECUTE add_profile_canvas_version_statement;
DEALLOCATE PREPARE add_profile_canvas_version_statement;

SET @add_profile_module_grid_column = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profile_modules ADD COLUMN grid_column TINYINT UNSIGNED NULL AFTER position',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profile_modules'
    AND COLUMN_NAME = 'grid_column'
);
PREPARE add_profile_module_grid_column_statement FROM @add_profile_module_grid_column;
EXECUTE add_profile_module_grid_column_statement;
DEALLOCATE PREPARE add_profile_module_grid_column_statement;

SET @add_profile_module_grid_row = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profile_modules ADD COLUMN grid_row TINYINT UNSIGNED NULL AFTER grid_column',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profile_modules'
    AND COLUMN_NAME = 'grid_row'
);
PREPARE add_profile_module_grid_row_statement FROM @add_profile_module_grid_row;
EXECUTE add_profile_module_grid_row_statement;
DEALLOCATE PREPARE add_profile_module_grid_row_statement;

SET @add_profile_module_grid_col_span = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profile_modules ADD COLUMN grid_col_span TINYINT UNSIGNED NULL AFTER grid_row',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profile_modules'
    AND COLUMN_NAME = 'grid_col_span'
);
PREPARE add_profile_module_grid_col_span_statement FROM @add_profile_module_grid_col_span;
EXECUTE add_profile_module_grid_col_span_statement;
DEALLOCATE PREPARE add_profile_module_grid_col_span_statement;

SET @add_profile_module_grid_row_span = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE profile_modules ADD COLUMN grid_row_span TINYINT UNSIGNED NULL AFTER grid_col_span',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'profile_modules'
    AND COLUMN_NAME = 'grid_row_span'
);
PREPARE add_profile_module_grid_row_span_statement FROM @add_profile_module_grid_row_span;
EXECUTE add_profile_module_grid_row_span_statement;
DEALLOCATE PREPARE add_profile_module_grid_row_span_statement;
