const cron = require('node-cron');
const db = require('./db');
const push = require('./push');

async function dispatchDueReminders() {
  const [dueTasks] = await db.query(
    `SELECT id, family_id, title, assigned_to, due_at
     FROM tasks
     WHERE status = 'offen' AND remind_at IS NOT NULL AND remind_at <= NOW() AND reminder_sent_at IS NULL`
  );

  for (const task of dueTasks) {
    let recipientIds = [];
    if (task.assigned_to) {
      recipientIds = [task.assigned_to];
    } else {
      const [members] = await db.query('SELECT id FROM users WHERE family_id = ?', [task.family_id]);
      recipientIds = members.map((m) => m.id);
    }

    const payload = {
      title: 'Zeit für: ' + task.title,
      body: task.due_at ? `Fällig: ${new Date(task.due_at).toLocaleString('de-CH')}` : 'Erinnerung an deine Aufgabe',
      taskId: task.id
    };

    await Promise.all(recipientIds.map((userId) => push.sendToUser(userId, payload)));
    await db.query('UPDATE tasks SET reminder_sent_at = NOW() WHERE id = ?', [task.id]);
  }
}

function start() {
  cron.schedule('* * * * *', () => {
    dispatchDueReminders().catch((err) => console.error('[scheduler] Fehler:', err));
  });
  console.log('[scheduler] Erinnerungs-Job gestartet (jede Minute).');
}

module.exports = { start, dispatchDueReminders };
