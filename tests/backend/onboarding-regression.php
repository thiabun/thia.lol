<?php

declare(strict_types=1);

$configPath = sys_get_temp_dir() . '/thia-onboarding-test-config.php';
$key = base64_encode(str_repeat('o', SODIUM_CRYPTO_SECRETBOX_KEYBYTES));

file_put_contents(
    $configPath,
    "<?php return ['database' => ['host' => 'localhost', 'name' => 'test', 'user' => 'test'], 'app' => ['environment' => 'development', 'base_url' => 'https://thia.lol'], 'security' => ['integration_encryption_key' => '{$key}'], 'integrations' => ['twitch' => ['embed_parent' => 'thia.lol']]];"
);
putenv('THIA_CONFIG_PATH=' . $configPath);

require_once dirname(__DIR__, 2) . '/api/onboarding.php';

$onboardingSource = file_get_contents(dirname(__DIR__, 2) . '/api/onboarding.php');
$schema = file_get_contents(dirname(__DIR__, 2) . '/backend/database/schema.sql');
$migration = file_get_contents(dirname(__DIR__, 2) . '/backend/database/migrations/20260619_0002_add_user_onboarding_state.sql');

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function assert_php_rejected(string $code, string $expectedError): void
{
    $apiPath = dirname(__DIR__, 2) . '/api/onboarding.php';
    $output = shell_exec('php -r ' . escapeshellarg('require ' . var_export($apiPath, true) . '; ' . $code));

    assert_true(is_string($output), 'rejection subprocess did not return output');
    assert_true(str_contains($output, $expectedError), "expected rejection containing {$expectedError}");
}

$steps = onboarding_step_list_normalized(['youtube', 'profile_basics', 'youtube', 'invalid', 'github']);
assert_true($steps === ['profile_basics', 'youtube', 'github'], 'onboarding steps should dedupe and keep product order');

$link = onboarding_provider_link('apple_music', 'https://music.apple.com/us/album/example/1?i=2');
assert_true($link['provider'] === 'apple_music', 'Apple Music onboarding link provider mismatch');
assert_true($link['resourceId'] === '2', 'Apple Music onboarding link resource id mismatch');
assert_true($link['resourceType'] === 'album', 'Apple Music onboarding link resource type mismatch');
assert_true(str_starts_with($link['url'], 'https://music.apple.com/'), 'Apple Music onboarding link should stay HTTPS');

$links = onboarding_provider_links(json_encode(['apple_music' => $link], JSON_THROW_ON_ERROR));
assert_true(isset($links['apple_music']), 'stored onboarding provider link should decode');
assert_true($links['apple_music']['resourceId'] === '2', 'stored onboarding provider link resource mismatch');

assert_true(is_string($onboardingSource), 'onboarding API source should be readable');
assert_true(str_contains($onboardingSource, 'require_csrf_token($session);'), 'onboarding mutations should require CSRF');
assert_true(str_contains($onboardingSource, 'Onboarding storage is not ready. Run pending migrations.'), 'onboarding storage guard should exist');
assert_true(str_contains($onboardingSource, "'save_provider_link'"), 'onboarding provider-link action should exist');
assert_true(is_string($schema) && str_contains($schema, 'CREATE TABLE IF NOT EXISTS user_onboarding_state'), 'baseline schema should include onboarding state');
assert_true(is_string($migration) && str_contains($migration, 'provider_links_json JSON NULL'), 'onboarding migration should include provider links');

assert_php_rejected(
    'onboarding_step("not-a-step");',
    'Choose an onboarding step.'
);
assert_php_rejected(
    'onboarding_provider_link("apple_music", "http://music.apple.com/not-secure");',
    'Integration URL must use HTTPS.'
);

echo "onboarding regression ok\n";
