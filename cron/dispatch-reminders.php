<?php
declare(strict_types=1);

// Ueber Plesk "Geplante Aufgaben" aufrufen, am besten jede Minute ("* * * * *"):
//   /usr/bin/php /pfad/zu/ifamily/cron/dispatch-reminders.php
// Je groesser der Abstand, desto spaeter kommen Erinnerungen an - bei einem
// 5-Minuten-Takt bis zu 5 Minuten nach der eingestellten Zeit.

require_once __DIR__ . '/../public/api/bootstrap.php';

// PHP-Zeit statt SQL NOW() verwenden: so entscheidet immer dieselbe, explizit
// auf Europe/Zurich gesetzte Uhr (siehe bootstrap.php) - unabhaengig davon,
// in welcher Zeitzone der Datenbankserver selbst laeuft.
$now = (new DateTimeImmutable())->format('Y-m-d H:i:s');

// Auch Aufgaben, die jemand schon angefangen hat ("in Arbeit"), brauchen ihre
// Erinnerung - nur wirklich erledigte nicht.
$stmt = $db->prepare(
    "SELECT id, family_id, title, assigned_to, due_at
     FROM tasks
     WHERE status <> 'erledigt' AND remind_at IS NOT NULL AND remind_at <= ? AND reminder_sent_at IS NULL"
);
$stmt->execute([$now]);
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

    $db->prepare('UPDATE tasks SET reminder_sent_at = ? WHERE id = ?')->execute([$now, $task['id']]);
}

echo 'Verarbeitet: ' . count($dueTasks) . " Erinnerung(en)\n";
