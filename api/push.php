<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/read.php';

const PUSH_CONTENT_ENCODING = 'aes128gcm';
const PUSH_DEFAULT_TTL_SECONDS = 3600;
const PUSH_VAPID_EXPIRY_SECONDS = 43200;

function push_dispatch(array $segments, string $method): void
{
    if (($segments[0] ?? null) !== 'me' || ($segments[1] ?? null) !== 'push') {
        json_error('Not found.', 404);
    }

    if (count($segments) === 2) {
        if ($method === 'GET' || $method === 'HEAD') {
            push_status();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'subscriptions') {
        if ($method === 'POST') {
            push_subscription_save();
        }

        if ($method === 'DELETE') {
            push_subscription_disable();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[2] === 'test') {
        if ($method === 'POST') {
            push_test_send();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function push_status(): void
{
    $session = require_authenticated_session();

    json_success(push_status_payload((int) $session['user_id']));
}

function push_subscription_save(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    if (!push_subscriptions_table_exists()) {
        json_error('Desktop notification storage is not ready. Run pending migrations.', 503);
    }

    if (!push_configured()) {
        json_error('Desktop notifications are not configured on this server.', 503);
    }

    $body = request_json_body();
    $subscription = push_subscription_input($body);
    $endpointHash = hash('sha256', $subscription['endpoint']);
    $userAgent = push_user_agent($body['userAgent'] ?? $body['user_agent'] ?? null);

    db_query(
        'INSERT INTO push_subscriptions
            (user_id, endpoint_hash, endpoint, p256dh_key, auth_secret, content_encoding, user_agent, disabled_at, last_error_at, last_error, failure_count)
         VALUES
            (:user_id, :endpoint_hash, :endpoint, :p256dh_key, :auth_secret, :content_encoding, :user_agent, NULL, NULL, NULL, 0)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            endpoint = VALUES(endpoint),
            p256dh_key = VALUES(p256dh_key),
            auth_secret = VALUES(auth_secret),
            content_encoding = VALUES(content_encoding),
            user_agent = VALUES(user_agent),
            disabled_at = NULL,
            last_error_at = NULL,
            last_error = NULL,
            failure_count = 0,
            updated_at = CURRENT_TIMESTAMP()',
        [
            'user_id' => (int) $session['user_id'],
            'endpoint_hash' => $endpointHash,
            'endpoint' => $subscription['endpoint'],
            'p256dh_key' => $subscription['p256dh'],
            'auth_secret' => $subscription['auth'],
            'content_encoding' => PUSH_CONTENT_ENCODING,
            'user_agent' => $userAgent,
        ]
    );

    json_success(push_status_payload((int) $session['user_id']));
}

function push_subscription_disable(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    if (!push_subscriptions_table_exists()) {
        json_error('Desktop notification storage is not ready. Run pending migrations.', 503);
    }

    $body = request_json_body();
    $userId = (int) $session['user_id'];
    $params = ['user_id' => $userId];
    $where = 'user_id = :user_id AND disabled_at IS NULL';

    if (isset($body['id'])) {
        $id = push_positive_int($body['id'], 'Subscription id');
        $where .= ' AND id = :id';
        $params['id'] = $id;
    } elseif (isset($body['endpoint'])) {
        $endpoint = push_endpoint($body['endpoint']);
        $where .= ' AND endpoint_hash = :endpoint_hash';
        $params['endpoint_hash'] = hash('sha256', $endpoint);
    } else {
        json_error('Choose a desktop notification subscription to disable.', 422);
    }

    db_query(
        "UPDATE push_subscriptions
         SET disabled_at = CURRENT_TIMESTAMP(),
             last_error_at = CURRENT_TIMESTAMP(),
             last_error = 'Disabled by user',
             updated_at = CURRENT_TIMESTAMP()
         WHERE {$where}",
        $params
    );

    json_success(push_status_payload($userId));
}

function push_test_send(): void
{
    $session = require_authenticated_session();
    require_csrf_token($session);

    if (!push_subscriptions_table_exists()) {
        json_error('Desktop notification storage is not ready. Run pending migrations.', 503);
    }

    if (!push_configured()) {
        json_error('Desktop notifications are not configured on this server.', 503);
    }

    $userId = (int) $session['user_id'];
    $result = push_send_user_payload($userId, [
        'title' => 'Desktop notifications are on',
        'body' => 'thia.lol can send desktop notifications on this browser.',
        'url' => '/notifications',
        'tag' => 'thia-test-notification',
        'type' => 'test',
    ]);

    json_success([
        ...push_status_payload($userId),
        'lastSend' => $result,
    ]);
}

function push_status_payload(int $userId): array
{
    $configured = push_configured();
    $storageReady = push_subscriptions_table_exists();
    $publicKey = push_vapid_public_key();
    $subscriptions = $storageReady ? push_subscription_rows_for_user($userId) : [];
    $activeSubscriptions = array_values(array_filter(
        $subscriptions,
        static fn (array $row): bool => ($row['disabledAt'] ?? null) === null
    ));

    return [
        'supported' => true,
        'configured' => $configured,
        'storageReady' => $storageReady,
        'publicKey' => $configured ? $publicKey : null,
        'subject' => push_subject(),
        'enabled' => count($activeSubscriptions) > 0,
        'subscriptionCount' => count($activeSubscriptions),
        'subscriptions' => $subscriptions,
        'diagnostics' => [
            'missingConfigKeys' => push_missing_config_keys(),
            'curlAvailable' => function_exists('curl_init'),
            'opensslAvailable' => function_exists('openssl_pkey_new') && function_exists('openssl_pkey_derive'),
        ],
    ];
}

function push_subscription_rows_for_user(int $userId): array
{
    $statement = db_query(
        'SELECT id, endpoint_hash, user_agent, last_success_at, last_error_at, last_error,
                failure_count, disabled_at, created_at, updated_at
         FROM push_subscriptions
         WHERE user_id = :user_id
         ORDER BY disabled_at IS NULL DESC, updated_at DESC, id DESC
         LIMIT 20',
        ['user_id' => $userId]
    );

    return array_map(
        static fn (array $row): array => [
            'id' => (int) $row['id'],
            'endpointHash' => (string) $row['endpoint_hash'],
            'userAgent' => $row['user_agent'] ?? null,
            'lastSuccessAt' => $row['last_success_at'] ?? null,
            'lastErrorAt' => $row['last_error_at'] ?? null,
            'lastError' => $row['last_error'] ?? null,
            'failureCount' => (int) ($row['failure_count'] ?? 0),
            'disabledAt' => $row['disabled_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ],
        $statement->fetchAll()
    );
}

function push_send_notification_payload(array $notification): void
{
    if (!push_subscriptions_table_exists() || !push_configured()) {
        return;
    }

    $userId = (int) ($notification['userId'] ?? $notification['user_id'] ?? 0);
    $type = is_string($notification['type'] ?? null) ? (string) $notification['type'] : '';

    if ($userId < 1 || !push_user_allows_type($userId, $type)) {
        return;
    }

    push_send_user_payload($userId, push_notification_browser_payload($notification));
}

function push_notification_browser_payload(array $notification): array
{
    $type = is_string($notification['type'] ?? null) ? (string) $notification['type'] : 'notification';
    $actor = is_array($notification['actor'] ?? null) ? $notification['actor'] : null;
    $actorName = 'Someone';

    if ($actor !== null) {
        $actorName = (string) ($actor['displayName'] ?? $actor['handle'] ?? 'Someone');
    }

    $title = 'New notification';
    $body = 'Open thia.lol to view it.';

    if ($type === 'follow') {
        $title = "{$actorName} followed you";
        $body = 'Open their profile on thia.lol.';
    } elseif ($type === 'moot') {
        $title = "You and {$actorName} are moots";
        $body = 'Open thia.lol to see their profile.';
    } elseif ($type === 'like') {
        $title = "{$actorName} liked your post";
        $body = 'Open the post on thia.lol.';
    } elseif ($type === 'reply') {
        $title = "{$actorName} replied to your post";
        $body = 'Open the thread on thia.lol.';
    } elseif ($type === 'reblog') {
        $title = "{$actorName} reblogged your post";
        $body = 'Open the post on thia.lol.';
    } elseif ($type === 'message') {
        $title = 'New message';
        $body = 'Open Chat on thia.lol.';
    } elseif ($type === 'mention') {
        $title = "{$actorName} mentioned you";
        $body = 'Open thia.lol to view the mention.';
    } elseif ($type === 'badge_granted') {
        $data = is_array($notification['data'] ?? null) ? $notification['data'] : [];
        $badgeName = is_string($data['badgeName'] ?? null) ? (string) $data['badgeName'] : 'a badge';
        $title = "{$actorName} granted you {$badgeName}";
        $body = 'Open your profile on thia.lol.';
    }

    return [
        'title' => $title,
        'body' => $body,
        'url' => is_string($notification['targetUrl'] ?? null) ? (string) $notification['targetUrl'] : '/notifications',
        'tag' => 'thia-notification-' . (string) ($notification['id'] ?? uniqid('', false)),
        'type' => $type,
    ];
}

function push_send_user_payload(int $userId, array $payload): array
{
    $subscriptions = push_active_subscriptions_for_user($userId);
    $results = [
        'attempted' => 0,
        'sent' => 0,
        'failed' => 0,
        'disabled' => 0,
    ];

    foreach ($subscriptions as $subscription) {
        $results['attempted']++;

        try {
            $response = push_send_subscription($subscription, $payload);

            if ($response['ok']) {
                $results['sent']++;
                push_mark_subscription_success((int) $subscription['id']);
                continue;
            }

            $results['failed']++;
            push_mark_subscription_failure((int) $subscription['id'], (int) $response['status'], (string) $response['error']);

            if (in_array((int) $response['status'], [404, 410], true)) {
                $results['disabled']++;
            }
        } catch (Throwable $exception) {
            $results['failed']++;
            push_mark_subscription_failure((int) $subscription['id'], 0, $exception->getMessage());
        }
    }

    return $results;
}

function push_active_subscriptions_for_user(int $userId): array
{
    if (!push_subscriptions_table_exists()) {
        return [];
    }

    $statement = db_query(
        'SELECT id, endpoint, p256dh_key, auth_secret, content_encoding
         FROM push_subscriptions
         WHERE user_id = :user_id
           AND disabled_at IS NULL
         ORDER BY updated_at DESC, id DESC
         LIMIT 20',
        ['user_id' => $userId]
    );

    return $statement->fetchAll();
}

function push_send_subscription(array $subscription, array $payload): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'status' => 0, 'error' => 'PHP cURL is not available.'];
    }

    $endpoint = (string) $subscription['endpoint'];
    $encoded = push_encrypt_payload(
        json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        (string) $subscription['p256dh_key'],
        (string) $subscription['auth_secret']
    );
    $headers = [
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'TTL: ' . PUSH_DEFAULT_TTL_SECONDS,
        'Urgency: normal',
        'Authorization: ' . push_vapid_authorization_header($endpoint),
    ];
    $publicKey = push_vapid_public_key();

    if ($publicKey !== '') {
        $headers[] = 'Crypto-Key: p256ecdsa=' . $publicKey;
    }

    $curl = curl_init($endpoint);

    if ($curl === false) {
        return ['ok' => false, 'status' => 0, 'error' => 'Could not start push request.'];
    }

    $timeout = max(1, min(10, (int) (api_config()['push']['send_timeout_seconds'] ?? 3)));

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $encoded,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => false,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => min($timeout, 3),
    ]);

    $responseBody = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if ($responseBody === false || $status < 200 || $status >= 300) {
        return [
            'ok' => false,
            'status' => $status,
            'error' => $error !== '' ? $error : ('Push service returned HTTP ' . $status),
        ];
    }

    return ['ok' => true, 'status' => $status, 'error' => null];
}

function push_encrypt_payload(string $payload, string $receiverPublicKeyValue, string $authSecretValue): string
{
    $receiverPublicKey = push_base64url_decode($receiverPublicKeyValue);
    $authSecret = push_base64url_decode($authSecretValue);

    if (!is_string($receiverPublicKey) || strlen($receiverPublicKey) !== 65 || $receiverPublicKey[0] !== "\x04") {
        throw new RuntimeException('Push receiver key is invalid.');
    }

    if (!is_string($authSecret) || strlen($authSecret) < 16) {
        throw new RuntimeException('Push auth secret is invalid.');
    }

    $serverKey = openssl_pkey_new([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]);

    if ($serverKey === false) {
        throw new RuntimeException('Could not create push sender key.');
    }

    $serverDetails = openssl_pkey_get_details($serverKey);

    if (!is_array($serverDetails) || !isset($serverDetails['ec']['x'], $serverDetails['ec']['y'])) {
        throw new RuntimeException('Could not inspect push sender key.');
    }

    $serverPublicKey = "\x04" . str_pad((string) $serverDetails['ec']['x'], 32, "\x00", STR_PAD_LEFT) . str_pad((string) $serverDetails['ec']['y'], 32, "\x00", STR_PAD_LEFT);
    $receiverKey = openssl_pkey_get_public(push_ec_public_key_pem($receiverPublicKey));

    if ($receiverKey === false) {
        throw new RuntimeException('Could not read push receiver key.');
    }

    $sharedSecret = openssl_pkey_derive($receiverKey, $serverKey, 32);

    if (!is_string($sharedSecret)) {
        throw new RuntimeException('Could not derive push shared secret.');
    }

    $keyInfo = "WebPush: info\x00" . $receiverPublicKey . $serverPublicKey;
    $prkKey = hash_hmac('sha256', $sharedSecret, $authSecret, true);
    $ikm = hash_hmac('sha256', $keyInfo . "\x01", $prkKey, true);
    $salt = random_bytes(16);
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $contentEncryptionKey = push_hkdf_expand($prk, "Content-Encoding: aes128gcm\x00", 16);
    $nonce = push_hkdf_expand($prk, "Content-Encoding: nonce\x00", 12);
    $plainText = $payload . "\x02";
    $tag = '';
    $cipherText = openssl_encrypt($plainText, 'aes-128-gcm', $contentEncryptionKey, OPENSSL_RAW_DATA, $nonce, $tag);

    if (!is_string($cipherText) || !is_string($tag)) {
        throw new RuntimeException('Could not encrypt push payload.');
    }

    return $salt . pack('N', 4096) . chr(strlen($serverPublicKey)) . $serverPublicKey . $cipherText . $tag;
}

function push_hkdf_expand(string $prk, string $info, int $length): string
{
    return substr(hash_hmac('sha256', $info . "\x01", $prk, true), 0, $length);
}

function push_vapid_authorization_header(string $endpoint): string
{
    $publicKey = push_vapid_public_key();
    $privateKey = push_vapid_private_key();

    if ($publicKey === '' || $privateKey === '') {
        throw new RuntimeException('Push VAPID keys are not configured.');
    }

    $header = push_base64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_THROW_ON_ERROR));
    $payload = push_base64url_encode(json_encode([
        'aud' => push_endpoint_audience($endpoint),
        'exp' => time() + PUSH_VAPID_EXPIRY_SECONDS,
        'sub' => push_subject(),
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
    $signingInput = $header . '.' . $payload;
    $signature = '';
    $privatePem = push_vapid_private_pem($privateKey, $publicKey);

    if (!openssl_sign($signingInput, $signature, $privatePem, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Could not sign push VAPID token.');
    }

    return 'vapid t=' . $signingInput . '.' . push_base64url_encode(push_ecdsa_der_to_jose($signature)) . ', k=' . $publicKey;
}

function push_endpoint_audience(string $endpoint): string
{
    $scheme = parse_url($endpoint, PHP_URL_SCHEME);
    $host = parse_url($endpoint, PHP_URL_HOST);
    $port = parse_url($endpoint, PHP_URL_PORT);

    if (!is_string($scheme) || !is_string($host) || $scheme !== 'https') {
        throw new RuntimeException('Push endpoint must be HTTPS.');
    }

    $origin = $scheme . '://' . $host;

    if (is_int($port) && !in_array($port, [443, 80], true)) {
        $origin .= ':' . $port;
    }

    return $origin;
}

function push_vapid_private_pem(string $privateKeyValue, string $publicKeyValue): string
{
    if (str_contains($privateKeyValue, 'BEGIN')) {
        return $privateKeyValue;
    }

    $privateKey = push_base64url_decode($privateKeyValue);
    $publicKey = push_base64url_decode($publicKeyValue);

    if (!is_string($privateKey) || strlen($privateKey) !== 32) {
        throw new RuntimeException('Push VAPID private key is invalid.');
    }

    if (!is_string($publicKey) || strlen($publicKey) !== 65) {
        throw new RuntimeException('Push VAPID public key is invalid.');
    }

    $der = push_asn1_sequence(
        push_asn1_integer("\x01")
        . push_asn1_octet_string($privateKey)
        . push_asn1_context(0, push_asn1_oid('1.2.840.10045.3.1.7'))
        . push_asn1_context(1, push_asn1_bit_string($publicKey))
    );

    return "-----BEGIN EC PRIVATE KEY-----\n"
        . chunk_split(base64_encode($der), 64, "\n")
        . "-----END EC PRIVATE KEY-----\n";
}

function push_ec_public_key_pem(string $publicKey): string
{
    $der = push_asn1_sequence(
        push_asn1_sequence(
            push_asn1_oid('1.2.840.10045.2.1')
            . push_asn1_oid('1.2.840.10045.3.1.7')
        )
        . push_asn1_bit_string($publicKey)
    );

    return "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($der), 64, "\n")
        . "-----END PUBLIC KEY-----\n";
}

function push_ecdsa_der_to_jose(string $der): string
{
    $offset = 0;

    if (ord($der[$offset++]) !== 0x30) {
        throw new RuntimeException('Invalid ECDSA signature.');
    }

    push_asn1_read_length($der, $offset);

    if (ord($der[$offset++]) !== 0x02) {
        throw new RuntimeException('Invalid ECDSA signature.');
    }

    $rLength = push_asn1_read_length($der, $offset);
    $r = substr($der, $offset, $rLength);
    $offset += $rLength;

    if (ord($der[$offset++]) !== 0x02) {
        throw new RuntimeException('Invalid ECDSA signature.');
    }

    $sLength = push_asn1_read_length($der, $offset);
    $s = substr($der, $offset, $sLength);

    return push_left_pad_signature_int($r) . push_left_pad_signature_int($s);
}

function push_left_pad_signature_int(string $value): string
{
    $trimmed = ltrim($value, "\x00");

    if (strlen($trimmed) > 32) {
        $trimmed = substr($trimmed, -32);
    }

    return str_pad($trimmed, 32, "\x00", STR_PAD_LEFT);
}

function push_asn1_read_length(string $der, int &$offset): int
{
    $length = ord($der[$offset++]);

    if (($length & 0x80) === 0) {
        return $length;
    }

    $bytes = $length & 0x7f;
    $length = 0;

    for ($index = 0; $index < $bytes; $index++) {
        $length = ($length << 8) | ord($der[$offset++]);
    }

    return $length;
}

function push_asn1_sequence(string $body): string
{
    return "\x30" . push_asn1_length(strlen($body)) . $body;
}

function push_asn1_integer(string $value): string
{
    if ($value === '' || (ord($value[0]) & 0x80) !== 0) {
        $value = "\x00" . $value;
    }

    return "\x02" . push_asn1_length(strlen($value)) . $value;
}

function push_asn1_octet_string(string $value): string
{
    return "\x04" . push_asn1_length(strlen($value)) . $value;
}

function push_asn1_bit_string(string $value): string
{
    $body = "\x00" . $value;

    return "\x03" . push_asn1_length(strlen($body)) . $body;
}

function push_asn1_context(int $tag, string $body): string
{
    return chr(0xa0 + $tag) . push_asn1_length(strlen($body)) . $body;
}

function push_asn1_oid(string $oid): string
{
    $parts = array_map('intval', explode('.', $oid));
    $body = chr($parts[0] * 40 + $parts[1]);

    foreach (array_slice($parts, 2) as $part) {
        $encoded = chr($part & 0x7f);
        $part >>= 7;

        while ($part > 0) {
            $encoded = chr(0x80 | ($part & 0x7f)) . $encoded;
            $part >>= 7;
        }

        $body .= $encoded;
    }

    return "\x06" . push_asn1_length(strlen($body)) . $body;
}

function push_asn1_length(int $length): string
{
    if ($length < 0x80) {
        return chr($length);
    }

    $bytes = '';

    while ($length > 0) {
        $bytes = chr($length & 0xff) . $bytes;
        $length >>= 8;
    }

    return chr(0x80 | strlen($bytes)) . $bytes;
}

function push_mark_subscription_success(int $subscriptionId): void
{
    db_query(
        'UPDATE push_subscriptions
         SET last_success_at = CURRENT_TIMESTAMP(),
             last_error_at = NULL,
             last_error = NULL,
             failure_count = 0,
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id',
        ['id' => $subscriptionId]
    );
}

function push_mark_subscription_failure(int $subscriptionId, int $status, string $error): void
{
    $disable = in_array($status, [404, 410], true);

    db_query(
        'UPDATE push_subscriptions
         SET last_error_at = CURRENT_TIMESTAMP(),
             last_error = :last_error,
             failure_count = LEAST(failure_count + 1, 65535),
             disabled_at = IF(:disable = 1, COALESCE(disabled_at, CURRENT_TIMESTAMP()), disabled_at),
             updated_at = CURRENT_TIMESTAMP()
         WHERE id = :id',
        [
            'id' => $subscriptionId,
            'last_error' => substr($error, 0, 255),
            'disable' => $disable ? 1 : 0,
        ]
    );
}

function push_user_allows_type(int $userId, string $type): bool
{
    if (!database_table_exists('user_preferences')) {
        return true;
    }

    $row = db_query(
        'SELECT push_notification_preferences_json
         FROM user_preferences
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    if (!is_array($row) || !is_string($row['push_notification_preferences_json'] ?? null)) {
        return true;
    }

    try {
        $preferences = json_decode((string) $row['push_notification_preferences_json'], true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return true;
    }

    if (!is_array($preferences)) {
        return true;
    }

    $key = push_notification_type_key($type);

    return !array_key_exists($key, $preferences) || (bool) $preferences[$key];
}

function push_notification_type_key(string $type): string
{
    return match ($type) {
        'follow' => 'follows',
        'moot' => 'moots',
        'like' => 'likes',
        'reply' => 'replies',
        'reblog' => 'reblogs',
        'message' => 'messages',
        'mention' => 'mentions',
        'badge_granted' => 'badges',
        default => $type,
    };
}

function push_subscription_input(array $body): array
{
    $endpoint = push_endpoint($body['endpoint'] ?? null);
    $keys = is_array($body['keys'] ?? null) ? $body['keys'] : [];
    $p256dh = push_subscription_key($keys['p256dh'] ?? $body['p256dh'] ?? null, 'Browser public key', 65);
    $auth = push_subscription_key($keys['auth'] ?? $body['auth'] ?? null, 'Browser auth secret', 16);

    return [
        'endpoint' => $endpoint,
        'p256dh' => $p256dh,
        'auth' => $auth,
    ];
}

function push_endpoint(mixed $value): string
{
    if (!is_string($value)) {
        json_error('Desktop notification endpoint is required.', 422);
    }

    $endpoint = trim($value);

    if (
        $endpoint === ''
        || strlen($endpoint) > 2000
        || filter_var($endpoint, FILTER_VALIDATE_URL) === false
        || strtolower((string) parse_url($endpoint, PHP_URL_SCHEME)) !== 'https'
    ) {
        json_error('Desktop notification endpoint must be a valid HTTPS URL.', 422);
    }

    return $endpoint;
}

function push_subscription_key(mixed $value, string $label, int $minimumLength): string
{
    if (!is_string($value)) {
        json_error("{$label} is required.", 422);
    }

    $normalized = trim($value);
    $decoded = push_base64url_decode($normalized);

    if (!is_string($decoded) || strlen($decoded) < $minimumLength || strlen($decoded) > 200) {
        json_error("{$label} is invalid.", 422);
    }

    return $normalized;
}

function push_user_agent(mixed $value): ?string
{
    $candidate = is_string($value) ? trim($value) : trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));

    return $candidate === '' ? null : substr($candidate, 0, 500);
}

function push_positive_int(mixed $value, string $label): int
{
    if (!is_int($value) && !(is_string($value) && preg_match('/^\d+$/', $value) === 1)) {
        json_error("{$label} must be numeric.", 422);
    }

    $id = (int) $value;

    if ($id < 1) {
        json_error("{$label} must be numeric.", 422);
    }

    return $id;
}

function push_configured(): bool
{
    return push_missing_config_keys() === [];
}

function push_missing_config_keys(): array
{
    $missing = [];

    if (push_vapid_public_key() === '') {
        $missing[] = 'push.vapid_public_key';
    }

    if (push_vapid_private_key() === '') {
        $missing[] = 'push.vapid_private_key';
    }

    if (push_subject() === '') {
        $missing[] = 'push.subject';
    }

    return $missing;
}

function push_vapid_public_key(): string
{
    $value = api_config()['push']['vapid_public_key'] ?? '';

    if (!is_string($value)) {
        return '';
    }

    $trimmed = trim($value);
    $decoded = push_base64url_decode($trimmed);

    return is_string($decoded) && strlen($decoded) === 65 ? $trimmed : '';
}

function push_vapid_private_key(): string
{
    $value = api_config()['push']['vapid_private_key'] ?? '';

    if (!is_string($value)) {
        return '';
    }

    $trimmed = trim($value);

    if (str_contains($trimmed, 'BEGIN')) {
        return $trimmed;
    }

    $decoded = push_base64url_decode($trimmed);

    return is_string($decoded) && strlen($decoded) === 32 ? $trimmed : '';
}

function push_subject(): string
{
    $value = api_config()['push']['subject'] ?? '';
    $subject = is_string($value) ? trim($value) : '';

    if ($subject === '') {
        return '';
    }

    if (
        str_starts_with($subject, 'mailto:')
        || filter_var($subject, FILTER_VALIDATE_URL) !== false
    ) {
        return $subject;
    }

    return '';
}

function push_base64url_decode(string $value): string|false
{
    $remainder = strlen($value) % 4;

    if ($remainder > 0) {
        $value .= str_repeat('=', 4 - $remainder);
    }

    return base64_decode(strtr($value, '-_', '+/'), true);
}

function push_base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function push_subscriptions_table_exists(): bool
{
    return database_table_exists('push_subscriptions');
}
