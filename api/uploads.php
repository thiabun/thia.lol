<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const IMAGE_UPLOAD_MAX_BYTES = 10485760;
const IMAGE_UPLOAD_WEBP_QUALITY = 82;
const VIDEO_UPLOAD_MAX_BYTES = 31457280;
const VIDEO_UPLOAD_OUTPUT_MIME = 'video/mp4';
const VIDEO_UPLOAD_OUTPUT_EXTENSION = 'mp4';
const AUDIO_UPLOAD_MAX_BYTES = 20971520;

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
    detect_uploaded_video_mime($file['tmp_name'], $file['name']);

    $ffmpeg = media_binary_path('ffmpeg_path', 'ffmpeg');
    $ffprobe = media_binary_path('ffprobe_path', 'ffprobe');

    if ($ffmpeg === null || $ffprobe === null) {
        json_error('Video conversion is not configured. Configure media.ffmpeg_path and media.ffprobe_path.', 503);
    }

    if (!function_exists('proc_open')) {
        json_error('Video conversion is not configured because process execution is unavailable.', 503);
    }

    $timeoutSeconds = media_video_transcode_timeout_seconds();
    assert_uploaded_video_stream($ffprobe, $file['tmp_name'], $timeoutSeconds);

    $storage = create_upload_destination($purpose, VIDEO_UPLOAD_OUTPUT_EXTENSION);
    transcode_uploaded_video_to_mp4($ffmpeg, $file['tmp_name'], $storage['path'], $timeoutSeconds);

    @chmod($storage['path'], 0644);

    $size = filesize($storage['path']);

    if ($size === false || $size <= 0) {
        json_error('Video could not be verified after upload.', 500);
    }

    json_success([
        'url' => $storage['url'],
        'mime' => VIDEO_UPLOAD_OUTPUT_MIME,
        'type' => VIDEO_UPLOAD_OUTPUT_MIME,
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
        if (in_array($mime, uploaded_image_imagick_mimes(), true)) {
            json_error('This image format needs an Imagick converter that is not configured for uploads.', 503);
        }

        json_error('Unsupported image type. Use JPEG, PNG, WebP, GIF, BMP, AVIF, or a configured HEIC, HEIF, TIFF, or JPEG XL converter.', 415);
    }

    if (in_array($mime, gd_uploaded_image_mimes(), true)) {
        $size = getimagesize($path);

        if ($size === false || !in_array(normalize_uploaded_image_mime($size['mime'] ?? null), $allowed, true)) {
            json_error('Image could not be decoded.', 415);
        }
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

    if (!uploaded_video_input_mime_allowed($mime) && !uploaded_video_filename_extension_allowed($filename)) {
        json_error('Unsupported video type. Use MP4, MOV/QuickTime, WebM, M4V, MKV, AVI, OGG, or 3GP.', 415);
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

function decode_uploaded_image(string $path, string $mime): GdImage
{
    $image = match ($mime) {
        'image/jpeg' => imagecreatefromjpeg($path),
        'image/png' => imagecreatefrompng($path),
        'image/webp' => imagecreatefromwebp($path),
        'image/gif' => imagecreatefromgif($path),
        'image/bmp' => imagecreatefrombmp($path),
        'image/avif' => imagecreatefromavif($path),
        'image/heic', 'image/heif', 'image/tiff', 'image/jxl' => decode_uploaded_image_with_imagick($path),
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
        'image/bmp', 'image/x-bmp', 'image/x-ms-bmp' => 'image/bmp',
        'image/avif' => 'image/avif',
        'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence' => str_contains(strtolower(trim($mime)), 'heic') ? 'image/heic' : 'image/heif',
        'image/tiff', 'image/tif', 'image/x-tiff' => 'image/tiff',
        'image/jxl' => 'image/jxl',
        default => strtolower(trim($mime)),
    };
}

function gd_uploaded_image_mimes(): array
{
    $mimes = [];

    if (function_exists('imagecreatefromjpeg')) {
        $mimes[] = 'image/jpeg';
    }

    if (function_exists('imagecreatefrompng')) {
        $mimes[] = 'image/png';
    }

    if (function_exists('imagecreatefromwebp')) {
        $mimes[] = 'image/webp';
    }

    if (function_exists('imagecreatefromgif')) {
        $mimes[] = 'image/gif';
    }

    if (function_exists('imagecreatefrombmp')) {
        $mimes[] = 'image/bmp';
    }

    if (function_exists('imagecreatefromavif')) {
        $mimes[] = 'image/avif';
    }

    return $mimes;
}

function uploaded_image_imagick_mimes(): array
{
    return ['image/heic', 'image/heif', 'image/tiff', 'image/jxl'];
}

function imagick_uploaded_image_mimes(): array
{
    if (!class_exists('Imagick')) {
        return [];
    }

    try {
        $formats = array_fill_keys(array_map('strtoupper', Imagick::queryFormats()), true);
    } catch (Throwable) {
        return [];
    }

    $mimes = [];

    if (isset($formats['HEIC'])) {
        $mimes[] = 'image/heic';
    }

    if (isset($formats['HEIF'])) {
        $mimes[] = 'image/heif';
    }

    if (isset($formats['TIFF']) || isset($formats['TIF'])) {
        $mimes[] = 'image/tiff';
    }

    if (isset($formats['JXL'])) {
        $mimes[] = 'image/jxl';
    }

    return $mimes;
}

function uploaded_image_allowed_mimes(): array
{
    return array_values(array_unique(array_merge(
        gd_uploaded_image_mimes(),
        imagick_uploaded_image_mimes()
    )));
}

function decode_uploaded_image_with_imagick(string $path): GdImage|false
{
    if (!class_exists('Imagick')) {
        return false;
    }

    try {
        $imagick = new Imagick();
        $imagick->readImage($path);

        if (method_exists($imagick, 'setIteratorIndex')) {
            $imagick->setIteratorIndex(0);
        }

        if (method_exists($imagick, 'autoOrient')) {
            $imagick->autoOrient();
        }

        $imagick->setImageFormat('png');
        $blob = $imagick->getImageBlob();
        $imagick->clear();
        $imagick->destroy();
    } catch (Throwable) {
        return false;
    }

    return imagecreatefromstring($blob);
}

function normalize_uploaded_video_mime(mixed $mime): ?string
{
    if (!is_string($mime)) {
        return null;
    }

    return match (strtolower(trim($mime))) {
        'video/mp4', 'application/mp4', 'video/x-mp4' => 'video/mp4',
        'video/x-m4v' => 'video/x-m4v',
        'video/quicktime' => 'video/quicktime',
        'video/webm' => 'video/webm',
        'video/x-matroska', 'application/x-matroska' => 'video/x-matroska',
        'video/x-msvideo', 'video/avi', 'video/msvideo' => 'video/x-msvideo',
        'video/ogg', 'application/ogg' => 'video/ogg',
        'video/3gpp' => 'video/3gpp',
        'video/3gpp2' => 'video/3gpp2',
        'video/mpeg', 'video/mpg' => 'video/mpeg',
        default => strtolower(trim($mime)),
    };
}

function uploaded_video_input_mimes(): array
{
    return [
        'video/mp4',
        'video/x-m4v',
        'video/quicktime',
        'video/webm',
        'video/x-matroska',
        'video/x-msvideo',
        'video/ogg',
        'video/3gpp',
        'video/3gpp2',
        'video/mpeg',
    ];
}

function uploaded_video_input_mime_allowed(string $mime): bool
{
    return in_array(normalize_uploaded_video_mime($mime), uploaded_video_input_mimes(), true);
}

function uploaded_video_filename_extension_allowed(string $filename): bool
{
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

    return in_array($extension, ['mp4', 'm4v', 'mov', 'qt', 'webm', 'mkv', 'avi', 'ogg', 'ogv', '3gp', '3g2'], true);
}

function media_video_transcode_timeout_seconds(): int
{
    $media = api_config()['media'] ?? [];
    $value = is_array($media) ? ($media['video_transcode_timeout_seconds'] ?? 60) : 60;

    return max(10, min(300, (int) $value));
}

function media_binary_path(string $configKey, string $fallbackBinary): ?string
{
    $media = api_config()['media'] ?? [];
    $configured = is_array($media) && is_string($media[$configKey] ?? null)
        ? trim((string) $media[$configKey])
        : '';

    if ($configured !== '') {
        if (str_contains($configured, '/') || str_contains($configured, '\\')) {
            return is_executable($configured) ? $configured : null;
        }

        return media_find_binary_in_path($configured);
    }

    return media_find_binary_in_path($fallbackBinary);
}

function media_find_binary_in_path(string $binary): ?string
{
    $path = getenv('PATH');

    if (!is_string($path) || trim($path) === '') {
        $path = '/usr/local/bin:/usr/bin:/bin';
    }

    foreach (explode(PATH_SEPARATOR, $path) as $directory) {
        $candidate = rtrim($directory, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $binary;

        if (is_executable($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function assert_uploaded_video_stream(string $ffprobe, string $path, int $timeoutSeconds): void
{
    $result = run_media_command([
        $ffprobe,
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_type,width,height',
        '-of',
        'json',
        $path,
    ], $timeoutSeconds);

    if ($result['timedOut']) {
        json_error('Video validation timed out.', 415);
    }

    if ($result['exitCode'] === 127) {
        json_error('Video conversion is not configured. Configure media.ffmpeg_path and media.ffprobe_path.', 503);
    }

    if ($result['exitCode'] !== 0) {
        json_error('Uploaded file is not a readable video.', 415);
    }

    try {
        $payload = json_decode($result['stdout'], true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_error('Uploaded file is not a readable video.', 415);
    }

    $streams = is_array($payload['streams'] ?? null) ? $payload['streams'] : [];

    foreach ($streams as $stream) {
        if (is_array($stream) && ($stream['codec_type'] ?? null) === 'video') {
            return;
        }
    }

    json_error('Uploaded file does not contain a video stream.', 415);
}

function transcode_uploaded_video_to_mp4(string $ffmpeg, string $sourcePath, string $destinationPath, int $timeoutSeconds): void
{
    $result = run_media_command([
        $ffmpeg,
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        $sourcePath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-vf',
        "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-map_metadata',
        '-1',
        $destinationPath,
    ], $timeoutSeconds);

    if ($result['timedOut']) {
        @unlink($destinationPath);
        json_error('Video conversion timed out.', 500);
    }

    if ($result['exitCode'] === 127) {
        @unlink($destinationPath);
        json_error('Video conversion is not configured. Configure media.ffmpeg_path and media.ffprobe_path.', 503);
    }

    if ($result['exitCode'] !== 0) {
        @unlink($destinationPath);
        json_error('Video could not be converted to MP4.', 500);
    }

    $size = filesize($destinationPath);

    if ($size === false || $size <= 0) {
        @unlink($destinationPath);
        json_error('Video could not be converted to MP4.', 500);
    }

    if ($size > VIDEO_UPLOAD_MAX_BYTES) {
        @unlink($destinationPath);
        json_error('Video must be 30 MB or smaller after conversion.', 413);
    }
}

function run_media_command(array $command, int $timeoutSeconds): array
{
    if (!function_exists('proc_open')) {
        return [
            'exitCode' => 127,
            'stdout' => '',
            'stderr' => 'Process execution is unavailable.',
            'timedOut' => false,
        ];
    }

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    try {
        $process = proc_open($command, $descriptors, $pipes);
    } catch (Throwable $exception) {
        return [
            'exitCode' => 127,
            'stdout' => '',
            'stderr' => $exception->getMessage(),
            'timedOut' => false,
        ];
    }

    if (!is_resource($process)) {
        return [
            'exitCode' => 127,
            'stdout' => '',
            'stderr' => 'Process could not be started.',
            'timedOut' => false,
        ];
    }

    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $stdout = '';
    $stderr = '';
    $startedAt = microtime(true);
    $timedOut = false;

    while (true) {
        $stdout .= stream_get_contents($pipes[1]) ?: '';
        $stderr .= stream_get_contents($pipes[2]) ?: '';
        $status = proc_get_status($process);

        if (!$status['running']) {
            break;
        }

        if (microtime(true) - $startedAt > $timeoutSeconds) {
            $timedOut = true;
            proc_terminate($process, 9);
            break;
        }

        usleep(100000);
    }

    $stdout .= stream_get_contents($pipes[1]) ?: '';
    $stderr .= stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[1]);
    fclose($pipes[2]);

    $exitCode = proc_close($process);

    return [
        'exitCode' => $timedOut ? 124 : $exitCode,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'timedOut' => $timedOut,
    ];
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
    $contents = "Options -Indexes\nAddType image/webp .webp\nAddType video/mp4 .mp4\nAddType video/webm .webm\nAddType audio/mpeg .mp3\n<IfModule mod_headers.c>\n  <FilesMatch \"\\.(?:webp|mp4|webm|mp3)$\">\n    Header set Cache-Control \"public, max-age=604800\"\n  </FilesMatch>\n</IfModule>\n<FilesMatch \"\\.(?:php|phtml|phar|cgi|pl|py|sh|shtml|html?|svg)$\">\n  Require all denied\n</FilesMatch>\n";

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
