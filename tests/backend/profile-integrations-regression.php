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

$integrationSource = file_get_contents(dirname(__DIR__, 2) . '/api/integrations.php');

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

$youtubePlaylist = profile_integration_normalize_url('https://www.youtube.com/playlist?list=PLabc123', null);
assert_true($youtubePlaylist['provider'] === 'youtube', 'youtube playlist provider mismatch');
assert_true($youtubePlaylist['resourceType'] === 'playlist', 'youtube playlist type mismatch');
assert_true(str_contains(profile_integration_embed_payload($youtubePlaylist)['src'], 'videoseries'), 'youtube playlist embed mismatch');

$twitch = profile_integration_normalize_url('https://www.twitch.tv/thiabun', null);
assert_true($twitch['provider'] === 'twitch', 'twitch provider mismatch');
assert_true($twitch['resourceType'] === 'channel', 'twitch type mismatch');

$github = profile_integration_generated_card('https://github.com/thiabun/thia.lol', null);
assert_true($github['provider'] === 'github', 'github provider mismatch');
assert_true($github['embed'] === null, 'github should not generate iframe embeds');

$spotifyCard = profile_integration_generated_card('https://open.spotify.com/playlist/playlist123', null);
assert_true($spotifyCard['embed']['src'] === 'https://open.spotify.com/embed/playlist/playlist123?theme=0', 'spotify embed src mismatch');
$spotifyTrackCard = profile_integration_generated_card('https://open.spotify.com/track/track123', null);
assert_true($spotifyTrackCard['embed']['height'] === 80, 'spotify track embed height mismatch');
assert_true(profile_integration_provider_oauth_enabled('apple_music', ['developer_token' => 'developer-token']) === false, 'Apple Music should not expose OAuth start in this pass');

$twitchCard = profile_integration_generated_card('https://twitch.tv/thiabun', null);
assert_true(str_contains($twitchCard['embed']['src'], 'parent=thia.lol'), 'twitch embed must include parent');
assert_true(is_string($integrationSource), 'integration source should be readable');
assert_true(str_contains($integrationSource, 'function profile_integrations_provider_suggestions'), 'provider suggestions endpoint should exist');
assert_true(str_contains($integrationSource, 'function profile_integration_redirect_to_app'), 'OAuth callback should redirect back to app');
assert_true(str_contains($integrationSource, 'Apple Music'), 'Apple Music support should remain explicit');

$spotifyStatus = profile_integration_provider_public_status('spotify');
assert_true($spotifyStatus['linkSupported'] === true, 'spotify links should be supported without OAuth');
assert_true($spotifyStatus['configured'] === false, 'spotify should not report configured without client credentials');
assert_true($spotifyStatus['oauthEnabled'] === false, 'spotify oauth should be disabled without client credentials');
assert_true($spotifyStatus['metadataEnabled'] === false, 'spotify metadata should be disabled without client credentials');
assert_true(in_array('client_id', $spotifyStatus['missingConfigKeys'], true), 'spotify status should report missing client id by name only');
assert_true(in_array('client_secret', $spotifyStatus['missingConfigKeys'], true), 'spotify status should report missing client secret by name only');

$twitchStatus = profile_integration_provider_public_status('twitch');
assert_true($twitchStatus['linkSupported'] === true, 'twitch links should be supported without OAuth');
assert_true($twitchStatus['metadataEnabled'] === false, 'twitch metadata should be disabled without client credentials');
assert_true(!in_array('embed_parent', $twitchStatus['missingConfigKeys'], true), 'twitch embed parent should be recognized when configured');

$cipher = profile_integration_encrypt('secret-token');
assert_true($cipher !== 'secret-token', 'token should be encrypted');
assert_true(profile_integration_decrypt($cipher) === 'secret-token', 'token decrypt mismatch');

$opensslCipher = profile_integration_encrypt_openssl('fallback-token', str_repeat('o', 32));
assert_true(profile_integration_decrypt_openssl($opensslCipher, str_repeat('o', 32)) === 'fallback-token', 'openssl token decrypt mismatch');
assert_true(str_contains($integrationSource, "database_column_exists('profile_integration_oauth_states', 'code_verifier_cipher')"), 'integration storage guard should verify oauth state columns');
assert_true(str_contains($integrationSource, 'profile_integration_crypto_method'), 'integration crypto fallback should exist');

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
