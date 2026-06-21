<?php

declare(strict_types=1);

$configPath = sys_get_temp_dir() . '/thia-uploads-test-config.php';

file_put_contents(
    $configPath,
    "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development', 'base_url' => 'https://thia.lol'], 'security' => []];"
);
putenv('THIA_CONFIG_PATH=' . $configPath);
putenv('PATH=/nonexistent');

require_once dirname(__DIR__, 2) . '/api/uploads.php';

$root = dirname(__DIR__, 2);
$uploadsSource = file_get_contents($root . '/api/uploads.php');
$postsSource = file_get_contents($root . '/api/posts.php');
$profileSource = file_get_contents($root . '/api/profile.php');
$profileModulesSource = file_get_contents($root . '/api/profile_modules.php');
$roomsSource = file_get_contents($root . '/api/rooms.php');
$configExample = file_get_contents($root . '/backend/config/config.example.php');
$publicHtaccess = file_get_contents($root . '/public/.htaccess');

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

$imageMimes = uploaded_image_allowed_mimes();
foreach (['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as $imageMime) {
    assert_true(in_array($imageMime, $imageMimes, true), "{$imageMime} should be accepted as a safe original image");
}

foreach (['image/bmp', 'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/jxl', 'image/svg+xml', 'application/pdf', 'text/html'] as $unsafeMime) {
    assert_true(!in_array($unsafeMime, $imageMimes, true), "{$unsafeMime} must not be accepted while conversion is disabled");
}

assert_true(uploaded_image_extension('image/jpeg') === 'jpg', 'JPEG uploads should store as jpg');
assert_true(uploaded_image_extension('image/png') === 'png', 'PNG uploads should store as png');
assert_true(uploaded_image_extension('image/webp') === 'webp', 'WebP uploads should store as webp');
assert_true(uploaded_image_extension('image/gif') === 'gif', 'GIF uploads should store as gif');

foreach (['video/mp4', 'video/webm'] as $videoMime) {
    assert_true(uploaded_video_input_mime_allowed($videoMime), "{$videoMime} should be an accepted pass-through video input");
}

foreach (['video/quicktime', 'video/x-m4v', 'video/x-matroska', 'video/x-msvideo', 'video/ogg', 'video/3gpp', 'video/3gpp2', 'video/mpeg', 'text/plain'] as $videoMime) {
    assert_true(!uploaded_video_input_mime_allowed($videoMime), "{$videoMime} should not be accepted while conversion is disabled");
}

assert_true(uploaded_video_filename_extension_allowed('clip.mp4'), 'MP4 filenames should be accepted');
assert_true(uploaded_video_filename_extension_allowed('clip.webm'), 'WebM filenames should be accepted');
foreach (['clip.mov', 'clip.m4v', 'clip.mkv', 'clip.avi', 'clip.ogv', 'clip.3gp', 'clip.3g2'] as $filename) {
    assert_true(!uploaded_video_filename_extension_allowed($filename), "{$filename} should not be accepted while conversion is disabled");
}

assert_true(is_string($uploadsSource), 'uploads source should be readable');
assert_true(!str_contains($uploadsSource, 'ffmpeg_path'), 'upload path should not require FFmpeg while conversion is disabled');
assert_true(!str_contains($uploadsSource, 'ffprobe_path'), 'upload path should not require ffprobe while conversion is disabled');
assert_true(!str_contains($uploadsSource, 'transcode_uploaded_video_to_mp4'), 'video uploads should not transcode on cPanel');
assert_true(!str_contains($uploadsSource, 'assert_uploaded_video_stream'), 'video uploads should not require ffprobe validation on cPanel');
assert_true(!str_contains($uploadsSource, 'imagewebp('), 'image uploads should not re-encode to WebP while conversion is disabled');
assert_true(str_contains($uploadsSource, 'move_uploaded_file'), 'image and video uploads should store accepted originals');
assert_true(str_contains($uploadsSource, 'AddType image/jpeg .jpg .jpeg'), 'upload htaccess should serve JPEG originals');
assert_true(str_contains($uploadsSource, 'AddType image/png .png'), 'upload htaccess should serve PNG originals');
assert_true(str_contains($uploadsSource, 'AddType image/gif .gif'), 'upload htaccess should serve GIF originals');
assert_true(str_contains($uploadsSource, 'Header set Cache-Control "public, max-age=604800"'), 'upload htaccess should set cache rules');
assert_true(str_contains($uploadsSource, 'svg'), 'upload htaccess should continue denying SVG files');

foreach ([$postsSource, $profileSource, $profileModulesSource, $roomsSource] as $source) {
    assert_true(is_string($source) && str_contains($source, 'jpe?g|png|webp|gif'), 'uploaded image URL validators should accept safe original extensions');
}

assert_true(is_string($postsSource) && str_contains($postsSource, 'posts_share_card_load_image'), 'share cards should load safe original image formats');
assert_true(is_string($postsSource) && str_contains($postsSource, "'image/jpeg'"), 'share cards should render JPEG thumbnails');
assert_true(is_string($postsSource) && str_contains($postsSource, "'image/png'"), 'share cards should render PNG thumbnails');
assert_true(is_string($postsSource) && str_contains($postsSource, "'image/gif'"), 'share cards should render GIF thumbnails');
assert_true(is_string($configExample) && !str_contains($configExample, "'ffmpeg_path'"), 'config example should not advertise disabled FFmpeg setup');
assert_true(is_string($configExample) && !str_contains($configExample, "'ffprobe_path'"), 'config example should not advertise disabled ffprobe setup');
assert_true(is_string($configExample) && !str_contains($configExample, "'video_transcode_timeout_seconds'"), 'config example should not advertise disabled transcode timeout');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType image/jpeg .jpg .jpeg'), 'public htaccess should serve JPEG originals');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType image/png .png'), 'public htaccess should serve PNG originals');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType image/gif .gif'), 'public htaccess should serve GIF originals');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType video/mp4 .mp4'), 'public htaccess should serve MP4 uploads');
assert_true(is_string($publicHtaccess) && str_contains($publicHtaccess, 'AddType video/webm .webm'), 'public htaccess should serve WebM uploads');

echo "uploads regression ok\n";
