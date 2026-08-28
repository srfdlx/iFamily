<?php
declare(strict_types=1);

// Ueber Plesk "Geplante Aufgaben" alle 1-5 Minuten aufrufen:
//   /usr/bin/php /pfad/zu/ifamily/cron/dispatch-reminders.php

require_once __DIR__ . '/../public/api/bootstrap.php';

$stmt = $db->prepare(
    "SELECT id, family_id, title, assigned_to, due_at
     FROM tasks
     WHERE status = 'offen' AND remind_at IS NOT NULL AND remind_at <= NOW() AND reminder_sent_at IS NULL"
);
$stmt->execute();
$dueTasks = $stmt->fetchAll();

foreach ($dueTasks as $task) {
    if ($task['assigned_to']) {
        $recipientIds = [(int) $task['assigned_to']];
    } else {
        $memberStmt = $db->prepare('SELECT id FROM users WHERE family_id = ?');
        $memberStmt->execute([$task['family_id']]);
        $recipientIds = array_map('intval', array_column($memberStmt->fetchAll(), 'id'));
    }

    $payload = [
        'title' => 'Zeit für: ' . $task['title'],
        'body' => $task['due_at']
            ? ('Fällig: ' . date('d.m.Y H:i', strtotime($task['due_at'])))
            : 'Erinnerung an deine Aufgabe',
        'taskId' => (int) $task['id'],
    ];

    foreach ($recipientIds as $userId) {
        send_to_user($db, $userId, $payload, $config);
    }

    $db->prepare('UPDATE tasks SET reminder_sent_at = NOW() WHERE id = ?')->execute([$task['id']]);
}

echo 'Verarbeitet: ' . count($dueTasks) . " Erinnerung(en)\n";
