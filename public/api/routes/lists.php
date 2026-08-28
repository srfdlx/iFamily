<?php
declare(strict_types=1);

function assert_list_in_family(PDO $db, int $listId, int $familyId): bool
{
    $stmt = $db->prepare('SELECT id FROM lists WHERE id = ? AND family_id = ?');
    $stmt->execute([$listId, $familyId]);
    return (bool) $stmt->fetchColumn();
}

function lists_list(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);

    $stmt = $db->prepare('SELECT id, name, created_by, created_at FROM lists WHERE family_id = ? ORDER BY created_at');
    $stmt->execute([$user['familyId']]);
    $lists = $stmt->fetchAll();

    $stmt = $db->prepare(
        'SELECT li.id, li.list_id, li.text, li.checked, li.added_by, li.created_at
         FROM list_items li JOIN lists l ON l.id = li.list_id
         WHERE l.family_id = ? ORDER BY li.created_at'
    );
    $stmt->execute([$user['familyId']]);
    $items = $stmt->fetchAll();

    $itemsByList = [];
    foreach ($items as $item) {
        $itemsByList[$item['list_id']][] = $item;
    }
    foreach ($lists as &$list) {
        $list['items'] = $itemsByList[$list['id']] ?? [];
    }
    unset($list);

    json_response(['lists' => $lists]);
}

function lists_create(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $name = trim((string) (json_body()['name'] ?? ''));
    if ($name === '') {
        json_response(['error' => 'Name darf nicht leer sein.'], 400);
    }
    $db->prepare('INSERT INTO lists (family_id, name, created_by) VALUES (?, ?, ?)')
        ->execute([$user['familyId'], $name, $user['id']]);
    json_response(['id' => (int) $db->lastInsertId()], 201);
}

function lists_delete(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $db->prepare('DELETE FROM lists WHERE id = ? AND family_id = ?')->execute([(int) $params[0], $user['familyId']]);
    json_response(['ok' => true]);
}

function lists_add_item(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $listId = (int) $params[0];
    if (!assert_list_in_family($db, $listId, $user['familyId'])) {
        json_response(['error' => 'Liste nicht gefunden.'], 404);
    }
    $text = trim((string) (json_body()['text'] ?? ''));
    if ($text === '') {
        json_response(['error' => 'Text darf nicht leer sein.'], 400);
    }
    $db->prepare('INSERT INTO list_items (list_id, text, added_by) VALUES (?, ?, ?)')
        ->execute([$listId, $text, $user['id']]);
    json_response(['id' => (int) $db->lastInsertId()], 201);
}

function lists_update_item(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $listId = (int) $params[0];
    $itemId = (int) $params[1];
    if (!assert_list_in_family($db, $listId, $user['familyId'])) {
        json_response(['error' => 'Liste nicht gefunden.'], 404);
    }

    $body = json_body();
    $fields = [];
    $bind = [];
    if (array_key_exists('text', $body)) {
        $fields[] = 'text = ?';
        $bind[] = trim((string) $body['text']);
    }
    if (array_key_exists('checked', $body)) {
        $fields[] = 'checked = ?';
        $bind[] = !empty($body['checked']) ? 1 : 0;
    }
    if ($fields) {
        $bind[] = $itemId;
        $bind[] = $listId;
        $db->prepare('UPDATE list_items SET ' . implode(', ', $fields) . ' WHERE id = ? AND list_id = ?')->execute($bind);
    }
    json_response(['ok' => true]);
}

function lists_delete_item(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $listId = (int) $params[0];
    $itemId = (int) $params[1];
    if (!assert_list_in_family($db, $listId, $user['familyId'])) {
        json_response(['error' => 'Liste nicht gefunden.'], 404);
    }
    $db->prepare('DELETE FROM list_items WHERE id = ? AND list_id = ?')->execute([$itemId, $listId]);
    json_response(['ok' => true]);
}
