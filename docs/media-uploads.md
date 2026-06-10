# Image Uploads

`thia.lol` supports authenticated image uploads for profile customization and post images.

## Storage

Uploaded public images are stored under the deployed web root:

```text
public_html/uploads/media/yyyy/mm/generated-name.webp
```

The API returns public URLs such as:

```text
/uploads/media/2026/06/post_media-random.webp
```

Do not store uploads in `src/`, `dist/`, `backend/`, or `api/`. Do not commit uploaded files. The local development equivalent is `uploads/`, which is ignored by git.

## Limits and Types

- Maximum upload size: 10 MB.
- Empty files are rejected.
- Accepted input types: JPEG, PNG, and WebP.
- SVG, HTML, PDF, video, audio, and unknown binary files are rejected.
- GIF upload is not enabled in this pass.

This is image upload support only. Video and audio uploads are deferred.

## Conversion

Uploads go through `/api/uploads/image` and are converted to WebP before storage. The endpoint uses PHP GD for cPanel compatibility and returns a clean error if WebP conversion is not available.

Processing rules:

- avatar: square crop to 512x512
- banner: max 1600x600
- profile background: max 1920x1080
- post image: max 1920px long edge
- output: `.webp`
- quality: 82
- metadata is stripped by decoding and re-encoding
- JPEG orientation is normalized when EXIF support is available

The endpoint returns only the public URL and image metadata. It does not expose local server filesystem paths.

## cPanel Notes

`public_html/uploads/` must be writable by PHP. A typical cPanel folder permission is `755`; some hosts may require `775` depending on PHP user ownership.

Deploys must preserve `public_html/uploads/`. Do not enable clean-slate FTP deploys that delete server-only upload folders.

The committed `api/.user.ini` requests:

```ini
upload_max_filesize = 10M
post_max_size = 11M
```

If the host ignores `.user.ini`, set equivalent cPanel PHP options manually. `post_max_size` must be larger than 10 MB so PHP can parse the request and the API can return clean JSON errors.

If uploads fail on production, check:

1. PHP GD extension and WebP support.
2. `public_html/uploads/` ownership and write permissions.
3. cPanel error logs.
4. `upload_max_filesize` is 10 MB and `post_max_size` is larger than 10 MB.
