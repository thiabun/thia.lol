<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = api_config()['database'] ?? [];
    $host = $config['host'] ?? '';
    $name = $config['name'] ?? '';
    $user = $config['user'] ?? '';
    $password = $config['password'] ?? '';
    $charset = $config['charset'] ?? 'utf8mb4';
    $port = (int) ($config['port'] ?? 3306);

    if ($host === '' || $name === '' || $user === '') {
        throw new RuntimeException('Database config is incomplete.');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $host,
        $port,
        $name,
        $charset
    );

    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function db_query(string $sql, array $params = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($params);

    return $statement;
}
