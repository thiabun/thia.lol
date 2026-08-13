UPDATE profile_modules
SET config_json = CASE
    WHEN title IS NULL
      AND (
        (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'Spotify playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'spotify'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'spotify'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'Apple Music playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'apple_music'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'apple_music'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'YouTube Music playlist'
          AND (
            (
              JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube_music'
              AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube_music'
            )
            OR (
              JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube'
              AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube'
            )
          )
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'YouTube playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube'
        )
      ) THEN JSON_SET(
      config_json,
      '$.label',
      'Spotify playlist',
      '$.platform',
      'spotify',
      '$.sourceMode',
      'spotify'
    )
    ELSE JSON_SET(
      config_json,
      '$.platform',
      'spotify',
      '$.sourceMode',
      'spotify'
    )
  END
WHERE type IN (
    'music_playlist',
    'spotify_playlist',
    'apple_music_playlist',
    'youtube_music_playlist',
    'youtube_playlist'
  )
  AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.url'))))
    REGEXP '^https://open[.]spotify[.]com([/?#]|$)';

UPDATE profile_modules
SET config_json = CASE
    WHEN title IS NULL
      AND (
        (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'Spotify playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'spotify'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'spotify'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'Apple Music playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'apple_music'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'apple_music'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'YouTube Music playlist'
          AND (
            (
              JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube_music'
              AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube_music'
            )
            OR (
              JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube'
              AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube'
            )
          )
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'YouTube playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube'
        )
      ) THEN JSON_SET(
      config_json,
      '$.label',
      'Apple Music playlist',
      '$.platform',
      'apple_music',
      '$.sourceMode',
      'apple_music'
    )
    ELSE JSON_SET(
      config_json,
      '$.platform',
      'apple_music',
      '$.sourceMode',
      'apple_music'
    )
  END
WHERE type IN (
    'music_playlist',
    'spotify_playlist',
    'apple_music_playlist',
    'youtube_music_playlist',
    'youtube_playlist'
  )
  AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.url'))))
    REGEXP '^https://(music|itunes)[.]apple[.]com([/?#]|$)';

UPDATE profile_modules
SET config_json = CASE
    WHEN title IS NULL
      AND (
        (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'Spotify playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'spotify'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'spotify'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'Apple Music playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'apple_music'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'apple_music'
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'YouTube Music playlist'
          AND (
            (
              JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube_music'
              AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube_music'
            )
            OR (
              JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube'
              AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube'
            )
          )
        )
        OR (
          JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.label')) = 'YouTube playlist'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.platform')) = 'youtube'
          AND JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.sourceMode')) = 'youtube'
        )
      ) THEN JSON_SET(
      config_json,
      '$.label',
      'YouTube playlist',
      '$.platform',
      'youtube',
      '$.sourceMode',
      'youtube'
    )
    ELSE JSON_SET(
      config_json,
      '$.platform',
      'youtube',
      '$.sourceMode',
      'youtube'
    )
  END
WHERE type IN (
    'music_playlist',
    'spotify_playlist',
    'apple_music_playlist',
    'youtube_music_playlist',
    'youtube_playlist'
  )
  AND (
    LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.url'))))
      REGEXP '^https://(www[.]|m[.]|music[.])?youtube[.]com([/?#]|$)'
    OR LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(config_json, '$.url'))))
      REGEXP '^https://youtu[.]be([/?#]|$)'
  );
