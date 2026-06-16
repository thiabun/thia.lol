<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const IMAGE_UPLOAD_MAX_BYTES = 10485760;
const IMAGE_UPLOAD_WEBP_QUALITY = 82;
const VIDEO_UPLOAD_MAX_BYTES = 31457280;

function uploads_dispatch(array $segments, string $method): void
{
    if (count($segments) !== 2 || ($segments[0] ?? null) !== 'uploads' || !in_array($segments[1], ['image', 'video'], true)) {
        json_error('Not found.', 404);
    }

    if ($method !== 'POST') {
        json_error('Method not allowed.', 405);
    }

    if ($segments[1] === 'image') {
        uploads_image_create();
    }

    uploads_video_create();
}

function uploads_image_create(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);

    if ($contentLength > IMAGE_UPLOAD_MAX_BYTES) {
        json_error('Image must be 10 MB or smaller.', 413);
    }

    if (!extension_loaded('gd') || !function_exists('imagewebp')) {
        json_error('Image uploads are temporarily unavailable because WebP conversion is not enabled.', 503);
    }

    $purpose = validate_upload_purpose($_POST['purpose'] ?? null);
    $file = uploaded_image_file('file');
    $mime = detect_uploaded_image_mime($file['tmp_name']);
    $settings = upload_purpose_settings($purpose);
    $image = decode_uploaded_image($file['tmp_name'], $mime);
    $image = apply_jpeg_orientation($image, $file['tmp_name'], $mime);
    $processed = resize_uploaded_image($image, $settings);

    $storage = create_upload_destination($purpose);

    if (!imagewebp($processed, $storage['path'], IMAGE_UPLOAD_WEBP_QUALITY)) {
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
        'mime' => 'image/webp',
        'type' => 'image/webp',
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
    $mime = detect_uploaded_video_mime($file['tmp_name']);
    $extension = $mime === 'video/webm' ? 'webm' : 'mp4';
    $storage = create_upload_destination($purpose, $extension);

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

    if ($purpose !== 'profile_background') {
        json_error('Unsupported video purpose.', 422);
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
    ];
}

function detect_uploaded_image_mime(string $path): string
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($path);

    if (!is_string($mime)) {
        json_error('Unsupported image type.', 415);
    }

    $allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!in_array($mime, $allowed, true)) {
        json_error('Unsupported image type. Use JPEG, PNG, or WebP.', 415);
    }

    $size = getimagesize($path);

    if ($size === false || !in_array($size['mime'] ?? '', $allowed, true)) {
        json_error('Image could not be decoded.', 415);
    }

    return $mime;
}

function detect_uploaded_video_mime(string $path): string
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($path);

    if (!is_string($mime)) {
        json_error('Unsupported video type.', 415);
    }

    $allowed = ['video/mp4', 'video/webm'];

    if (!in_array($mime, $allowed, true)) {
        json_error('Unsupported video type. Use MP4 or WebM.', 415);
    }

    return $mime;
}

function decode_uploaded_image(string $path, string $mime): GdImage
{
    $image = match ($mime) {
        'image/jpeg' => imagecreatefromjpeg($path),
        'image/png' => imagecreatefrompng($path),
        'image/webp' => imagecreatefromwebp($path),
        default => false,
    };

    if (!$image instanceof GdImage) {
        json_error('Image could not be decoded.', 415);
    }

    imagepalettetotruecolor($image);
    imagealphablending($image, true);
    imagesavealpha($image, true);

    return $image;
}

function apply_jpeg_orientation(GdImage $image, string $path, string $mime): GdImage
{
    if ($mime !== 'image/jpeg' || !function_exists('exif_read_data')) {
        return $image;
    }

    $exif = @exif_read_data($path);

    if (!is_array($exif)) {
        return $image;
    }

    $orientation = (int) ($exif['Orientation'] ?? 1);
    $rotated = null;

    if ($orientation === 3) {
        $rotated = imagerotate($image, 180, 0);
    } elseif ($orientation === 6) {
        $rotated = imagerotate($image, -90, 0);
    } elseif ($orientation === 8) {
        $rotated = imagerotate($image, 90, 0);
    }

    if (!$rotated instanceof GdImage) {
        return $image;
    }

    imagepalettetotruecolor($rotated);
    imagealphablending($rotated, true);
    imagesavealpha($rotated, true);

    return $rotated;
}

function upload_purpose_settings(string $purpose): array
{
    return match ($purpose) {
        'avatar' => ['max_width' => 512, 'max_height' => 512, 'crop_square' => true],
        'banner' => ['max_width' => 1600, 'max_height' => 600, 'crop_square' => false],
        'profile_background' => ['max_width' => 1920, 'max_height' => 1080, 'crop_square' => false],
        'post_media' => ['max_width' => 1920, 'max_height' => 1920, 'crop_square' => false],
        'room_icon' => ['max_width' => 512, 'max_height' => 512, 'crop_square' => true],
        'room_banner' => ['max_width' => 1600, 'max_height' => 600, 'crop_square' => false],
        default => ['max_width' => 1920, 'max_height' => 1920, 'crop_square' => false],
    };
}

function resize_uploaded_image(GdImage $image, array $settings): GdImage
{
    $sourceWidth = imagesx($image);
    $sourceHeight = imagesy($image);

    if ((bool) $settings['crop_square']) {
        $side = min($sourceWidth, $sourceHeight);
        $sourceX = intdiv($sourceWidth - $side, 2);
        $sourceY = intdiv($sourceHeight - $side, 2);
        $targetWidth = (int) $settings['max_width'];
        $targetHeight = (int) $settings['max_height'];

        return resample_image($image, $sourceX, $sourceY, $side, $side, $targetWidth, $targetHeight);
    }

    $scale = min(
        1,
        (int) $settings['max_width'] / max(1, $sourceWidth),
        (int) $settings['max_height'] / max(1, $sourceHeight)
    );
    $targetWidth = max(1, (int) floor($sourceWidth * $scale));
    $targetHeight = max(1, (int) floor($sourceHeight * $scale));

    return resample_image($image, 0, 0, $sourceWidth, $sourceHeight, $targetWidth, $targetHeight);
}

function resample_image(
    GdImage $image,
    int $sourceX,
    int $sourceY,
    int $sourceWidth,
    int $sourceHeight,
    int $targetWidth,
    int $targetHeight
): GdImage {
    $target = imagecreatetruecolor($targetWidth, $targetHeight);

    if (!$target instanceof GdImage) {
        json_error('Image could not be processed.', 500);
    }

    imagealphablending($target, false);
    imagesavealpha($target, true);
    $transparent = imagecolorallocatealpha($target, 0, 0, 0, 127);
    imagefilledrectangle($target, 0, 0, $targetWidth, $targetHeight, $transparent);
    imagecopyresampled(
        $target,
        $image,
        0,
        0,
        $sourceX,
        $sourceY,
        $targetWidth,
        $targetHeight,
        $sourceWidth,
        $sourceHeight
    );

    return $target;
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
        return;
    }

    if (!mkdir($path, 0755, true) && !is_dir($path)) {
        json_error('Upload storage is not writable.', 500);
    }
}

function ensure_upload_htaccess(string $path): void
{
    $file = $path . '/.htaccess';

    if (is_file($file)) {
        return;
    }

    $contents = "Options -Indexes\nAddType image/webp .webp\nAddType video/mp4 .mp4\nAddType video/webm .webm\n<FilesMatch \"\\.(?:php|phtml|phar|cgi|pl|py|sh|shtml|html?|svg)$\">\n  Require all denied\n</FilesMatch>\n";
    @file_put_contents($file, $contents, LOCK_EX);
}
