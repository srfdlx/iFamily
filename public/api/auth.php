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

function random_login_code(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

/**
 * Erzeugt Link-Token und sechsstelligen Code fuer denselben Anmeldeversuch.
 * Der Code ist noetig, weil auf iOS der Link aus der Mail in Safari oeffnet,
 * die installierte Homescreen-App aber einen eigenen Speicher hat.
 *
 * @return array{token: string, code: string}
 */
function create_magic_link(PDO $db, int $userId, array $config): array
{
    $token = random_token();
    $code = random_login_code();
    $expiresAt = (new DateTimeImmutable("+{$config['magicLinkTtlMinutes']} minutes"))->format('Y-m-d H:i:s');
    $stmt = $db->prepare('INSERT INTO magic_links (user_id, token_hash, code_hash, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$userId, hash_token($token), hash_token($code), $expiresAt]);
    return ['token' => $token, 'code' => $code];
}

const MAX_CODE_ATTEMPTS = 5;

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

/**
 * Loest den sechsstelligen Code ein. Immer an eine E-Mail-Adresse gebunden und
 * mit begrenzter Versuchszahl, damit sechs Ziffern nicht durchprobiert werden koennen.
 */
function consume_login_code(PDO $db, string $email, string $code): ?int
{
    $stmt = $db->prepare(
        'SELECT ml.id, ml.user_id, ml.code_hash, ml.attempts, ml.expires_at, ml.used_at
         FROM magic_links ml JOIN users u ON u.id = ml.user_id
         WHERE u.email = ? AND ml.code_hash IS NOT NULL AND ml.used_at IS NULL AND ml.expires_at >= NOW()
         ORDER BY ml.id DESC LIMIT 1'
    );
    $stmt->execute([$email]);
    $link = $stmt->fetch();
    if (!$link || (int) $link['attempts'] >= MAX_CODE_ATTEMPTS) {
        return null;
    }

    if (!hash_equals($link['code_hash'], hash_token($code))) {
        $db->prepare('UPDATE magic_links SET attempts = attempts + 1 WHERE id = ?')->execute([$link['id']]);
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
