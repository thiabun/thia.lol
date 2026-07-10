# Media Uploads

> **Status: Operational reference.** Use this for current upload behavior,
> VPS storage, file limits, conversion rules, FFmpeg requirements, and deploy
> preservation requirements. Future upload work should be tracked in GitHub
> Issues.

`thia.lol` supports authenticated image, video, and audio uploads for profile
customization, posts, replies, rooms, and profile media modules. Uploads are
processed by the Node API on the VPS; the app should not rely on browser MIME
claims or store arbitrary original files.

## Storage

Uploaded public media is stored under the deployed web root:

```text
/srv/thia.lol/www/uploads/media/yyyy/mm/generated-name.webp
/srv/thia.lol/www/uploads/media/yyyy/mm/generated-name.mp4
/srv/thia.lol/www/uploads/media/yyyy/mm/generated-name.mp3
/srv/thia.lol/www/uploads/media/yyyy/mm/generated-name-poster.webp
```

The API returns public URLs such as:

```text
/uploads/media/2026/06/post_media-random.webp
/uploads/media/2026/06/post_media-random.mp4
/uploads/media/2026/06/post_media-random.mp3
```

Do not store uploads in `src/`, `dist/`, `backend/`, or `api/`. Do not commit
uploaded files. The local development equivalent is `uploads/`, which is
ignored by git.

## Images

Images go through `/api/uploads/image`.

Rules:

- Maximum upload size: 10 MB.
- Purpose must be one of `avatar`, `banner`, `profile_background`,
  `post_media`, `room_icon`, or `room_banner`.
- Accepted input formats after server sniffing: JPEG, PNG, WebP, GIF, AVIF,
  HEIC/HEIF, TIFF, and BMP.
- Stored output is always WebP.
- Server processing strips metadata, auto-orients, and resizes inside the
  purpose limit used by the existing crop surfaces.
- SVG, HTML, PDF, executables, documents, audio, and unknown binary files are
  rejected.

Before upload, the frontend opens a custom crop/zoom modal for current image
surfaces: profile avatar, profile banner, profile background, post/reply media,
room icon, and room banner. If the browser cannot decode the selected source
before cropping, the frontend can call:

```text
POST /api/uploads/image?preview=1
```

That endpoint is authenticated, requires CSRF, returns a non-stored WebP blob,
and avoids a separate Caddy route for preview conversion.

Client crop defaults:

- avatar and room icon: locked square crop
- profile banner and room banner: locked 8:3 crop
- profile background: locked 16:9 crop
- post and reply media: original aspect by default, with square, portrait, and
  landscape presets

## Videos

Videos go through `/api/uploads/video`.

Rules:

- Maximum upload size: 100 MB.
- Purpose must be `profile_background`, `profile_module_video`, or
  `post_media`.
- Accepted input formats after server sniffing and extension fallback: MP4,
  WebM, MOV, M4V, 3GP/3G2, MKV, AVI, MPEG/MPG, and OGG.
- Stored output is MP4/H.264/AAC with `faststart`, capped at 720p.
- A WebP poster is generated beside every transcoded video.
- Profile background videos are capped at about 30 seconds and audio is
  stripped.
- Post media and profile module videos are capped at about 2 minutes and keep
  audio.
- Existing old WebM URLs should stay renderable, but new uploads should be MP4.

Video upload responses include `url`, `posterUrl`, `mime`, `width`, `height`,
and `duration` when FFprobe can provide them. Post/reply/featured-post and
uploaded profile-module video renders with controls, inline playback, a poster,
and muted focus-based autoplay. Only the most focused registered video plays;
offscreen video pauses, and consented profile music blocks profile video
autoplay while it has priority.

## Audio

Audio goes through `/api/uploads/audio`.

Rules:

- Maximum upload size: 20 MB.
- Purpose must be `profile_music` or `post_media`.
- Accepted input after server sniffing and extension fallback: MP3, M4A, AAC,
  WAV, FLAC, and OGG.
- Stored output is MP3 with `audio/mpeg`. MP3 uploads are stored directly;
  other accepted formats are converted through FFmpeg before storage.
- Browser-only MIME claims and unknown binaries are rejected.

Audio upload responses include `url`, `mime`, `size`, `purpose`, and optional
`duration` when conversion can inspect it, plus
`mediaType: "audio"`. Post and reply composers attach audio through the same
ordered attachment tray as images and videos.

## Post and Reply Attachments

New posts and replies write `body_format = markdown` and `content_version = 3`.
Existing rows remain `plain` and version `1`. Render Markdown only when the API
payload says `bodyFormat: "markdown"`.

Posts and replies can include up to 8 ordered attachments. Supported attachment
kinds are:

- `image`: uploaded post media WebP/JPEG/PNG/GIF.
- `video`: uploaded post media MP4/WebM with a WebP poster.
- `audio`: uploaded post media audio stored as MP3.
- `integration`: allowlisted music cards for Spotify, YouTube, and Apple Music
  URLs/catalog-backed cards.

During rollout, the API still accepts old single-media `mediaUrl`, `mediaType`,
`mediaMime`, and `mediaPosterUrl` input. Responses still expose those legacy
fields from the first image or video attachment so older UI surfaces keep
working.

## VPS Requirements

System FFmpeg and FFprobe must be installed on the VPS and visible to the Node
API runtime. Defaults are:

```text
THIA_FFMPEG_PATH=ffmpeg
THIA_FFPROBE_PATH=ffprobe
```

Production Caddy and Node multipart limits must be kept in sync with the app
largest upload limit:

- Caddy `request_body max_size 100MB`
- Fastify multipart default limit: 100 MB
- Application video upload limit: 100 MB

`/srv/thia.lol/www/uploads/` must be writable by the `thia-node-api` runtime
user and readable by Caddy. Production uses `www-data` group ownership for
uploaded media.

Deploys must preserve `/srv/thia.lol/www/uploads/`. Do not enable rsync rules
that delete server-owned upload folders.

If uploads fail on production, check:

1. `/srv/thia.lol/www/uploads/` ownership and write permissions.
2. `ffmpeg -version` and `ffprobe -version` for the runtime environment.
3. Whether the uploaded file is in the accepted input set.
4. Caddy `request_body` and Node multipart limits.
5. Caddy and `thia-node-api.service` logs.
