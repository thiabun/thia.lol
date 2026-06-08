<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    exit;
}

function load_config(): array
{
    $configPath = dirname(__DIR__) . '/config/config.php';
    $examplePath = dirname(__DIR__) . '/config/config.example.php';

    return require file_exists($configPath) ? $configPath : $examplePath;
}
