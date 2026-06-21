# Media Uploads

> **Status: Operational reference.** Use this for current upload behavior,
> cPanel storage, file limits, temporary no-conversion rules, video background limits, and
> deploy preservation requirements. Future upload work should be tracked in
> GitHub Issues.

`thia.lol` supports authenticated image uploads for profile customization, post
images, and room customization. It also supports restricted MP4/WebM uploads for
profile backgrounds and profile video modules.

## Storage

Uploaded public media is stored under the deployed web root:

```text
public_html/uploads/media/yyyy/mm/generated-name.jpg|png|webp|gif|mp4|webm
```

The API returns public URLs such as:

```text
/uploads/media/2026/06/post_media-random.jpg
```

Do not store uploads in `src/`, `dist/`, `backend/`, or `api/`. Do not commit uploaded files. The local development equivalent is `uploads/`, which is ignored by git.

## Image Limits and Types

- Maximum upload size: 10 MB.
- Empty files are rejected.
- Accepted input types: JPEG, PNG, WebP, and GIF.
- SVG, HTML, PDF, audio, and unknown binary files are rejected by the image endpoint.
- HEIC, HEIF, TIFF, JPEG XL, BMP, and AVIF are not enabled while server-side conversion is disabled.

## Temporary No-Conversion Image Mode

Uploads go through `/api/uploads/image` and are stored as safe original files.
The cPanel host cannot reliably run image conversion right now, so the API does
not convert, resize, strip metadata, or normalize orientation server-side. This
is temporary until the VPS migration restores a conversion pipeline.

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

- server output preserves the uploaded safe MIME and extension
- accepted output extensions are `.jpg`, `.jpeg`, `.png`, `.webp`, and `.gif`
- purpose, size, MIME sniffing, and `getimagesize()` checks still run
- SVG and executable/document formats remain blocked
- client-side crop output is stored as submitted

The endpoint returns only the public URL and image metadata. It does not expose local server filesystem paths.

## Video Uploads

Video uploads go through `/api/uploads/video` and are intentionally narrower
than image uploads.

Rules:

- Purpose must be `profile_background` or `profile_module_video`.
- Maximum upload size: 30 MB.
- Empty files are rejected.
- Accepted MIME types after server sniffing: MP4 (`video/mp4`) and WebM
  (`video/webm`).
- Filenames are randomized and stored under
  `/uploads/media/yyyy/mm/profile_background-random.mp4|webm` or
  `/uploads/media/yyyy/mm/profile_module_video-random.mp4|webm`.
- The endpoint does not transcode, resize, or inspect duration.
- The endpoint never accepts PHP-executable extensions.
- Profile background and module video URLs must match generated upload path
  patterns before they can be saved.
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

1. `public_html/uploads/` ownership and write permissions.
2. Whether the uploaded file is one of the temporary safe formats.
3. cPanel error logs.
4. `upload_max_filesize` and `post_max_size` are large enough for the endpoint
   being tested.
