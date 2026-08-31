<?php
declare(strict_types=1);

require_once __DIR__ . '/env.php';
load_env(__DIR__ . '/../../.env');

/**
 * Zugelassene Nutzer aus ALLOWED_USERS lesen.
 * Format: "mail@example.ch:Anzeigename, zweite@example.ch:Name"
 * Der Anzeigename ist optional, sonst wird der Teil vor dem @ verwendet.
 */
function parse_allowed_users(string $raw): array
{
    $users = [];
    foreach (explode(',', $raw) as $entry) {
        $entry = trim($entry);
        if ($entry === '') {
            continue;
        }
        [$email, $name] = array_pad(explode(':', $entry, 2), 2, '');
        $email = strtolower(trim($email));
        if ($email === '') {
            continue;
        }
        $name = trim($name);
        $users[$email] = $name !== '' ? $name : ucfirst(explode('@', $email)[0]);
    }
    return $users;
}

return [
    'appUrl' => getenv('APP_URL') ?: 'http://localhost',
    'allowedUsers' => parse_allowed_users((string) (getenv('ALLOWED_USERS') ?: '')),

    'db' => [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'user' => getenv('DB_USER') ?: 'ifamily',
        'password' => getenv('DB_PASSWORD') ?: '',
        'database' => getenv('DB_NAME') ?: 'ifamily',
    ],

    'sessionTtlDays' => (int) (getenv('SESSION_TTL_DAYS') ?: 90),
    'magicLinkTtlMinutes' => (int) (getenv('MAGIC_LINK_TTL_MINUTES') ?: 15),

    'smtp' => [
        'host' => getenv('SMTP_HOST') ?: '',
        'port' => (int) (getenv('SMTP_PORT') ?: 587),
        'secure' => getenv('SMTP_SECURE') === 'true',
        'user' => getenv('SMTP_USER') ?: '',
        'password' => getenv('SMTP_PASSWORD') ?: '',
        'from' => getenv('MAIL_FROM') ?: 'iFamily <noreply@example.ch>',
    ],

    'vapid' => [
        'publicKey' => getenv('VAPID_PUBLIC_KEY') ?: '',
        'privateKey' => getenv('VAPID_PRIVATE_KEY') ?: '',
        'subject' => getenv('VAPID_SUBJECT') ?: 'mailto:noreply@example.ch',
    ],
];
