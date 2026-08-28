<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

$keys = Minishlink\WebPush\VAPID::createVapidKeys();

echo "VAPID_PUBLIC_KEY={$keys['publicKey']}\n";
echo "VAPID_PRIVATE_KEY={$keys['privateKey']}\n";
