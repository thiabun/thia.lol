<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const MIGRATIONS_PUBLIC_PATH = 'api/migrations';

function migrations_dispatch(array $segments, string $method): void
{
    if (count($segments) === 3 && $segments[1] === 'migrations' && $segments[2] === 'status') {
        if ($method === 'GET' || $method === 'HEAD') {
            migrations_status();
        }

        json_error('Method not allowed.', 405);
    }

    if (count($segments) === 3 && $segments[1] === 'migrations' && $segments[2] === 'run') {
        if ($method === 'POST') {
            migrations_run();
        }

        json_error('Method not allowed.', 405);
    }

    json_error('Not found.', 404);
}

function migrations_status(): void
{
    require_migration_access();
    ensure_schema_migrations_table();

    json_success([
        'path' => MIGRATIONS_PUBLIC_PATH,
        'migrations' => migration_status_rows(),
    ]);
}

function migrations_run(): void
{
    require_migration_access();
    ensure_schema_migrations_table();

    $appliedRows = applied_migration_rows();
    $results = [];
    $appliedCount = 0;
    $skippedCount = 0;

    foreach (migration_files() as $file) {
        $migration = $file['migration'];
        $checksum = $file['checksum'];
        $existing = $appliedRows[$migration] ?? null;

        if (is_array($existing)) {
            if (!hash_equals((string) $existing['checksum'], $checksum)) {
                json_error('Migration checksum mismatch.', 409, null, [
                    'migration' => [
                        'filename' => $migration,
                        'appliedChecksum' => (string) $existing['checksum'],
                        'currentChecksum' => $checksum,
                    ],
                ]);
            }

            $skippedCount++;
            $results[] = [
                'migration' => $migration,
                'checksum' => $checksum,
                'status' => 'skipped',
                'appliedAt' => $existing['applied_at'],
            ];
            continue;
        }

        apply_migration_file($file);
        $appliedCount++;
        $results[] = [
            'migration' => $migration,
            'checksum' => $checksum,
            'status' => 'applied',
        ];
    }

    json_success([
        'path' => MIGRATIONS_PUBLIC_PATH,
        'appliedCount' => $appliedCount,
        'skippedCount' => $skippedCount,
        'migrations' => $results,
    ]);
}

function require_migration_access(): array
{
    require_migration_token();

    $session = require_authenticated_session();

    if ((string) $session['role'] !== 'admin') {
        json_error('Admin access is required.', 403);
    }

    return $session;
}

function require_migration_token(): void
{
    $expected = api_config()['security']['migration_token'] ?? '';

    if (!is_string($expected) || $expected === '') {
        json_error('Not found.', 404);
    }

    $provided = $_SERVER['HTTP_X_MIGRATION_TOKEN'] ?? '';

    if (!is_string($provided) || $provided === '' || !hash_equals($expected, $provided)) {
        json_error('Migration access denied.', 403);
    }
}

function ensure_schema_migrations_table(): void
{
    db_query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          migration VARCHAR(191) NOT NULL UNIQUE,
          checksum CHAR(64) NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function migration_status_rows(): array
{
    $appliedRows = applied_migration_rows();
    $rows = [];

    foreach (migration_files() as $file) {
        $migration = $file['migration'];
        $applied = $appliedRows[$migration] ?? null;

        if (is_array($applied) && !hash_equals((string) $applied['checksum'], $file['checksum'])) {
            $rows[] = [
                'migration' => $migration,
                'checksum' => $file['checksum'],
                'applied' => true,
                'appliedAt' => $applied['applied_at'],
                'checksumMismatch' => true,
                'appliedChecksum' => (string) $applied['checksum'],
            ];
            continue;
        }

        $rows[] = [
            'migration' => $migration,
            'checksum' => $file['checksum'],
            'applied' => is_array($applied),
            'appliedAt' => is_array($applied) ? $applied['applied_at'] : null,
        ];
    }

    return $rows;
}

function applied_migration_rows(): array
{
    $statement = db_query(
        'SELECT migration, checksum, applied_at
         FROM schema_migrations
         ORDER BY migration ASC'
    );
    $rows = [];

    foreach ($statement->fetchAll() as $row) {
        $rows[(string) $row['migration']] = $row;
    }

    return $rows;
}

function migration_files(): array
{
    $directory = migration_directory();
    $paths = glob($directory . '/*.sql') ?: [];
    sort($paths, SORT_STRING);

    $files = [];

    foreach ($paths as $path) {
        $migration = basename($path);

        if (preg_match('/^\d{8}_\d{4}_[a-z0-9_]+\.sql$/', $migration) !== 1) {
            continue;
        }

        $contents = file_get_contents($path);

        if ($contents === false) {
            json_error('Migration file could not be read.', 500, null, [
                'migration' => [
                    'filename' => $migration,
                ],
            ]);
        }

        $files[] = [
            'migration' => $migration,
            'path' => $path,
            'contents' => $contents,
            'checksum' => hash('sha256', $contents),
        ];
    }

    return $files;
}

function migration_directory(): string
{
    return __DIR__ . '/migrations';
}

function apply_migration_file(array $file): void
{
    $migration = (string) $file['migration'];
    $checksum = (string) $file['checksum'];
    $statements = migration_sql_statements((string) $file['contents']);

    try {
        db()->beginTransaction();

        foreach ($statements as $statement) {
            db()->exec($statement);
        }

        db_query(
            'INSERT INTO schema_migrations (migration, checksum)
             VALUES (:migration, :checksum)',
            [
                'migration' => $migration,
                'checksum' => $checksum,
            ]
        );

        if (db()->inTransaction()) {
            db()->commit();
        }
    } catch (Throwable $exception) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }

        json_error('Migration failed.', 500, $exception, [
            'migration' => [
                'filename' => $migration,
            ],
        ]);
    }
}

function migration_sql_statements(string $sql): array
{
    $sql = preg_replace('/^\xEF\xBB\xBF/', '', $sql) ?? $sql;
    $statements = [];
    $buffer = '';
    $length = strlen($sql);
    $quote = null;

    for ($index = 0; $index < $length; $index++) {
        $char = $sql[$index];
        $next = $index + 1 < $length ? $sql[$index + 1] : '';

        if ($quote !== null) {
            $buffer .= $char;

            if ($char === '\\' && $quote !== '`' && $index + 1 < $length) {
                $index++;
                $buffer .= $sql[$index];
                continue;
            }

            if ($char === $quote) {
                $quote = null;
            }

            continue;
        }

        if ($char === "'" || $char === '"' || $char === '`') {
            $quote = $char;
            $buffer .= $char;
            continue;
        }

        if ($char === '-' && $next === '-' && migration_comment_follows($sql, $index + 2)) {
            $index = migration_skip_to_line_end($sql, $index + 2);
            $buffer .= "\n";
            continue;
        }

        if ($char === '#') {
            $index = migration_skip_to_line_end($sql, $index + 1);
            $buffer .= "\n";
            continue;
        }

        if ($char === '/' && $next === '*') {
            $end = strpos($sql, '*/', $index + 2);
            $index = $end === false ? $length : $end + 1;
            $buffer .= ' ';
            continue;
        }

        if ($char === ';') {
            $statement = trim($buffer);

            if ($statement !== '') {
                $statements[] = $statement;
            }

            $buffer = '';
            continue;
        }

        $buffer .= $char;
    }

    $statement = trim($buffer);

    if ($statement !== '') {
        $statements[] = $statement;
    }

    return $statements;
}

function migration_comment_follows(string $sql, int $index): bool
{
    if ($index >= strlen($sql)) {
        return true;
    }

    return preg_match('/\s/', $sql[$index]) === 1;
}

function migration_skip_to_line_end(string $sql, int $index): int
{
    $newline = strpos($sql, "\n", $index);

    return $newline === false ? strlen($sql) : $newline;
}
