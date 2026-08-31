<?php
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');
date_default_timezone_set('Europe/Zurich');

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/push.php';
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/family.php';
require_once __DIR__ . '/routes/tasks.php';
require_once __DIR__ . '/routes/lists.php';
require_once __DIR__ . '/routes/push.php';
require_once __DIR__ . '/routes/sync.php';

$config = require __DIR__ . '/config.php';
$db = get_db($config);
