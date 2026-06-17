# Media Uploads

> **Status: Operational reference.** Use this for current upload behavior,
> cPanel storage, file limits, conversion rules, video background limits, and
> deploy preservation requirements. Future upload work should be tracked in
> GitHub Issues.

`thia.lol` supports authenticated image uploads for profile customization, post
images, and room customization. It also supports restricted video uploads for
profile backgrounds only.

## Storage

Uploaded public media is stored under the deployed web root:

```text
public_html/uploads/media/yyyy/mm/generated-name.webp
```

The API returns public URLs such as:

```text
/uploads/media/2026/06/post_media-random.webp
```

Do not store uploads in `src/`, `dist/`, `backend/`, or `api/`. Do not commit uploaded files. The local development equivalent is `uploads/`, which is ignored by git.

## Image Limits and Types

- Maximum upload size: 10 MB.
- Empty files are rejected.
- Accepted input types: JPEG, PNG, and WebP.
- SVG, HTML, PDF, audio, and unknown binary files are rejected by the image endpoint.
- GIF upload is not enabled in this pass.

## Image Conversion

Uploads go through `/api/uploads/image` and are converted to WebP before storage. The endpoint uses PHP GD for cPanel compatibility and returns a clean error if WebP conversion is not available.

Before upload, the frontend opens a custom crop/zoom modal for current image
surfaces: profile avatar, profile banner, profile background, post/reply media,
room icon, and room banner. The crop is baked into the image file sent to the
existing upload endpoint; no crop metadata is stored in this pass.

Client crop defaults:

- avatar and room icon: locked square crop
- profile banner and room banner: locked 8:3 crop
- profile background: locked 16:9 crop
- post and reply media: original aspect by default, with square, portrait, and
  landscape presets

Processing rules:

- avatar: square crop to 512x512
- banner: max 1600x600
- profile background: max 1920x1080
- post image: max 1920px long edge
- room icon: square crop to 512x512
- room banner: max 1600x600
- output: `.webp`
- quality: 82
- metadata is stripped by decoding and re-encoding
- JPEG orientation is normalized when EXIF support is available

The endpoint returns only the public URL and image metadata. It does not expose local server filesystem paths.

## Video Background Uploads

Video uploads go through `/api/uploads/video` and are intentionally narrower
than image uploads.

Rules:

- Purpose must be `profile_background`.
- Maximum upload size: 30 MB.
- Empty files are rejected.
- Accepted MIME types after server sniffing: MP4 (`video/mp4`) and WebM
  (`video/webm`).
- Filenames are randomized and stored under
  `/uploads/media/yyyy/mm/profile_background-random.mp4|webm`.
- The endpoint does not transcode, resize, or inspect duration.
- The endpoint never accepts PHP-executable extensions.
- Profile background video URLs must match the generated upload path pattern
  before they can be saved to a profile.
- Background videos render muted, looped, playsInline, and without controls.
- Reduced-motion users get a poster/static fallback when a poster image is
  available.

Video uploads are not general-purpose post media, audio hosting, or provider
embeds. If richer video media is added later, it needs separate moderation,
duration, bandwidth, transcoding, and legal review.

## cPanel Notes

`public_html/uploads/` must be writable by PHP. A typical cPanel folder permission is `755`; some hosts may require `775` depending on PHP user ownership.

Deploys must preserve `public_html/uploads/`. Do not enable clean-slate FTP deploys that delete server-only upload folders.

The committed `api/.user.ini` requests:

```ini
upload_max_filesize = 30M
post_max_size = 32M
```

If the host ignores `.user.ini`, set equivalent cPanel PHP options manually.
`post_max_size` must be larger than the upload limit so PHP can parse the
request and the API can return clean JSON errors.

Profile background video currently has a 30 MB application limit. If cPanel/PHP
request limits are lower than that, increase `upload_max_filesize` and
`post_max_size` on the host before enabling large video uploads.

If uploads fail on production, check:

1. PHP GD extension and WebP support.
2. `public_html/uploads/` ownership and write permissions.
3. cPanel error logs.
4. `upload_max_filesize` and `post_max_size` are large enough for the endpoint
   being tested.
