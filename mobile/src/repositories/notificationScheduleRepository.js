const { getAll, getDatabase, run } = require('./database');

function rowToSchedule(row) {
  return {
    signature: row.signature,
    taskId: row.task_id,
    notificationId: row.notification_id,
    type: row.type,
    minutes: Number(row.minutes),
    scheduledAt: row.scheduled_at
  };
}

async function listNotificationSchedules() {
  const db = await getDatabase();
  const rows = await getAll(
    db,
    `SELECT signature, task_id, notification_id, type, minutes, scheduled_at
       FROM notification_schedules`
  );
  return rows.map(rowToSchedule);
}

async function replaceNotificationSchedules(schedules) {
  const db = await getDatabase();
  await run(db, 'DELETE FROM notification_schedules');
  for (const schedule of schedules) {
    await run(
      db,
      `INSERT INTO notification_schedules
        (signature, task_id, notification_id, type, minutes, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        schedule.signature,
        schedule.taskId,
        schedule.notificationId,
        schedule.type,
        schedule.minutes,
        schedule.scheduledAt
      ]
    );
  }
}

async function deleteSchedulesForTask(taskId) {
  const db = await getDatabase();
  await run(db, 'DELETE FROM notification_schedules WHERE task_id = ?', [taskId]);
}

module.exports = {
  deleteSchedulesForTask,
  listNotificationSchedules,
  replaceNotificationSchedules
};
