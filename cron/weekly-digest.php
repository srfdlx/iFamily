<?php
declare(strict_types=1);

// Wochenueberblick per Mail. Ueber Plesk "Geplante Aufgaben" einmal pro Woche
// aufrufen, z. B. montags um 07:00 (Cron-Stil: 0 7 * * 1):
//   /pfad/zu/ifamily/cron/weekly-digest.php
//
// Der Merker digest_sent_at verhindert, dass ein zusaetzlicher Lauf am selben
// Tag eine zweite Mail ausloest.

require_once __DIR__ . '/../public/api/bootstrap.php';

$now = new DateTimeImmutable();
$cutoff = $now->modify('-6 days')->format('Y-m-d H:i:s');

$users = $db->prepare(
    'SELECT id, family_id, email, display_name
     FROM users
     WHERE digest_sent_at IS NULL OR digest_sent_at < ?
     ORDER BY id'
);
$users->execute([$cutoff]);

$openTasks = $db->prepare(
    "SELECT id, title, status, priority, due_at, assigned_to
     FROM tasks
     WHERE family_id = ? AND status <> 'erledigt'
     ORDER BY (due_at IS NULL), due_at, priority"
);

$sent = 0;
$skipped = 0;

foreach ($users->fetchAll() as $user) {
    $openTasks->execute([$user['family_id']]);
    $tasks = $openTasks->fetchAll();

    $mine = array_values(array_filter($tasks, fn($t) => (int) $t['assigned_to'] === (int) $user['id']));
    $unowned = array_values(array_filter($tasks, fn($t) => $t['assigned_to'] === null));

    if (!$mine && !$unowned) {
        // Nichts offen - dann auch keine Mail, aber Zeitpunkt merken,
        // damit die naechste Woche wieder sauber startet.
        $db->prepare('UPDATE users SET digest_sent_at = ? WHERE id = ?')
            ->execute([$now->format('Y-m-d H:i:s'), $user['id']]);
        $skipped++;
        continue;
    }

    try {
        send_weekly_digest($user['email'], $user['display_name'], $mine, $unowned, $config);
        $db->prepare('UPDATE users SET digest_sent_at = ? WHERE id = ?')
            ->execute([$now->format('Y-m-d H:i:s'), $user['id']]);
        $sent++;
    } catch (Throwable $e) {
        // Fehlschlag nicht als verschickt markieren, damit der naechste Lauf es erneut versucht.
        error_log('[digest] Versand an ' . $user['email'] . ' fehlgeschlagen: ' . $e->getMessage());
    }
}

echo "Wochenueberblick: $sent verschickt, $skipped ohne offene Aufgaben\n";
