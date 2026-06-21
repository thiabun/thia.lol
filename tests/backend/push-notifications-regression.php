<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);

function push_assert(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

function push_file(string $path): string
{
    global $root;
    $contents = file_get_contents($root . '/' . $path);

    push_assert(is_string($contents), "{$path} should be readable");

    return $contents;
}

$migration = push_file('api/migrations/20260621_0005_add_push_subscriptions.sql');
$schema = push_file('backend/database/schema.sql');
$router = push_file('api/index.php');
$push = push_file('api/push.php');
$notifications = push_file('api/notifications.php');
$settings = push_file('api/settings.php');
$config = push_file('config/example-config.php');
$frontendApi = push_file('src/lib/api.ts');
$desktopCard = push_file('src/components/notifications/DesktopNotificationsCard.tsx');
$desktopHelper = push_file('src/lib/desktopNotifications.ts');
$settingsPage = push_file('src/pages/SettingsPage.tsx');
$serviceWorker = push_file('public/service-worker.js');

foreach ([$migration, $schema] as $sql) {
    push_assert(str_contains($sql, 'CREATE TABLE IF NOT EXISTS push_subscriptions'), 'push subscription table missing');
    push_assert(str_contains($sql, 'endpoint_hash CHAR(64) NOT NULL'), 'endpoint hash column missing');
    push_assert(str_contains($sql, 'UNIQUE KEY push_subscriptions_endpoint_hash_unique'), 'endpoint hash unique key missing');
    push_assert(str_contains($sql, 'p256dh_key TEXT NOT NULL'), 'browser public key column missing');
    push_assert(str_contains($sql, 'auth_secret VARCHAR(255) NOT NULL'), 'browser auth secret column missing');
    push_assert(str_contains($sql, 'disabled_at DATETIME NULL'), 'disabled subscription column missing');
    push_assert(str_contains($sql, 'last_error_at DATETIME NULL'), 'push failure metadata missing');
    push_assert(str_contains($sql, 'FOREIGN KEY (user_id) REFERENCES users(id)'), 'push subscriptions should belong to users');
}

push_assert(str_contains($config, "'push' => ["), 'push config section missing');
push_assert(str_contains($config, "'vapid_public_key'"), 'VAPID public config missing');
push_assert(str_contains($config, "'vapid_private_key'"), 'VAPID private config missing');
push_assert(str_contains($config, "'send_timeout_seconds'"), 'push timeout config missing');

push_assert(str_contains($router, "require_once __DIR__ . '/push.php'"), 'push API should be loaded');
push_assert(str_contains($router, "(\$segments[1] ?? null) === 'push'"), 'me/push route should be dispatched');

push_assert(str_contains($push, 'function push_dispatch'), 'push dispatcher missing');
push_assert(str_contains($push, 'GET') && str_contains($push, 'push_status'), 'push status endpoint missing');
push_assert(str_contains($push, 'push_subscription_save'), 'push subscription save endpoint missing');
push_assert(str_contains($push, 'push_subscription_disable'), 'push subscription disable endpoint missing');
push_assert(str_contains($push, 'push_test_send'), 'push test endpoint missing');
push_assert(str_contains($push, 'require_authenticated_session()'), 'push endpoints must require auth');
push_assert(str_contains($push, 'require_csrf_token($session)'), 'push mutations must require CSRF');
push_assert(str_contains($push, 'push_missing_config_keys'), 'push diagnostics should expose missing config keys only');
push_assert(str_contains($push, 'function push_encrypt_payload'), 'push payload encryption helper missing');
push_assert(str_contains($push, 'aes128gcm'), 'push should use aes128gcm content encoding');
push_assert(str_contains($push, 'openssl_pkey_derive'), 'push should derive ECDH shared secrets with OpenSSL');
push_assert(str_contains($push, 'push_vapid_authorization_header'), 'VAPID authorization helper missing');
push_assert(str_contains($push, 'curl_setopt_array'), 'push sender should use bounded cURL requests');
push_assert(str_contains($push, 'CURLOPT_TIMEOUT'), 'push cURL timeout missing');
push_assert(str_contains($push, 'in_array((int) $response[\'status\'], [404, 410], true)'), 'permanent push failures should disable subscriptions');
push_assert(str_contains($push, 'push_user_allows_type'), 'push should respect push notification preferences');
push_assert(str_contains($push, 'push_notification_type_key'), 'push notification type preference mapping missing');
push_assert(str_contains($push, "'New message'"), 'DM push payload should stay privacy-safe');

push_assert(str_contains($notifications, 'push_send_notification_payload'), 'notification creation should trigger push');
push_assert(str_contains($notifications, 'Desktop push is best-effort'), 'push failures should not break notification creation');

push_assert(str_contains($settings, 'push_notification_preferences_json'), 'settings should persist push preferences');
push_assert(str_contains($frontendApi, 'export type PushNotificationStatus'), 'frontend push status type missing');
push_assert(str_contains($frontendApi, 'getPushNotificationStatus'), 'frontend push status helper missing');
push_assert(str_contains($frontendApi, 'savePushSubscription'), 'frontend push subscription helper missing');
push_assert(str_contains($frontendApi, 'sendPushNotificationTest'), 'frontend push test helper missing');
push_assert(str_contains($desktopCard, 'data-testid="desktop-notifications-card"'), 'desktop notification card hook missing');
push_assert(str_contains($desktopHelper, 'Notification.requestPermission'), 'desktop notification helper should trigger explicit browser permission flow');
push_assert(str_contains($settingsPage, 'pushNotification:'), 'settings should expose push category toggles');

push_assert(str_contains($serviceWorker, 'self.addEventListener("push"'), 'service worker push listener missing');
push_assert(str_contains($serviceWorker, 'showNotification'), 'service worker should show browser notifications');
push_assert(str_contains($serviceWorker, 'notificationclick'), 'service worker notification click handler missing');
push_assert(str_contains($serviceWorker, 'clients.openWindow'), 'notification clicks should open the target URL');

echo "push notifications regression source checks ok\n";
