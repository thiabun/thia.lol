<?php

declare(strict_types=1);

$configPath = sys_get_temp_dir() . '/thia-profile-integrations-test-config.php';
$emptyConfigPath = sys_get_temp_dir() . '/thia-profile-integrations-empty-config.php';
$key = base64_encode(str_repeat('k', SODIUM_CRYPTO_SECRETBOX_KEYBYTES));

file_put_contents(
    $configPath,
    "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development', 'base_url' => 'https://thia.lol'], 'security' => ['integration_encryption_key' => '{$key}'], 'integrations' => ['twitch' => ['embed_parent' => 'thia.lol']]];"
);
file_put_contents(
    $emptyConfigPath,
    "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development'], 'security' => ['integration_encryption_key' => '']];"
);
putenv('THIA_CONFIG_PATH=' . $configPath);

require_once dirname(__DIR__, 2) . '/api/integrations.php';
require_once dirname(__DIR__, 2) . '/api/profile.php';

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_php_rejected_with_config(string $configPath, string $code, string $expectedError): void
{
    $integrationPath = dirname(__DIR__, 2) . '/api/integrations.php';
    $fullCode = 'putenv("THIA_CONFIG_PATH=' . addslashes($configPath) . '"); require ' . var_export($integrationPath, true) . '; ' . $code;
    $output = shell_exec('php -r ' . escapeshellarg($fullCode));

    assert_true(is_string($output), 'rejection subprocess did not return output');
    assert_true(str_contains($output, $expectedError), "expected rejection containing {$expectedError}");
}

$spotify = profile_integration_normalize_url('https://open.spotify.com/track/abc123?si=ignored', null);
assert_true($spotify['provider'] === 'spotify', 'spotify provider mismatch');
assert_true($spotify['resourceType'] === 'track', 'spotify type mismatch');
assert_true($spotify['resourceId'] === 'abc123', 'spotify id mismatch');

$youtube = profile_integration_normalize_url('https://youtu.be/video123', null);
assert_true($youtube['provider'] === 'youtube', 'youtube provider mismatch');
assert_true($youtube['resourceType'] === 'video', 'youtube type mismatch');

$twitch = profile_integration_normalize_url('https://www.twitch.tv/thiabun', null);
assert_true($twitch['provider'] === 'twitch', 'twitch provider mismatch');
assert_true($twitch['resourceType'] === 'channel', 'twitch type mismatch');

$github = profile_integration_generated_card('https://github.com/thiabun/thia.lol', null);
assert_true($github['provider'] === 'github', 'github provider mismatch');
assert_true($github['embed'] === null, 'github should not generate iframe embeds');

$spotifyCard = profile_integration_generated_card('https://open.spotify.com/playlist/playlist123', null);
assert_true($spotifyCard['embed']['src'] === 'https://open.spotify.com/embed/playlist/playlist123', 'spotify embed src mismatch');

$twitchCard = profile_integration_generated_card('https://twitch.tv/thiabun', null);
assert_true(str_contains($twitchCard['embed']['src'], 'parent=thia.lol'), 'twitch embed must include parent');

$cipher = profile_integration_encrypt('secret-token');
assert_true($cipher !== 'secret-token', 'token should be encrypted');
assert_true(profile_integration_decrypt($cipher) === 'secret-token', 'token decrypt mismatch');

assert_true(validate_profile_video_url('/uploads/media/2026/06/profile_background-abc123.mp4', 'Profile video') === '/uploads/media/2026/06/profile_background-abc123.mp4', 'video URL should validate');

assert_php_rejected_with_config(
    $emptyConfigPath,
    'profile_integration_encrypt("secret-token");',
    'Integration encryption is not configured.'
);
assert_php_rejected_with_config(
    $configPath,
    'profile_integration_url("http://example.com/not-secure");',
    'Integration URL must use HTTPS.'
);

echo "profile integrations regression ok\n";
