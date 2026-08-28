<?php
declare(strict_types=1);

function family_get(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);

    $stmt = $db->prepare('SELECT id, name, invite_code FROM families WHERE id = ?');
    $stmt->execute([$user['familyId']]);
    $family = $stmt->fetch();

    $stmt = $db->prepare('SELECT id, display_name, email FROM users WHERE family_id = ? ORDER BY display_name');
    $stmt->execute([$user['familyId']]);
    $members = $stmt->fetchAll();

    json_response([
        'id' => (int) $family['id'],
        'name' => $family['name'],
        'inviteCode' => $family['invite_code'],
        'members' => $members,
    ]);
}

function family_patch(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $body = json_body();
    $name = trim((string) ($body['name'] ?? ''));
    if ($name === '') {
        json_response(['error' => 'Name darf nicht leer sein.'], 400);
    }
    $db->prepare('UPDATE families SET name = ? WHERE id = ?')->execute([$name, $user['familyId']]);
    json_response(['ok' => true]);
}
