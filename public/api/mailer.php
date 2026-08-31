<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

function parse_from_address(string $from): array
{
    if (preg_match('/^(.*)<(.+)>$/', $from, $m)) {
        return [trim($m[2]), trim($m[1])];
    }
    return [trim($from), ''];
}

/**
 * Baut einen konfigurierten PHPMailer oder null, wenn kein SMTP hinterlegt ist.
 */
function build_mailer(array $config): ?PHPMailer
{
    if (empty($config['smtp']['host'])) {
        return null;
    }

    [$fromEmail, $fromName] = parse_from_address($config['smtp']['from']);

    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = $config['smtp']['host'];
    $mail->Port = $config['smtp']['port'];
    $mail->CharSet = 'UTF-8';
    if ($config['smtp']['user'] !== '') {
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp']['user'];
        $mail->Password = $config['smtp']['password'];
    }
    $mail->SMTPSecure = $config['smtp']['secure'] ? 'ssl' : 'tls';
    $mail->setFrom($fromEmail, $fromName);
    $mail->isHTML(true);
    return $mail;
}

/**
 * Wochenueberblick mit den offenen Aufgaben einer Person.
 *
 * @param array $mine    Aufgaben, die dieser Person zugewiesen sind
 * @param array $unowned Offene Aufgaben ohne Zuweisung
 */
function send_weekly_digest(string $email, string $name, array $mine, array $unowned, array $config): void
{
    $line = function (array $task): string {
        $bits = [];
        if ($task['due_at']) {
            $bits[] = 'fällig ' . date('d.m.Y H:i', strtotime($task['due_at']));
        }
        if ($task['priority'] === 'hoch') {
            $bits[] = 'hohe Priorität';
        }
        if ($task['status'] === 'in_arbeit') {
            $bits[] = 'in Arbeit';
        }
        return htmlspecialchars($task['title']) . ($bits ? ' <span style="color:#64748b">(' . implode(', ', $bits) . ')</span>' : '');
    };

    $section = function (string $title, array $tasks) use ($line): string {
        if (!$tasks) {
            return '';
        }
        return "<h3 style=\"margin:20px 0 8px\">$title</h3><ul style=\"padding-left:18px; margin:0\">"
            . implode('', array_map(fn($t) => '<li style="margin-bottom:6px">' . $line($t) . '</li>', $tasks))
            . '</ul>';
    };

    $total = count($mine) + count($unowned);
    $url = rtrim($config['appUrl'], '/');

    $html = '<p>Hallo ' . htmlspecialchars($name) . '!</p>'
        . '<p>Dein Wochenüberblick: <strong>' . $total . ' offene ' . ($total === 1 ? 'Aufgabe' : 'Aufgaben') . '</strong>.</p>'
        . $section('Dir zugewiesen (' . count($mine) . ')', $mine)
        . $section('Noch niemandem zugewiesen (' . count($unowned) . ')', $unowned)
        . '<p style="margin-top:22px"><a href="' . htmlspecialchars($url) . '">In iFamily öffnen</a></p>';

    $text = "Hallo $name!\n\nDein Wochenüberblick: $total offene Aufgabe(n).\n\n";
    foreach (['Dir zugewiesen' => $mine, 'Noch niemandem zugewiesen' => $unowned] as $title => $tasks) {
        if (!$tasks) {
            continue;
        }
        $text .= "$title:\n";
        foreach ($tasks as $task) {
            $text .= '- ' . $task['title'] . ($task['due_at'] ? ' (fällig ' . date('d.m.Y H:i', strtotime($task['due_at'])) . ')' : '') . "\n";
        }
        $text .= "\n";
    }
    $text .= "In iFamily öffnen: $url\n";

    $mail = build_mailer($config);
    if (!$mail) {
        error_log("[mailer] SMTP nicht konfiguriert. Wochenueberblick fuer $email:\n$text");
        return;
    }

    $mail->addAddress($email);
    $mail->Subject = 'iFamily: ' . $total . ' offene ' . ($total === 1 ? 'Aufgabe' : 'Aufgaben');
    $mail->Body = $html;
    $mail->AltBody = $text;
    $mail->send();
}

function send_magic_link(string $email, string $link, string $code, array $config): void
{
    if (empty($config['smtp']['host'])) {
        error_log("[mailer] SMTP nicht konfiguriert. Magic-Link fuer $email: $link (Code: $code)");
        return;
    }

    $mail = build_mailer($config);
    $mail->addAddress($email);
    $mail->Subject = 'Dein Anmeldecode für iFamily: ' . $code;
    $mail->Body = '<p>Hallo!</p>'
        . '<p>Dein Anmeldecode für <strong>iFamily</strong>:</p>'
        . '<p style="font-size:32px; font-weight:bold; letter-spacing:6px; margin:16px 0;">' . htmlspecialchars($code) . '</p>'
        . '<p>Gib diesen Code direkt in der iFamily-App ein. <strong>Wenn du die App auf dem Home-Bildschirm hast, nutze den Code – nicht den Link:</strong> '
        . 'der Link öffnet den Browser, und dort bist du dann getrennt von der App angemeldet.</p>'
        . '<p>Alternativ (z. B. am Computer) kannst du diesen Link verwenden:<br>'
        . '<a href="' . htmlspecialchars($link) . '">' . htmlspecialchars($link) . '</a></p>'
        . '<p>Code und Link sind ' . $config['magicLinkTtlMinutes'] . ' Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.</p>';
    $mail->AltBody = "Hallo!\n\nDein Anmeldecode für iFamily: $code\n\n"
        . "Gib diesen Code direkt in der iFamily-App ein. Wenn du die App auf dem Home-Bildschirm hast, "
        . "nutze den Code - nicht den Link: der Link oeffnet den Browser, und dort bist du dann getrennt von der App angemeldet.\n\n"
        . "Alternativ (z. B. am Computer) kannst du diesen Link verwenden:\n$link\n\n"
        . "Code und Link sind {$config['magicLinkTtlMinutes']} Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.";

    $mail->send();
}
