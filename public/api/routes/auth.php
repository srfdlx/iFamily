<?php
declare(strict_types=1);

function auth_request_link(PDO $db, array $config, array $params): void
{
    $body = json_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $displayName = trim((string) ($body['displayName'] ?? ''));
    $inviteCode = strtoupper(trim((string) ($body['inviteCode'] ?? '')));

    if ($email === '' || !str_contains($email, '@')) {
        json_response(['error' => 'Bitte eine gültige E-Mail-Adresse angeben.'], 400);
    }

    $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $userId = $stmt->fetchColumn();

    if (!$userId) {
        if ($displayName === '') {
            json_response(['error' => 'Bitte einen Namen angeben.'], 400);
        }

        if ($inviteCode !== '') {
            $stmt = $db->prepare('SELECT id FROM families WHERE invite_code = ?');
            $stmt->execute([$inviteCode]);
            $familyId = $stmt->fetchColumn();
            if (!$familyId) {
                json_response(['error' => 'Einladungscode ungültig.'], 400);
            }
        } else {
            $stmt = $db->prepare('INSERT INTO families (name, invite_code) VALUES (?, ?)');
            $stmt->execute(["Familie $displayName", random_invite_code()]);
            $familyId = (int) $db->lastInsertId();
        }

        $stmt = $db->prepare('INSERT INTO users (family_id, email, display_name) VALUES (?, ?, ?)');
        $stmt->execute([$familyId, $email, $displayName]);
        $userId = (int) $db->lastInsertId();
    }

    $credentials = create_magic_link($db, (int) $userId, $config);
    $link = rtrim($config['appUrl'], '/') . '/auth/verify.html?token=' . urlencode($credentials['token']);
    send_magic_link($email, $link, $credentials['code'], $config);

    json_response(['ok' => true]);
}

function auth_verify_code(PDO $db, array $config, array $params): void
{
    $body = json_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $code = preg_replace('/\D/', '', (string) ($body['code'] ?? ''));

    if ($email === '' || strlen((string) $code) !== 6) {
        json_response(['error' => 'Bitte den sechsstelligen Code aus der E-Mail eingeben.'], 400);
    }

    $userId = consume_login_code($db, $email, (string) $code);
    if (!$userId) {
        json_response(['error' => 'Code ist falsch oder abgelaufen. Fordere einen neuen an.'], 400);
    }

    json_response(build_session_response($db, $userId, $config));
}

function build_session_response(PDO $db, int $userId, array $config): array
{
    $sessionToken = create_session($db, $userId, $config);
    $stmt = $db->prepare('SELECT id, family_id, email, display_name FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    return [
        'sessionToken' => $sessionToken,
        'user' => [
            'id' => (int) $user['id'],
            'familyId' => (int) $user['family_id'],
            'email' => $user['email'],
            'displayName' => $user['display_name'],
        ],
    ];
}

function auth_verify(PDO $db, array $config, array $params): void
{
    $body = json_body();
    $token = (string) ($body['token'] ?? '');
    $userId = consume_magic_link($db, $token);
    if (!$userId) {
        json_response(['error' => 'Link ist ungültig oder abgelaufen.'], 400);
    }

    json_response(build_session_response($db, $userId, $config));
}

function auth_me(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    json_response(['user' => $user]);
}
