console.log("⏰ Medication reminder cron job loaded");

const cron = require('node-cron');
const db = require('../db');
const { sendMedicationReminder } = require('../mailer');
const { sendSMS } = require('../sms');

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);

  const [reminders] = await db.query(
    `SELECT m.*, u.email, u.phone_number
     FROM current_medications m
     JOIN user u ON m.user_id = u.id
     WHERE m.reminder_date = ? AND m.reminder_time = ? AND u.receive_notifications = 1`,
    [date, time]
  );

  for (let reminder of reminders) {
    const message = `Reminder: Take ${reminder.medication} (${reminder.dosage})`;

    if (reminder.notify_by === 'email' || reminder.notify_by === 'both') {
      await sendMedicationReminder(reminder.email, 'Medication Reminder', message);
    }
    if (reminder.notify_by === 'sms' || reminder.notify_by === 'both') {
      await sendSMS(reminder.phone_number, message);
    }
  }
});
