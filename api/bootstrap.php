<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function api_config(): array
{
    static $config = null;

    if (is_array($config)) {
        return $config;
    }

    $configuredPath = getenv('THIA_CONFIG_PATH');
    $paths = [];

    if (is_string($configuredPath) && $configuredPath !== '') {
        $paths[] = $configuredPath;
    }

    $paths[] = dirname(__DIR__) . '/config/config.php';
    $paths[] = dirname(__DIR__) . '/config/config.example.php';

    foreach ($paths as $path) {
        if (is_file($path)) {
            $loaded = require $path;

            if (!is_array($loaded)) {
                throw new RuntimeException('API config must return an array.');
            }

            $config = $loaded;
            return $config;
        }
    }

    throw new RuntimeException('API config file not found.');
}

function api_is_production(): bool
{
    $config = api_config();
    $environment = $config['app']['environment'] ?? 'production';
    $debug = (bool) ($config['app']['debug'] ?? false);

    return $environment === 'production' && !$debug;
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);

    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function json_success(mixed $data, int $status = 200): void
{
    json_response([
        'ok' => true,
        'data' => $data,
    ], $status);
}

function json_error(
    string $message,
    int $status = 500,
    ?Throwable $exception = null,
    array $extra = []
): void {
    $payload = array_merge([
        'ok' => false,
        'error' => $message,
    ], $extra);

    if ($exception instanceof Throwable && !api_is_production()) {
        $payload['details'] = [
            'type' => get_class($exception),
            'message' => $exception->getMessage(),
        ];
    }

    json_response($payload, $status);
}

function request_json_body(): array
{
    $rawBody = file_get_contents('php://input');

    if ($rawBody === false || trim($rawBody) === '') {
        return [];
    }

    try {
        $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        json_error('Invalid JSON body.', 400, $exception);
    }

    if (!is_array($decoded)) {
        json_error('JSON body must be an object.', 400);
    }

    return $decoded;
}

function api_route_path(): string
{
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/api', PHP_URL_PATH);

    if (!is_string($requestPath)) {
        return '';
    }

    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
    $scriptDir = rtrim($scriptDir, '/');

    if ($scriptDir !== '' && $scriptDir !== '.' && strpos($requestPath, $scriptDir) === 0) {
        $requestPath = substr($requestPath, strlen($scriptDir));
    }

    return trim($requestPath, '/');
}

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(static function (Throwable $exception): void {
    json_error('Internal server error.', 500, $exception);
});
