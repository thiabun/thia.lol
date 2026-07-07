UPDATE profiles
SET profile_theme = CASE profile_theme
  WHEN 'sunveil' THEN 'glinda'
  WHEN 'frostveil' THEN 'elphaba'
  ELSE profile_theme
END
WHERE profile_theme IN ('sunveil', 'frostveil');

UPDATE profiles
SET profile_theme_config_json = JSON_SET(
  profile_theme_config_json,
  '$.preset',
  CASE JSON_UNQUOTE(JSON_EXTRACT(profile_theme_config_json, '$.preset'))
    WHEN 'sunveil' THEN 'glinda'
    WHEN 'frostveil' THEN 'elphaba'
    ELSE JSON_UNQUOTE(JSON_EXTRACT(profile_theme_config_json, '$.preset'))
  END
)
WHERE profile_theme_config_json IS NOT NULL
  AND JSON_VALID(profile_theme_config_json)
  AND JSON_UNQUOTE(JSON_EXTRACT(profile_theme_config_json, '$.mode')) = 'preset'
  AND JSON_UNQUOTE(JSON_EXTRACT(profile_theme_config_json, '$.preset')) IN ('sunveil', 'frostveil');

UPDATE rooms
SET theme = CASE theme
  WHEN 'sunveil' THEN 'glinda'
  WHEN 'frostveil' THEN 'elphaba'
  ELSE theme
END
WHERE theme IN ('sunveil', 'frostveil');

UPDATE rooms
SET theme_config_json = JSON_SET(
  theme_config_json,
  '$.preset',
  CASE JSON_UNQUOTE(JSON_EXTRACT(theme_config_json, '$.preset'))
    WHEN 'sunveil' THEN 'glinda'
    WHEN 'frostveil' THEN 'elphaba'
    ELSE JSON_UNQUOTE(JSON_EXTRACT(theme_config_json, '$.preset'))
  END
)
WHERE theme_config_json IS NOT NULL
  AND JSON_VALID(theme_config_json)
  AND JSON_UNQUOTE(JSON_EXTRACT(theme_config_json, '$.mode')) = 'preset'
  AND JSON_UNQUOTE(JSON_EXTRACT(theme_config_json, '$.preset')) IN ('sunveil', 'frostveil');
