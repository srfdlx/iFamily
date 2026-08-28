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

function send_magic_link(string $email, string $link, array $config): void
{
    if (empty($config['smtp']['host'])) {
        error_log("[mailer] SMTP nicht konfiguriert. Magic-Link fuer $email: $link");
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
    $mail->Subject = 'Dein Login-Link für iFamily';
    $mail->isHTML(true);
    $mail->Body = '<p>Hallo!</p><p>Mit diesem Link kannst du dich bei <strong>iFamily</strong> anmelden:</p>'
        . '<p><a href="' . htmlspecialchars($link) . '">' . htmlspecialchars($link) . '</a></p>'
        . '<p>Der Link ist ' . $config['magicLinkTtlMinutes'] . ' Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.</p>';
    $mail->AltBody = "Hallo!\n\nMit diesem Link kannst du dich bei iFamily anmelden:\n$link\n\n"
        . "Der Link ist {$config['magicLinkTtlMinutes']} Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.";

    $mail->send();
}
