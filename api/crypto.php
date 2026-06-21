<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

const THIA_CRYPTO_KEY_BYTES = 32;
const THIA_CRYPTO_OPENSSL_PREFIX = 'openssl:';

function thia_crypto_key(): ?string
{
    $value = api_config()['security']['integration_encryption_key'] ?? '';

    if (!is_string($value) || trim($value) === '') {
        return null;
    }

    $trimmed = trim($value);
    $decoded = base64_decode($trimmed, true);

    if (is_string($decoded) && strlen($decoded) === THIA_CRYPTO_KEY_BYTES) {
        return $decoded;
    }

    if (strlen($trimmed) >= THIA_CRYPTO_KEY_BYTES) {
        return substr($trimmed, 0, THIA_CRYPTO_KEY_BYTES);
    }

    return null;
}

function thia_crypto_method(): ?string
{
    if (
        defined('SODIUM_CRYPTO_SECRETBOX_KEYBYTES')
        && defined('SODIUM_CRYPTO_SECRETBOX_NONCEBYTES')
        && function_exists('sodium_crypto_secretbox')
        && function_exists('sodium_crypto_secretbox_open')
    ) {
        return 'sodium';
    }

    if (
        function_exists('openssl_encrypt')
        && function_exists('openssl_decrypt')
        && function_exists('openssl_get_cipher_methods')
    ) {
        $methods = array_map('strtolower', openssl_get_cipher_methods(true));

        if (in_array('aes-256-gcm', $methods, true)) {
            return 'openssl';
        }
    }

    return null;
}

function thia_crypto_require_key(): string
{
    $key = thia_crypto_key();

    if ($key === null) {
        json_error('Account security encryption is not configured.', 503);
    }

    if (thia_crypto_method() === null) {
        json_error('Account security encryption is not available on this server. Enable PHP Sodium or OpenSSL.', 503);
    }

    return $key;
}

function thia_crypto_encrypt(string $value): string
{
    $key = thia_crypto_require_key();

    if (thia_crypto_method() === 'openssl') {
        return THIA_CRYPTO_OPENSSL_PREFIX . thia_crypto_encrypt_openssl($value, $key);
    }

    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = sodium_crypto_secretbox($value, $nonce, $key);

    return base64_encode($nonce . $cipher);
}

function thia_crypto_decrypt_or_throw(string $value): string
{
    $key = thia_crypto_key();
    $method = thia_crypto_method();

    if ($key === null) {
        throw new RuntimeException('Account security encryption is not configured.');
    }

    if ($method === null) {
        throw new RuntimeException('Account security encryption is not available on this server. Enable PHP Sodium or OpenSSL.');
    }

    if (str_starts_with($value, THIA_CRYPTO_OPENSSL_PREFIX)) {
        return thia_crypto_decrypt_openssl(substr($value, strlen(THIA_CRYPTO_OPENSSL_PREFIX)), $key);
    }

    if ($method !== 'sodium') {
        throw new RuntimeException('Stored secret requires PHP Sodium to decrypt.');
    }

    $decoded = base64_decode($value, true);

    if (!is_string($decoded) || strlen($decoded) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
        throw new RuntimeException('Stored secret is invalid.');
    }

    $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $plain = sodium_crypto_secretbox_open($cipher, $nonce, $key);

    if (!is_string($plain)) {
        throw new RuntimeException('Stored secret could not be decrypted.');
    }

    return $plain;
}

function thia_crypto_encrypt_openssl(string $value, string $key): string
{
    $nonce = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);

    if (!is_string($cipher) || $tag === '') {
        json_error('Account security encryption failed.', 500);
    }

    return base64_encode($nonce . $tag . $cipher);
}

function thia_crypto_decrypt_openssl(string $value, string $key): string
{
    $decoded = base64_decode($value, true);

    if (!is_string($decoded) || strlen($decoded) <= 28) {
        throw new RuntimeException('Stored secret is invalid.');
    }

    $nonce = substr($decoded, 0, 12);
    $tag = substr($decoded, 12, 16);
    $cipher = substr($decoded, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);

    if (!is_string($plain)) {
        throw new RuntimeException('Stored secret could not be decrypted.');
    }

    return $plain;
}
