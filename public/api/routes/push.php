<?php
declare(strict_types=1);

function push_public_key(PDO $db, array $config, array $params): void
{
    json_response(['publicKey' => $config['vapid']['publicKey']]);
}

function push_subscribe(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $body = json_body();
    $endpoint = $body['endpoint'] ?? null;
    $p256dh = $body['keys']['p256dh'] ?? null;
    $auth = $body['keys']['auth'] ?? null;
    if (!$endpoint || !$p256dh || !$auth) {
        json_response(['error' => 'Ungültiges Subscription-Objekt.'], 400);
    }
    $stmt = $db->prepare(
        'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)'
    );
    $stmt->execute([$user['id'], $endpoint, $p256dh, $auth]);
    json_response(['ok' => true], 201);
}

function push_unsubscribe(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $endpoint = json_body()['endpoint'] ?? null;
    if (!$endpoint) {
        json_response(['error' => 'endpoint fehlt.'], 400);
    }
    $db->prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')->execute([$endpoint, $user['id']]);
    json_response(['ok' => true]);
}
