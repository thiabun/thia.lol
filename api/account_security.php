<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/read.php';
require_once __DIR__ . '/crypto.php';

const ACCOUNT_2FA_ISSUER = 'thia.lol';
const ACCOUNT_2FA_STEP_SECONDS = 30;
const ACCOUNT_2FA_DIGITS = 6;
const ACCOUNT_2FA_CHALLENGE_SECONDS = 600;
const ACCOUNT_2FA_MAX_ATTEMPTS = 8;

function account_security_storage_ready(): bool
{
    return database_table_exists('user_two_factor')
        && database_table_exists('user_two_factor_backup_codes')
        && database_table_exists('auth_two_factor_challenges');
}

function account_two_factor_enabled(int $userId): bool
{
    if (!database_table_exists('user_two_factor')) {
        return false;
    }

    $row = db_query(
        'SELECT enabled_at
         FROM user_two_factor
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    return is_array($row) && $row['enabled_at'] !== null;
}

function account_two_factor_status(int $userId): array
{
    $enabled = account_two_factor_enabled($userId);
    $backupCount = 0;

    if ($enabled && database_table_exists('user_two_factor_backup_codes')) {
        $row = db_query(
            'SELECT COUNT(*) AS code_count
             FROM user_two_factor_backup_codes
             WHERE user_id = :user_id
               AND used_at IS NULL',
            ['user_id' => $userId]
        )->fetch();
        $backupCount = is_array($row) ? (int) $row['code_count'] : 0;
    }

    return [
        'enabled' => $enabled,
        'backupCodeCount' => $backupCount,
        'encryptionConfigured' => thia_crypto_key() !== null,
        'encryptionAvailable' => thia_crypto_method() !== null,
    ];
}

function account_two_factor_setup_payload(array $session): array
{
    account_two_factor_require_storage();
    thia_crypto_require_key();

    $userId = (int) $session['user_id'];
    $secret = account_totp_generate_secret();
    $cipher = thia_crypto_encrypt($secret);

    db_query(
        'INSERT INTO user_two_factor (user_id, pending_secret_cipher, updated_at)
         VALUES (:user_id, :pending_secret_cipher, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           pending_secret_cipher = VALUES(pending_secret_cipher),
           updated_at = UTC_TIMESTAMP()',
        [
            'user_id' => $userId,
            'pending_secret_cipher' => $cipher,
        ]
    );

    $label = ACCOUNT_2FA_ISSUER . ':' . (string) $session['email'];
    $otpauthUri = sprintf(
        'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d',
        rawurlencode($label),
        rawurlencode($secret),
        rawurlencode(ACCOUNT_2FA_ISSUER),
        ACCOUNT_2FA_DIGITS,
        ACCOUNT_2FA_STEP_SECONDS
    );

    return [
        'manualSecret' => $secret,
        'otpauthUri' => $otpauthUri,
    ];
}

function account_two_factor_enable(int $userId, string $code): array
{
    account_two_factor_require_storage();
    $row = db_query(
        'SELECT pending_secret_cipher
         FROM user_two_factor
         WHERE user_id = :user_id
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    if (!is_array($row) || !is_string($row['pending_secret_cipher'] ?? null) || $row['pending_secret_cipher'] === '') {
        json_error('Start two-factor setup first.', 422);
    }

    try {
        $secret = thia_crypto_decrypt_or_throw((string) $row['pending_secret_cipher']);
    } catch (Throwable $exception) {
        json_error('Two-factor setup secret could not be read.', 503, $exception);
    }

    if (!account_totp_verify_code($secret, $code)) {
        json_error('Enter a valid authenticator code.', 422);
    }

    db()->beginTransaction();

    db_query(
        'UPDATE user_two_factor
         SET secret_cipher = pending_secret_cipher,
             pending_secret_cipher = NULL,
             enabled_at = UTC_TIMESTAMP(),
             updated_at = UTC_TIMESTAMP()
         WHERE user_id = :user_id',
        ['user_id' => $userId]
    );

    db_query(
        'DELETE FROM user_two_factor_backup_codes
         WHERE user_id = :user_id',
        ['user_id' => $userId]
    );

    $codes = account_two_factor_insert_backup_codes($userId);

    db()->commit();

    return [
        'enabled' => true,
        'backupCodes' => $codes,
        'backupCodeCount' => count($codes),
    ];
}

function account_two_factor_disable(int $userId): void
{
    account_two_factor_require_storage();

    db()->beginTransaction();

    db_query('DELETE FROM user_two_factor_backup_codes WHERE user_id = :user_id', [
        'user_id' => $userId,
    ]);
    db_query('DELETE FROM auth_two_factor_challenges WHERE user_id = :user_id', [
        'user_id' => $userId,
    ]);
    db_query('DELETE FROM user_two_factor WHERE user_id = :user_id', [
        'user_id' => $userId,
    ]);

    db()->commit();
}

function account_two_factor_regenerate_backup_codes(int $userId): array
{
    account_two_factor_require_storage();

    if (!account_two_factor_enabled($userId)) {
        json_error('Two-factor authentication is not enabled.', 422);
    }

    db()->beginTransaction();
    db_query('DELETE FROM user_two_factor_backup_codes WHERE user_id = :user_id', [
        'user_id' => $userId,
    ]);
    $codes = account_two_factor_insert_backup_codes($userId);
    db()->commit();

    return $codes;
}

function account_two_factor_create_challenge(int $userId): array
{
    account_two_factor_require_storage();

    $challengeId = bin2hex(random_bytes(24));
    $expiresAt = gmdate('Y-m-d H:i:s', time() + ACCOUNT_2FA_CHALLENGE_SECONDS);

    db_query(
        'INSERT INTO auth_two_factor_challenges (id, user_id, expires_at)
         VALUES (:id, :user_id, :expires_at)',
        [
            'id' => $challengeId,
            'user_id' => $userId,
            'expires_at' => $expiresAt,
        ]
    );

    return [
        'twoFactorRequired' => true,
        'challengeId' => $challengeId,
        'expiresAt' => $expiresAt,
    ];
}

function account_two_factor_verify_challenge(string $challengeId, string $code): int
{
    account_two_factor_require_storage();

    $row = db_query(
        'SELECT id, user_id, attempts
         FROM auth_two_factor_challenges
         WHERE id = :id
           AND consumed_at IS NULL
           AND expires_at > UTC_TIMESTAMP()
         LIMIT 1',
        ['id' => $challengeId]
    )->fetch();

    if (!is_array($row)) {
        json_error('Two-factor challenge expired. Sign in again.', 401);
    }

    $attempts = (int) $row['attempts'];
    $userId = (int) $row['user_id'];

    if ($attempts >= ACCOUNT_2FA_MAX_ATTEMPTS) {
        json_error('Too many two-factor attempts. Sign in again.', 429);
    }

    $valid = account_two_factor_verify_user_code($userId, $code);

    if (!$valid) {
        db_query(
            'UPDATE auth_two_factor_challenges
             SET attempts = attempts + 1
             WHERE id = :id',
            ['id' => $challengeId]
        );
        json_error('Enter a valid authenticator or recovery code.', 422);
    }

    db_query(
        'UPDATE auth_two_factor_challenges
         SET consumed_at = UTC_TIMESTAMP()
         WHERE id = :id',
        ['id' => $challengeId]
    );

    return $userId;
}

function account_two_factor_verify_user_code(int $userId, string $code): bool
{
    $normalized = account_two_factor_normalize_code($code);
    $row = db_query(
        'SELECT secret_cipher
         FROM user_two_factor
         WHERE user_id = :user_id
           AND enabled_at IS NOT NULL
         LIMIT 1',
        ['user_id' => $userId]
    )->fetch();

    if (!is_array($row) || !is_string($row['secret_cipher'] ?? null) || $row['secret_cipher'] === '') {
        return false;
    }

    try {
        $secret = thia_crypto_decrypt_or_throw((string) $row['secret_cipher']);
    } catch (Throwable) {
        return false;
    }

    if (account_totp_verify_code($secret, $normalized)) {
        return true;
    }

    return account_two_factor_consume_backup_code($userId, $normalized);
}

function account_two_factor_require_storage(): void
{
    if (!account_security_storage_ready()) {
        json_error('Account security storage is not ready. Run pending migrations.', 503);
    }
}

function account_two_factor_insert_backup_codes(int $userId): array
{
    $codes = [];

    for ($index = 0; $index < 10; $index++) {
        $code = strtoupper(substr(bin2hex(random_bytes(5)), 0, 10));
        $codes[] = $code;
        db_query(
            'INSERT INTO user_two_factor_backup_codes (user_id, code_hash)
             VALUES (:user_id, :code_hash)',
            [
                'user_id' => $userId,
                'code_hash' => password_hash($code, PASSWORD_DEFAULT),
            ]
        );
    }

    return $codes;
}

function account_two_factor_consume_backup_code(int $userId, string $code): bool
{
    if ($code === '') {
        return false;
    }

    $rows = db_query(
        'SELECT id, code_hash
         FROM user_two_factor_backup_codes
         WHERE user_id = :user_id
           AND used_at IS NULL',
        ['user_id' => $userId]
    )->fetchAll();

    foreach ($rows as $row) {
        if (password_verify($code, (string) $row['code_hash'])) {
            db_query(
                'UPDATE user_two_factor_backup_codes
                 SET used_at = UTC_TIMESTAMP()
                 WHERE id = :id',
                ['id' => (int) $row['id']]
            );
            return true;
        }
    }

    return false;
}

function account_two_factor_normalize_code(string $code): string
{
    return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim($code)) ?? '');
}

function account_totp_generate_secret(): string
{
    return account_base32_encode(random_bytes(20));
}

function account_totp_verify_code(string $secret, string $code): bool
{
    $normalized = account_two_factor_normalize_code($code);

    if (!preg_match('/^[0-9]{6}$/', $normalized)) {
        return false;
    }

    $counter = intdiv(time(), ACCOUNT_2FA_STEP_SECONDS);

    for ($offset = -1; $offset <= 1; $offset++) {
        if (hash_equals(account_totp_code($secret, $counter + $offset), $normalized)) {
            return true;
        }
    }

    return false;
}

function account_totp_code(string $secret, int $counter): string
{
    $key = account_base32_decode($secret);
    $binaryCounter = pack('N2', intdiv($counter, 0x100000000), $counter & 0xffffffff);
    $hash = hash_hmac('sha1', $binaryCounter, $key, true);
    $offset = ord($hash[19]) & 0x0f;
    $value = (
        ((ord($hash[$offset]) & 0x7f) << 24)
        | ((ord($hash[$offset + 1]) & 0xff) << 16)
        | ((ord($hash[$offset + 2]) & 0xff) << 8)
        | (ord($hash[$offset + 3]) & 0xff)
    ) % 1000000;

    return str_pad((string) $value, ACCOUNT_2FA_DIGITS, '0', STR_PAD_LEFT);
}

function account_base32_encode(string $bytes): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $bits = '';
    $output = '';

    for ($index = 0, $length = strlen($bytes); $index < $length; $index++) {
        $bits .= str_pad(decbin(ord($bytes[$index])), 8, '0', STR_PAD_LEFT);
    }

    foreach (str_split($bits, 5) as $chunk) {
        if (strlen($chunk) < 5) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
        }

        $output .= $alphabet[bindec($chunk)];
    }

    return $output;
}

function account_base32_decode(string $value): string
{
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $clean = strtoupper(preg_replace('/[^A-Z2-7]/', '', $value) ?? '');
    $bits = '';
    $output = '';

    for ($index = 0, $length = strlen($clean); $index < $length; $index++) {
        $position = strpos($alphabet, $clean[$index]);

        if ($position === false) {
            continue;
        }

        $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
    }

    foreach (str_split($bits, 8) as $chunk) {
        if (strlen($chunk) === 8) {
            $output .= chr(bindec($chunk));
        }
    }

    return $output;
}
