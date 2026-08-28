<?php
declare(strict_types=1);

const RECURRENCE_RULES = ['taeglich', 'woechentlich', 'monatlich'];
const REMIND_MODES = ['fest', 'vorlauf'];
const TASK_STATUSES = ['offen', 'in_arbeit', 'erledigt'];

function normalize_datetime(?string $value): ?string
{
    if (!$value) {
        return null;
    }
    try {
        return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        return null;
    }
}

function compute_remind_at(?string $dueAt, ?string $remindMode, ?string $remindAt, ?int $remindLeadMinutes): ?string
{
    if ($remindMode === 'fest') {
        return $remindAt ? normalize_datetime($remindAt) : null;
    }
    if ($remindMode === 'vorlauf') {
        if (!$dueAt || !$remindLeadMinutes) {
            return null;
        }
        return (new DateTimeImmutable($dueAt))->sub(new DateInterval('PT' . $remindLeadMinutes . 'M'))->format('Y-m-d H:i:s');
    }
    return null;
}

function add_interval(string $date, string $rule, int $interval): string
{
    $dt = new DateTimeImmutable($date);
    if ($rule === 'taeglich') {
        $dt = $dt->modify("+{$interval} day");
    } elseif ($rule === 'woechentlich') {
        $dt = $dt->modify('+' . ($interval * 7) . ' day');
    } elseif ($rule === 'monatlich') {
        $dt = $dt->modify("+{$interval} month");
    }
    return $dt->format('Y-m-d H:i:s');
}

function read_task_input(array $body): array
{
    $remindMode = in_array($body['remindMode'] ?? null, REMIND_MODES, true) ? $body['remindMode'] : null;
    $recurrenceRule = in_array($body['recurrenceRule'] ?? null, RECURRENCE_RULES, true) ? $body['recurrenceRule'] : null;
    $dueAt = !empty($body['dueAt']) ? normalize_datetime((string) $body['dueAt']) : null;
    $remindLeadMinutes = !empty($body['remindLeadMinutes']) ? (int) $body['remindLeadMinutes'] : null;
    $remindAtInput = !empty($body['remindAt']) ? (string) $body['remindAt'] : null;

    return [
        'title' => trim((string) ($body['title'] ?? '')),
        'notes' => !empty($body['notes']) ? trim((string) $body['notes']) : null,
        'assignedTo' => !empty($body['assignedTo']) ? (int) $body['assignedTo'] : null,
        'dueAt' => $dueAt,
        'remindMode' => $remindMode,
        'remindLeadMinutes' => $remindLeadMinutes,
        'remindAt' => compute_remind_at($dueAt, $remindMode, $remindAtInput, $remindLeadMinutes),
        'recurrenceRule' => $recurrenceRule,
        'recurrenceInterval' => !empty($body['recurrenceInterval']) ? (int) $body['recurrenceInterval'] : 1,
    ];
}

function tasks_list(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $status = $_GET['status'] ?? null;
    $status = in_array($status, TASK_STATUSES, true) ? $status : null;
    $assignedToMe = ($_GET['assignedTo'] ?? null) === 'me';

    $conditions = ['family_id = ?'];
    $bind = [$user['familyId']];
    if ($status) {
        $conditions[] = 'status = ?';
        $bind[] = $status;
    }
    if ($assignedToMe) {
        $conditions[] = 'assigned_to = ?';
        $bind[] = $user['id'];
    }

    $stmt = $db->prepare(
        'SELECT id, title, notes, created_by, assigned_to, status, started_at, started_by, due_at,
                remind_mode, remind_at, remind_lead_minutes, recurrence_rule, recurrence_interval,
                completed_at, created_at
         FROM tasks WHERE ' . implode(' AND ', $conditions) . '
         ORDER BY (due_at IS NULL), due_at ASC, created_at DESC'
    );
    $stmt->execute($bind);
    json_response(['tasks' => $stmt->fetchAll()]);
}

function tasks_create(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $input = read_task_input(json_body());
    if ($input['title'] === '') {
        json_response(['error' => 'Titel darf nicht leer sein.'], 400);
    }

    $stmt = $db->prepare(
        'INSERT INTO tasks
            (family_id, title, notes, created_by, assigned_to, due_at, remind_mode, remind_at, remind_lead_minutes, recurrence_rule, recurrence_interval)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $user['familyId'], $input['title'], $input['notes'], $user['id'], $input['assignedTo'],
        $input['dueAt'], $input['remindMode'], $input['remindAt'], $input['remindLeadMinutes'],
        $input['recurrenceRule'], $input['recurrenceInterval'],
    ]);
    json_response(['id' => (int) $db->lastInsertId()], 201);
}

function tasks_update(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $taskId = (int) $params[0];

    $stmt = $db->prepare('SELECT * FROM tasks WHERE id = ? AND family_id = ?');
    $stmt->execute([$taskId, $user['familyId']]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_response(['error' => 'Aufgabe nicht gefunden.'], 404);
    }

    $body = json_body();
    $becomingDone = ($body['status'] ?? null) === 'erledigt' && $existing['status'] !== 'erledigt';

    $fields = [];
    $bind = [];

    if (array_key_exists('title', $body)) {
        $fields[] = 'title = ?';
        $bind[] = trim((string) $body['title']);
    }
    if (array_key_exists('notes', $body)) {
        $fields[] = 'notes = ?';
        $bind[] = $body['notes'] ? trim((string) $body['notes']) : null;
    }
    if (array_key_exists('assignedTo', $body)) {
        $fields[] = 'assigned_to = ?';
        $bind[] = $body['assignedTo'] ? (int) $body['assignedTo'] : null;
    }
    if (array_key_exists('status', $body)) {
        $newStatus = in_array($body['status'], TASK_STATUSES, true) ? $body['status'] : 'offen';
        $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');

        $fields[] = 'status = ?';
        $bind[] = $newStatus;
        $fields[] = 'completed_at = ?';
        $bind[] = $newStatus === 'erledigt' ? $now : null;

        // "In Arbeit" haelt fest, wer das Thema uebernommen hat - damit sieht
        // die Familie, dass sich schon jemand darum kuemmert.
        if ($newStatus === 'in_arbeit') {
            if ($existing['status'] !== 'in_arbeit') {
                $fields[] = 'started_at = ?';
                $bind[] = $now;
                $fields[] = 'started_by = ?';
                $bind[] = $user['id'];
            }
        } elseif ($newStatus === 'offen') {
            $fields[] = 'started_at = NULL';
            $fields[] = 'started_by = NULL';
        }
    }
    if (
        array_key_exists('dueAt', $body) || array_key_exists('remindMode', $body)
        || array_key_exists('remindAt', $body) || array_key_exists('remindLeadMinutes', $body)
    ) {
        $merged = read_task_input([
            'dueAt' => array_key_exists('dueAt', $body) ? $body['dueAt'] : $existing['due_at'],
            'remindMode' => array_key_exists('remindMode', $body) ? $body['remindMode'] : $existing['remind_mode'],
            'remindAt' => array_key_exists('remindAt', $body) ? $body['remindAt'] : $existing['remind_at'],
            'remindLeadMinutes' => array_key_exists('remindLeadMinutes', $body) ? $body['remindLeadMinutes'] : $existing['remind_lead_minutes'],
        ]);
        $fields[] = 'due_at = ?';
        $bind[] = $merged['dueAt'];
        $fields[] = 'remind_mode = ?';
        $bind[] = $merged['remindMode'];
        $fields[] = 'remind_at = ?';
        $bind[] = $merged['remindAt'];
        $fields[] = 'remind_lead_minutes = ?';
        $bind[] = $merged['remindLeadMinutes'];
        $fields[] = 'reminder_sent_at = NULL';
    }
    if (array_key_exists('recurrenceRule', $body)) {
        $fields[] = 'recurrence_rule = ?';
        $bind[] = in_array($body['recurrenceRule'], RECURRENCE_RULES, true) ? $body['recurrenceRule'] : null;
    }
    if (array_key_exists('recurrenceInterval', $body)) {
        $fields[] = 'recurrence_interval = ?';
        $bind[] = (int) ($body['recurrenceInterval'] ?: 1);
    }

    if ($fields) {
        $bind[] = $taskId;
        $db->prepare('UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($bind);
    }

    if ($becomingDone && $existing['recurrence_rule']) {
        $baseDate = $existing['due_at'] ?? (new DateTimeImmutable())->format('Y-m-d H:i:s');
        $interval = (int) $existing['recurrence_interval'];
        $nextDueAt = add_interval($baseDate, $existing['recurrence_rule'], $interval);
        $nextRemindAt = $existing['remind_at'] ? add_interval($existing['remind_at'], $existing['recurrence_rule'], $interval) : null;

        $db->prepare(
            'INSERT INTO tasks
                (family_id, title, notes, created_by, assigned_to, due_at, remind_mode, remind_at, remind_lead_minutes, recurrence_rule, recurrence_interval, parent_task_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $existing['family_id'], $existing['title'], $existing['notes'], $existing['created_by'], $existing['assigned_to'],
            $existing['due_at'] ? $nextDueAt : null, $existing['remind_mode'], $nextRemindAt, $existing['remind_lead_minutes'],
            $existing['recurrence_rule'], $interval, $existing['id'],
        ]);
    }

    json_response(['ok' => true]);
}

function tasks_delete(PDO $db, array $config, array $params): void
{
    $user = require_auth($db);
    $db->prepare('DELETE FROM tasks WHERE id = ? AND family_id = ?')->execute([(int) $params[0], $user['familyId']]);
    json_response(['ok' => true]);
}
