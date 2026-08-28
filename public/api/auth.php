<?php
declare(strict_types=1);

function random_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function hash_token(string $token): string
{
    return hash('sha256', $token);
}

function random_invite_code(): string
{
    $raw = rtrim(strtr(base64_encode(random_bytes(6)), '+/', '-_'), '=');
    $alnum = preg_replace('/[^a-zA-Z0-9]/', '', $raw);
    return strtoupper(substr($alnum, 0, 8));
}

function create_magic_link(PDO $db, int $userId, array $config): string
{
    $token = random_token();
    $expiresAt = (new DateTimeImmutable("+{$config['magicLinkTtlMinutes']} minutes"))->format('Y-m-d H:i:s');
    $stmt = $db->prepare('INSERT INTO magic_links (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, hash_token($token), $expiresAt]);
    return $token;
}

function consume_magic_link(PDO $db, string $token): ?int
{
    $stmt = $db->prepare('SELECT id, user_id, expires_at, used_at FROM magic_links WHERE token_hash = ?');
    $stmt->execute([hash_token($token)]);
    $link = $stmt->fetch();
    if (!$link || $link['used_at'] !== null || strtotime($link['expires_at']) < time()) {
        return null;
    }
    $db->prepare('UPDATE magic_links SET used_at = NOW() WHERE id = ?')->execute([$link['id']]);
    return (int) $link['user_id'];
}

function create_session(PDO $db, int $userId, array $config): string
{
    $token = random_token();
    $expiresAt = (new DateTimeImmutable("+{$config['sessionTtlDays']} days"))->format('Y-m-d H:i:s');
    $stmt = $db->prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)');
    $stmt->execute([$userId, hash_token($token), $expiresAt]);
    return $token;
}

function require_auth(PDO $db): array
{
    $header = get_authorization_header();
    if (!str_starts_with($header, 'Bearer ')) {
        json_response(['error' => 'Nicht angemeldet.'], 401);
    }
    $token = substr($header, 7);
    $stmt = $db->prepare(
        'SELECT s.expires_at, u.id, u.family_id, u.email, u.display_name
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?'
    );
    $stmt->execute([hash_token($token)]);
    $session = $stmt->fetch();
    if (!$session || strtotime($session['expires_at']) < time()) {
        json_response(['error' => 'Sitzung abgelaufen. Bitte erneut anmelden.'], 401);
    }
    return [
        'id' => (int) $session['id'],
        'familyId' => (int) $session['family_id'],
        'email' => $session['email'],
        'displayName' => $session['display_name'],
    ];
}
