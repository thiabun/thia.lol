<?php

declare(strict_types=1);

$configPath = sys_get_temp_dir() . '/thia-uploads-test-config.php';

file_put_contents(
    $configPath,
    "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development', 'base_url' => 'https://thia.lol'], 'security' => [], 'media' => ['ffmpeg_path' => '', 'ffprobe_path' => '', 'video_transcode_timeout_seconds' => 3]];"
);
putenv('THIA_CONFIG_PATH=' . $configPath);
putenv('PATH=/nonexistent');

require_once dirname(__DIR__, 2) . '/api/uploads.php';

$uploadsSource = file_get_contents(dirname(__DIR__, 2) . '/api/uploads.php');
$configExample = file_get_contents(dirname(__DIR__, 2) . '/backend/config/config.example.php');
$publicHtaccess = file_get_contents(dirname(__DIR__, 2) . '/public/.htaccess');

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$imageMimes = uploaded_image_allowed_mimes();
assert_true(in_array('image/jpeg', $imageMimes, true), 'JPEG should be accepted when GD supports it');
assert_true(in_array('image/png', $imageMimes, true), 'PNG should be accepted when GD supports it');
assert_true(in_array('image/webp', $imageMimes, true), 'WebP should be accepted when GD supports it');
assert_true(in_array('image/gif', $imageMimes, true), 'GIF should be accepted when GD supports it');
assert_true(in_array('image/bmp', $imageMimes, true), 'BMP should be accepted when GD supports it');

if (function_exists('imagecreatefromavif')) {
    assert_true(in_array('image/avif', $imageMimes, true), 'AVIF should be accepted when GD supports it');
}

foreach (['image/svg+xml', 'application/pdf', 'text/html'] as $unsafeMime) {
    assert_true(!in_array($unsafeMime, $imageMimes, true), "{$unsafeMime} must not be accepted as an upload image");
}

foreach (uploaded_image_imagick_mimes() as $imagickMime) {
    assert_true(
        in_array($imagickMime, $imageMimes, true) === in_array($imagickMime, imagick_uploaded_image_mimes(), true),
        "{$imagickMime} should only be accepted when Imagick reports delegate support"
    );
}

foreach ([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v',
    'video/x-matroska',
    'video/x-msvideo',
    'video/ogg',
    'video/3gpp',
    'video/3gpp2',
] as $videoMime) {
    assert_true(uploaded_video_input_mime_allowed($videoMime), "{$videoMime} should be an accepted video input");
}

foreach (['clip.mov', 'clip.m4v', 'clip.mkv', 'clip.avi', 'clip.ogv', 'clip.3gp', 'clip.3g2'] as $filename) {
    assert_true(uploaded_video_filename_extension_allowed($filename), "{$filename} should be an accepted video filename");
}

assert_true(!uploaded_video_input_mime_allowed('text/plain'), 'plain text must not be an accepted video input MIME');
assert_true(uploaded_video_filename_extension_allowed('fake.mov'), 'extension gate should allow ffprobe to reject fake videos');
assert_true(media_binary_path('ffmpeg_path', 'ffmpeg') === null, 'missing ffmpeg should be detectable');
assert_true(media_binary_path('ffprobe_path', 'ffprobe') === null, 'missing ffprobe should be detectable');
assert_true(media_video_transcode_timeout_seconds() === 10, 'transcode timeout should clamp to the minimum');

assert_true(is_string($uploadsSource), 'uploads source should be readable');
assert_true(str_contains($uploadsSource, "VIDEO_UPLOAD_OUTPUT_MIME = 'video/mp4'"), 'new video uploads should normalize to MP4');
assert_true(str_contains($uploadsSource, 'assert_uploaded_video_stream'), 'video uploads should require ffprobe validation');
assert_true(str_contains($uploadsSource, 'transcode_uploaded_video_to_mp4'), 'video uploads should transcode through FFmpeg');
assert_true(str_contains($uploadsSource, 'Configure media.ffmpeg_path and media.ffprobe_path'), 'missing converters should return a clear 503 setup error');
assert_true(str_contains($uploadsSource, 'This image format needs an Imagick converter'), 'optional image formats should fail clearly without Imagick support');
assert_true(str_contains($uploadsSource, 'Header set Cache-Control "public, max-age=604800"'), 'upload htaccess should set cache rules');
assert_true(str_contains($uploadsSource, 'svg'), 'upload htaccess should continue denying SVG files');

assert_true(is_string($configExample) && str_contains($configExample, "'ffmpeg_path'"), 'config example should include ffmpeg path');
assert_true(is_string($configExample) && str_contains($configExample, "'ffprobe_path'"), 'config example should include ffprobe path');
assert_true(is_string($configExample) && str_contains($configExample, "'video_transcode_timeout_seconds'"), 'config example should include transcode timeout');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType video/mp4 .mp4 .m4v'), 'public htaccess should serve MP4/M4V');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType video/webm .webm'), 'public htaccess should keep old WebM support');

echo "uploads regression ok\n";
