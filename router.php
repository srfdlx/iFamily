<?php
// Nur fuer die lokale Entwicklung mit `php -S`, das (anders als Apache) keine .htaccess liest.
// Auf dem echten Hosting uebernimmt public/.htaccess dieses Routing.
declare(strict_types=1);

$root = __DIR__ . '/public';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = $root . $path;

if ($path !== '/' && file_exists($file) && !is_dir($file)) {
    return false;
}

if (str_starts_with($path, '/api/')) {
    $_GET['__route'] = substr($path, strlen('/api/'));
    require $root . '/api/index.php';
    return true;
}

header('Content-Type: text/html; charset=utf-8');
readfile($root . '/index.html');
return true;
