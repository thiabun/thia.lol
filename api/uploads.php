<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const IMAGE_UPLOAD_MAX_BYTES = 10485760;
const VIDEO_UPLOAD_MAX_BYTES = 31457280;
const AUDIO_UPLOAD_MAX_BYTES = 20971520;
const UPLOAD_DIRECTORY_MODE = 02775;
const IMAGE_UPLOAD_MIME_EXTENSIONS = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/gif' => 'gif',
];
const VIDEO_UPLOAD_MIME_EXTENSIONS = [
    'video/mp4' => 'mp4',
    'video/webm' => 'webm',
];

function uploads_dispatch(array $segments, string $method): void
{
    if (count($segments) !== 2 || ($segments[0] ?? null) !== 'uploads' || !in_array($segments[1], ['image', 'video', 'audio'], true)) {
        json_error('Not found.', 404);
    }

    if ($method !== 'POST') {
        json_error('Method not allowed.', 405);
    }

    if ($segments[1] === 'image') {
        uploads_image_create();
    }

    if ($segments[1] === 'video') {
        uploads_video_create();
    }

    uploads_audio_create();
}

function uploads_image_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

    if ($contentLength > IMAGE_UPLOAD_MAX_BYTES) {
        json_error('Image must be 10 MB or smaller.', 413);
    }

    $purpose = validate_upload_purpose($_POST['purpose'] ?? null);
    $file = uploaded_image_file('file');
    $mime = detect_uploaded_image_mime($file['tmp_name']);
    $storage = create_upload_destination($purpose, uploaded_image_extension($mime));

    if (!move_uploaded_file($file['tmp_name'], $storage['path'])) {
        json_error('Image could not be stored.', 500);
    }

    @chmod($storage['path'], 0644);

    $imageSize = getimagesize($storage['path']);
    $size = filesize($storage['path']);

    if ($imageSize === false || $size === false) {
        json_error('Image could not be verified after upload.', 500);
    }

    json_success([
        'url' => $storage['url'],
        'width' => (int) $imageSize[0],
        'height' => (int) $imageSize[1],
        'mime' => $mime,
        'type' => $mime,
        'size' => (int) $size,
        'purpose' => $purpose,
    ], 201);
}

function uploads_video_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

    if ($contentLength > VIDEO_UPLOAD_MAX_BYTES) {
        json_error('Video must be 30 MB or smaller.', 413);
    }

    $purpose = validate_video_upload_purpose($_POST['purpose'] ?? null);
    $file = uploaded_video_file('file');
    $mime = detect_uploaded_video_mime($file['tmp_name'], $file['name']);
    $storage = create_upload_destination($purpose, uploaded_video_extension($mime));

    if (!move_uploaded_file($file['tmp_name'], $storage['path'])) {
        json_error('Video could not be stored.', 500);
    }

    @chmod($storage['path'], 0644);

    $size = filesize($storage['path']);

    if ($size === false || $size <= 0) {
        json_error('Video could not be verified after upload.', 500);
    }

    json_success([
        'url' => $storage['url'],
        'mime' => $mime,
        'type' => $mime,
        'size' => (int) $size,
        'purpose' => $purpose,
    ], 201);
}

function uploads_audio_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

    if ($contentLength > AUDIO_UPLOAD_MAX_BYTES) {
        json_error('Audio must be 20 MB or smaller.', 413);
    }

    $purpose = validate_audio_upload_purpose($_POST['purpose'] ?? null);
    $file = uploaded_audio_file('file');
    $mime = detect_uploaded_audio_mime($file['tmp_name']);
    $storage = create_upload_destination($purpose, 'mp3');

    if (!move_uploaded_file($file['tmp_name'], $storage['path'])) {
        json_error('Audio could not be stored.', 500);
    }

    @chmod($storage['path'], 0644);

    $size = filesize($storage['path']);

    if ($size === false || $size <= 0) {
        json_error('Audio could not be verified after upload.', 500);
    }

    json_success([
        'url' => $storage['url'],
        'mime' => $mime,
        'type' => $mime,
        'size' => (int) $size,
        'purpose' => $purpose,
    ], 201);
}

function validate_upload_purpose(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose where this image will be used.', 422);
    }

    $purpose = trim($value);
    $allowed = ['avatar', 'banner', 'profile_background', 'post_media', 'room_icon', 'room_banner'];

    if (!in_array($purpose, $allowed, true)) {
        json_error('Unsupported image purpose.', 422);
    }

    return $purpose;
}

function validate_video_upload_purpose(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose where this video will be used.', 422);
    }

    $purpose = trim($value);

    if (!in_array($purpose, ['profile_background', 'profile_module_video'], true)) {
        json_error('Unsupported video purpose.', 422);
    }

    return $purpose;
}

function validate_audio_upload_purpose(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Choose where this audio will be used.', 422);
    }

    $purpose = trim($value);

    if ($purpose !== 'profile_music') {
        json_error('Unsupported audio purpose.', 422);
    }

    return $purpose;
}

function uploaded_image_file(string $field): array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        json_error('Choose an image to upload.', 422);
    }

    $file = $_FILES[$field];
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        json_error('Choose an image to upload.', 422);
    }

    if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
        json_error('Image must be 10 MB or smaller.', 413);
    }

    if ($error !== UPLOAD_ERR_OK) {
        json_error('Image could not be uploaded.', 400);
    }

    $size = (int) ($file['size'] ?? 0);
    $tmpName = $file['tmp_name'] ?? '';

    if (!is_string($tmpName) || $tmpName === '' || !is_uploaded_file($tmpName)) {
        json_error('Image could not be uploaded.', 400);
    }

    if ($size <= 0) {
        json_error('Image cannot be empty.', 422);
    }

    if ($size > IMAGE_UPLOAD_MAX_BYTES) {
        json_error('Image must be 10 MB or smaller.', 413);
    }

    return [
        'tmp_name' => $tmpName,
        'size' => $size,
    ];
}

function uploaded_video_file(string $field): array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        json_error('Choose a video to upload.', 422);
    }

    $file = $_FILES[$field];
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        json_error('Choose a video to upload.', 422);
    }

    if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
        json_error('Video must be 30 MB or smaller.', 413);
    }

    if ($error !== UPLOAD_ERR_OK) {
        json_error('Video could not be uploaded.', 400);
    }

    $size = (int) ($file['size'] ?? 0);
    $tmpName = $file['tmp_name'] ?? '';

    if (!is_string($tmpName) || $tmpName === '' || !is_uploaded_file($tmpName)) {
        json_error('Video could not be uploaded.', 400);
    }

    if ($size <= 0) {
        json_error('Video cannot be empty.', 422);
    }

    if ($size > VIDEO_UPLOAD_MAX_BYTES) {
        json_error('Video must be 30 MB or smaller.', 413);
    }

    return [
        'tmp_name' => $tmpName,
        'size' => $size,
        'name' => is_string($file['name'] ?? null) ? (string) $file['name'] : '',
    ];
}

function uploaded_audio_file(string $field): array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        json_error('Choose an audio file to upload.', 422);
    }

    $file = $_FILES[$field];
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        json_error('Choose an audio file to upload.', 422);
    }

    if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
        json_error('Audio must be 20 MB or smaller.', 413);
    }

    if ($error !== UPLOAD_ERR_OK) {
        json_error('Audio could not be uploaded.', 400);
    }

    $size = (int) ($file['size'] ?? 0);
    $tmpName = $file['tmp_name'] ?? '';

    if (!is_string($tmpName) || $tmpName === '' || !is_uploaded_file($tmpName)) {
        json_error('Audio could not be uploaded.', 400);
    }

    if ($size <= 0) {
        json_error('Audio cannot be empty.', 422);
    }

    if ($size > AUDIO_UPLOAD_MAX_BYTES) {
        json_error('Audio must be 20 MB or smaller.', 413);
    }

    return [
        'tmp_name' => $tmpName,
        'size' => $size,
    ];
}

function detect_uploaded_image_mime(string $path): string
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = normalize_uploaded_image_mime($finfo->file($path));

    if (!is_string($mime)) {
        json_error('Unsupported image type.', 415);
    }

    $allowed = uploaded_image_allowed_mimes();

    if (!in_array($mime, $allowed, true)) {
        json_error('Unsupported image type. Use JPEG, PNG, WebP, or GIF.', 415);
    }

    $size = getimagesize($path);

    if ($size === false || !in_array(normalize_uploaded_image_mime($size['mime'] ?? null), $allowed, true)) {
        json_error('Image could not be decoded.', 415);
    }

    return $mime;
}

function detect_uploaded_video_mime(string $path, string $filename = ''): string
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = normalize_uploaded_video_mime($finfo->file($path));

    if (!is_string($mime)) {
        json_error('Unsupported video type.', 415);
    }

    if (!uploaded_video_input_mime_allowed($mime)) {
        json_error('Unsupported video type. Use MP4 or WebM.', 415);
    }

    return $mime;
}

function detect_uploaded_audio_mime(string $path): string
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($path);

    if (!is_string($mime)) {
        json_error('Unsupported audio type.', 415);
    }

    if (!in_array($mime, ['audio/mpeg', 'audio/mp3'], true)) {
        json_error('Unsupported audio type. Use MP3.', 415);
    }

    return 'audio/mpeg';
}

function normalize_uploaded_image_mime(mixed $mime): ?string
{
    if (!is_string($mime)) {
        return null;
    }

    return match (strtolower(trim($mime))) {
        'image/jpg', 'image/jpeg', 'image/pjpeg' => 'image/jpeg',
        'image/png', 'image/x-png' => 'image/png',
        'image/webp', 'image/x-webp' => 'image/webp',
        'image/gif' => 'image/gif',
        default => strtolower(trim($mime)),
    };
}

function uploaded_image_allowed_mimes(): array
{
    return array_keys(IMAGE_UPLOAD_MIME_EXTENSIONS);
}

function uploaded_image_extension(string $mime): string
{
    return IMAGE_UPLOAD_MIME_EXTENSIONS[$mime] ?? 'bin';
}

function normalize_uploaded_video_mime(mixed $mime): ?string
{
    if (!is_string($mime)) {
        return null;
    }

    return match (strtolower(trim($mime))) {
        'video/mp4', 'application/mp4', 'video/x-mp4' => 'video/mp4',
        'video/webm' => 'video/webm',
        default => strtolower(trim($mime)),
    };
}

function uploaded_video_input_mimes(): array
{
    return array_keys(VIDEO_UPLOAD_MIME_EXTENSIONS);
}

function uploaded_video_input_mime_allowed(string $mime): bool
{
    return in_array(normalize_uploaded_video_mime($mime), uploaded_video_input_mimes(), true);
}

function uploaded_video_filename_extension_allowed(string $filename): bool
{
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    return in_array($extension, array_values(VIDEO_UPLOAD_MIME_EXTENSIONS), true);
}

function uploaded_video_extension(string $mime): string
{
    return VIDEO_UPLOAD_MIME_EXTENSIONS[$mime] ?? 'bin';
}

function create_upload_destination(string $purpose, string $extension = 'webp'): array
{
    $year = gmdate('Y');
    $month = gmdate('m');
    $relativeDir = "uploads/media/{$year}/{$month}";
    $absoluteDir = dirname(__DIR__) . "/{$relativeDir}";

    ensure_upload_directory(dirname(__DIR__) . '/uploads');
    ensure_upload_directory(dirname(__DIR__) . '/uploads/media');
    ensure_upload_directory($absoluteDir);
    ensure_upload_htaccess(dirname(__DIR__) . '/uploads');

    $safeExtension = preg_replace('/[^a-z0-9]/', '', strtolower($extension)) ?: 'bin';
    $filename = $purpose . '-' . bin2hex(random_bytes(16)) . '.' . $safeExtension;

    return [
        'path' => "{$absoluteDir}/{$filename}",
        'url' => "/{$relativeDir}/{$filename}",
    ];
}

function ensure_upload_directory(string $path): void
{
    if (is_dir($path)) {
        @chmod($path, UPLOAD_DIRECTORY_MODE);
        return;
    }

    if (!mkdir($path, UPLOAD_DIRECTORY_MODE, true) && !is_dir($path)) {
        json_error('Upload storage is not writable.', 500);
    }

    @chmod($path, UPLOAD_DIRECTORY_MODE);
}

function ensure_upload_htaccess(string $path): void
{
    $file = $path . '/.htaccess';
    $contents = "Options -Indexes\nAddType image/jpeg .jpg .jpeg\nAddType image/png .png\nAddType image/webp .webp\nAddType image/gif .gif\nAddType video/mp4 .mp4\nAddType video/webm .webm\nAddType audio/mpeg .mp3\n<IfModule mod_headers.c>\n  <FilesMatch \"\\.(?:jpe?g|png|webp|gif|mp4|webm|mp3)$\">\n    Header set Cache-Control \"public, max-age=604800\"\n  </FilesMatch>\n</IfModule>\n<FilesMatch \"\\.(?:php|phtml|phar|cgi|pl|py|sh|shtml|html?|svg)$\">\n  Require all denied\n</FilesMatch>\n";

    if (is_file($file)) {
        $current = @file_get_contents($file);

        if (is_string($current) && str_contains($current, 'Header set Cache-Control "public, max-age=604800"')) {
            return;
        }

        @file_put_contents($file, $contents, LOCK_EX);
        return;
    }

    @file_put_contents($file, $contents, LOCK_EX);
}
