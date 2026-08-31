<?php
declare(strict_types=1);

/**
 * Liefert eine kurze Kennung des aktuellen Datenstands. Das Frontend fragt sie
 * im Sekundentakt ab und laedt die Daten nur nach, wenn sie sich geaendert hat -
 * deutlich guenstiger, als staendig alle Aufgaben zu uebertragen.
 */
function sync_version(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);

    // Fragezeichen statt eines benannten Platzhalters: bei echten Prepared
    // Statements darf derselbe benannte Platzhalter nicht mehrfach vorkommen.
    $sql =
        'SELECT
            (SELECT COUNT(*) FROM tasks WHERE family_id = ?) AS task_count,
            (SELECT COALESCE(MAX(updated_at), "") FROM tasks WHERE family_id = ?) AS task_updated,
            (SELECT COUNT(*) FROM task_items ti JOIN tasks t ON t.id = ti.task_id WHERE t.family_id = ?) AS item_count,
            (SELECT COALESCE(MAX(ti.id), 0) FROM task_items ti JOIN tasks t ON t.id = ti.task_id WHERE t.family_id = ?) AS item_max,
            (SELECT COUNT(*) FROM task_items ti JOIN tasks t ON t.id = ti.task_id WHERE t.family_id = ? AND ti.checked = 1) AS item_checked,
            (SELECT COUNT(*) FROM lists WHERE family_id = ?) AS list_count,
            (SELECT COUNT(*) FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.family_id = ?) AS list_item_count,
            (SELECT COUNT(*) FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.family_id = ? AND li.checked = 1) AS list_item_checked';

    $stmt = $db->prepare($sql);
    $stmt->execute(array_fill(0, substr_count($sql, '?'), $user['familyId']));
    $row = $stmt->fetch();

    json_response(['version' => implode('-', array_values($row))]);
}
