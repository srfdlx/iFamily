const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const RECURRENCE_RULES = ['taeglich', 'woechentlich', 'monatlich'];
const REMIND_MODES = ['fest', 'vorlauf'];

function computeRemindAt({ dueAt, remindMode, remindAt, remindLeadMinutes }) {
  if (remindMode === 'fest') {
    return remindAt ? new Date(remindAt) : null;
  }
  if (remindMode === 'vorlauf') {
    if (!dueAt || !remindLeadMinutes) return null;
    return new Date(new Date(dueAt).getTime() - remindLeadMinutes * 60 * 1000);
  }
  return null;
}

function addInterval(date, rule, interval) {
  const next = new Date(date);
  if (rule === 'taeglich') next.setDate(next.getDate() + interval);
  else if (rule === 'woechentlich') next.setDate(next.getDate() + interval * 7);
  else if (rule === 'monatlich') next.setMonth(next.getMonth() + interval);
  return next;
}

function readTaskInput(body) {
  const remindMode = REMIND_MODES.includes(body.remindMode) ? body.remindMode : null;
  const recurrenceRule = RECURRENCE_RULES.includes(body.recurrenceRule) ? body.recurrenceRule : null;
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  const remindLeadMinutes = body.remindLeadMinutes ? Number(body.remindLeadMinutes) : null;
  const remindAtInput = body.remindAt ? new Date(body.remindAt) : null;

  return {
    title: String(body.title || '').trim(),
    notes: body.notes ? String(body.notes).trim() : null,
    assignedTo: body.assignedTo ? Number(body.assignedTo) : null,
    dueAt,
    remindMode,
    remindLeadMinutes,
    remindAt: computeRemindAt({ dueAt, remindMode, remindAt: remindAtInput, remindLeadMinutes }),
    recurrenceRule,
    recurrenceInterval: Number(body.recurrenceInterval) || 1
  };
}

router.get('/', async (req, res) => {
  const status = req.query.status === 'erledigt' ? 'erledigt' : req.query.status === 'offen' ? 'offen' : null;
  const assignedTo = req.query.assignedTo === 'me' ? req.user.id : null;

  const conditions = ['family_id = ?'];
  const params = [req.user.familyId];
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (assignedTo) {
    conditions.push('assigned_to = ?');
    params.push(assignedTo);
  }

  const [rows] = await db.query(
    `SELECT id, title, notes, created_by, assigned_to, status, due_at, remind_mode, remind_at,
            remind_lead_minutes, recurrence_rule, recurrence_interval, completed_at, created_at
     FROM tasks WHERE ${conditions.join(' AND ')}
     ORDER BY (due_at IS NULL), due_at ASC, created_at DESC`,
    params
  );
  res.json({ tasks: rows });
});

router.post('/', async (req, res) => {
  const input = readTaskInput(req.body);
  if (!input.title) {
    return res.status(400).json({ error: 'Titel darf nicht leer sein.' });
  }

  const [result] = await db.query(
    `INSERT INTO tasks
      (family_id, title, notes, created_by, assigned_to, due_at, remind_mode, remind_at, remind_lead_minutes, recurrence_rule, recurrence_interval)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.familyId,
      input.title,
      input.notes,
      req.user.id,
      input.assignedTo,
      input.dueAt,
      input.remindMode,
      input.remindAt,
      input.remindLeadMinutes,
      input.recurrenceRule,
      input.recurrenceInterval
    ]
  );
  res.status(201).json({ id: result.insertId });
});

router.patch('/:id', async (req, res) => {
  const [existingRows] = await db.query('SELECT * FROM tasks WHERE id = ? AND family_id = ?', [
    req.params.id,
    req.user.familyId
  ]);
  const existing = existingRows[0];
  if (!existing) {
    return res.status(404).json({ error: 'Aufgabe nicht gefunden.' });
  }

  const becomingDone = req.body.status === 'erledigt' && existing.status !== 'erledigt';
  const fields = [];
  const params = [];

  if (req.body.title !== undefined) {
    fields.push('title = ?');
    params.push(String(req.body.title).trim());
  }
  if (req.body.notes !== undefined) {
    fields.push('notes = ?');
    params.push(req.body.notes ? String(req.body.notes).trim() : null);
  }
  if (req.body.assignedTo !== undefined) {
    fields.push('assigned_to = ?');
    params.push(req.body.assignedTo ? Number(req.body.assignedTo) : null);
  }
  if (req.body.status !== undefined) {
    fields.push('status = ?');
    params.push(req.body.status === 'erledigt' ? 'erledigt' : 'offen');
    fields.push('completed_at = ?');
    params.push(req.body.status === 'erledigt' ? new Date() : null);
  }
  if (req.body.dueAt !== undefined || req.body.remindMode !== undefined || req.body.remindAt !== undefined || req.body.remindLeadMinutes !== undefined) {
    const merged = readTaskInput({
      dueAt: req.body.dueAt !== undefined ? req.body.dueAt : existing.due_at,
      remindMode: req.body.remindMode !== undefined ? req.body.remindMode : existing.remind_mode,
      remindAt: req.body.remindAt !== undefined ? req.body.remindAt : existing.remind_at,
      remindLeadMinutes: req.body.remindLeadMinutes !== undefined ? req.body.remindLeadMinutes : existing.remind_lead_minutes,
      title: existing.title,
      recurrenceRule: existing.recurrence_rule,
      recurrenceInterval: existing.recurrence_interval
    });
    fields.push('due_at = ?', 'remind_mode = ?', 'remind_at = ?', 'remind_lead_minutes = ?', 'reminder_sent_at = NULL');
    params.push(merged.dueAt, merged.remindMode, merged.remindAt, merged.remindLeadMinutes);
  }
  if (req.body.recurrenceRule !== undefined) {
    fields.push('recurrence_rule = ?');
    params.push(RECURRENCE_RULES.includes(req.body.recurrenceRule) ? req.body.recurrenceRule : null);
  }
  if (req.body.recurrenceInterval !== undefined) {
    fields.push('recurrence_interval = ?');
    params.push(Number(req.body.recurrenceInterval) || 1);
  }

  if (fields.length) {
    params.push(existing.id);
    await db.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  if (becomingDone && existing.recurrence_rule) {
    const baseDate = existing.due_at ? new Date(existing.due_at) : new Date();
    const nextDueAt = addInterval(baseDate, existing.recurrence_rule, existing.recurrence_interval);
    const nextRemindAt = existing.remind_at
      ? addInterval(new Date(existing.remind_at), existing.recurrence_rule, existing.recurrence_interval)
      : null;
    await db.query(
      `INSERT INTO tasks
        (family_id, title, notes, created_by, assigned_to, due_at, remind_mode, remind_at, remind_lead_minutes, recurrence_rule, recurrence_interval, parent_task_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        existing.family_id,
        existing.title,
        existing.notes,
        existing.created_by,
        existing.assigned_to,
        existing.due_at ? nextDueAt : null,
        existing.remind_mode,
        nextRemindAt,
        existing.remind_lead_minutes,
        existing.recurrence_rule,
        existing.recurrence_interval,
        existing.id
      ]
    );
  }

  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM tasks WHERE id = ? AND family_id = ?', [req.params.id, req.user.familyId]);
  res.json({ ok: true });
});

module.exports = router;
