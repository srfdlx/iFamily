<?php
declare(strict_types=1);

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

function send_to_user(PDO $db, int $userId, array $payload, array $config): void
{
    if (empty($config['vapid']['publicKey']) || empty($config['vapid']['privateKey'])) {
        error_log('[push] VAPID nicht konfiguriert, ueberspringe Push.');
        return;
    }

    $stmt = $db->prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $subs = $stmt->fetchAll();
    if (!$subs) {
        return;
    }

    $webPush = new WebPush([
        'VAPID' => [
            'subject' => $config['vapid']['subject'],
            'publicKey' => $config['vapid']['publicKey'],
            'privateKey' => $config['vapid']['privateKey'],
        ],
    ]);

    foreach ($subs as $sub) {
        $subscription = Subscription::create([
            'endpoint' => $sub['endpoint'],
            'keys' => ['p256dh' => $sub['p256dh'], 'auth' => $sub['auth']],
        ]);
        $webPush->queueNotification($subscription, json_encode($payload));
    }

    foreach ($webPush->flush() as $report) {
        if ($report->isSuccess()) {
            continue;
        }
        if ($report->isSubscriptionExpired()) {
            $db->prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')->execute([$report->getEndpoint()]);
        } else {
            error_log('[push] Fehler beim Senden: ' . $report->getReason());
        }
    }
}
