<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$route = '/' . trim($_GET['__route'] ?? '', '/');

$routes = [
    ['POST', '#^/auth/request-link$#', 'auth_request_link'],
    ['POST', '#^/auth/verify$#', 'auth_verify'],
    ['POST', '#^/auth/verify-code$#', 'auth_verify_code'],
    ['GET', '#^/auth/me$#', 'auth_me'],

    ['GET', '#^/family$#', 'family_get'],
    ['PATCH', '#^/family$#', 'family_patch'],

    ['GET', '#^/tasks$#', 'tasks_list'],
    ['POST', '#^/tasks$#', 'tasks_create'],
    ['PATCH', '#^/tasks/(\d+)$#', 'tasks_update'],
    ['DELETE', '#^/tasks/(\d+)$#', 'tasks_delete'],
    ['POST', '#^/tasks/(\d+)/items$#', 'tasks_add_item'],
    ['PATCH', '#^/tasks/(\d+)/items/(\d+)$#', 'tasks_update_item'],
    ['DELETE', '#^/tasks/(\d+)/items/(\d+)$#', 'tasks_delete_item'],

    ['GET', '#^/lists$#', 'lists_list'],
    ['POST', '#^/lists$#', 'lists_create'],
    ['DELETE', '#^/lists/(\d+)$#', 'lists_delete'],
    ['POST', '#^/lists/(\d+)/items$#', 'lists_add_item'],
    ['PATCH', '#^/lists/(\d+)/items/(\d+)$#', 'lists_update_item'],
    ['DELETE', '#^/lists/(\d+)/items/(\d+)$#', 'lists_delete_item'],

    ['GET', '#^/sync/version$#', 'sync_version'],

    ['GET', '#^/push/public-key$#', 'push_public_key'],
    ['POST', '#^/push/subscribe$#', 'push_subscribe'],
    ['DELETE', '#^/push/subscribe$#', 'push_unsubscribe'],
];

foreach ($routes as [$expectedMethod, $pattern, $handler]) {
    if ($expectedMethod !== $method) {
        continue;
    }
    if (preg_match($pattern, $route, $matches)) {
        array_shift($matches);
        try {
            $handler($db, $config, array_values($matches));
        } catch (Throwable $e) {
            error_log('[api] ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Serverfehler.']);
        }
        exit;
    }
}

http_response_code(404);
echo json_encode(['error' => 'Nicht gefunden.']);
