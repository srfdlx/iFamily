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

function send_magic_link(string $email, string $link, string $code, array $config): void
{
    if (empty($config['smtp']['host'])) {
        error_log("[mailer] SMTP nicht konfiguriert. Magic-Link fuer $email: $link (Code: $code)");
        return;
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
    $mail->addAddress($email);
    $mail->Subject = 'Dein Anmeldecode für iFamily: ' . $code;
    $mail->isHTML(true);
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
