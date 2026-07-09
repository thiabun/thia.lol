UPDATE profile_modules
SET type = CASE
    WHEN type IN ('spotify_playlist', 'apple_music_playlist', 'youtube_music_playlist') THEN 'music_playlist'
    WHEN type IN (
      'spotify_song',
      'apple_music_song',
      'youtube_music_song',
      'spotify_artist',
      'apple_music_artist',
      'youtube_music_artist'
    ) THEN 'music'
    ELSE type
  END,
  updated_at = CURRENT_TIMESTAMP()
WHERE type IN (
  'spotify_song',
  'apple_music_song',
  'youtube_music_song',
  'spotify_playlist',
  'apple_music_playlist',
  'youtube_music_playlist',
  'spotify_artist',
  'apple_music_artist',
  'youtube_music_artist'
);
