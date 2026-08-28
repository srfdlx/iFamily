<?php
declare(strict_types=1);

function json_body(): array
{
    static $cached = null;
    if ($cached === null) {
        $decoded = json_decode(file_get_contents('php://input'), true);
        $cached = is_array($decoded) ? $decoded : [];
    }
    return $cached;
}

function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function get_authorization_header(): string
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return $_SERVER['HTTP_AUTHORIZATION'];
    }
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                return $value;
            }
        }
    }
    return '';
}
