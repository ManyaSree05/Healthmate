const cron = require('node-cron');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Daddy#123',
  database: 'healthmate'
});

// Vaccine Reminder Function
// Vaccine Reminder Function
async function sendReminders() {
  const today = dayjs();

  try {
    const [records] = await pool.query(`
      SELECT 
        v.vaccine_name,
        v.scheduled_week,
        a.dob,
        DATE_ADD(a.dob, INTERVAL CAST(SUBSTRING_INDEX(v.scheduled_week, ' ', 1) AS UNSIGNED) 
                  * CASE 
                      WHEN v.scheduled_week LIKE '%week%' THEN 7
                      WHEN v.scheduled_week LIKE '%month%' THEN 30
                      WHEN v.scheduled_week LIKE '%year%' THEN 365
                    END DAY) AS due_date,
        IFNULL(bvs.is_taken, 0) AS is_taken,
        bvs.reminder_sent,
        u.email,
        a.name AS child_name,
        a.id AS account_id
      FROM vaccinations v
      JOIN accounts a ON a.category = 'child'
      JOIN users u ON a.user_id = u.id
      LEFT JOIN baby_vaccination_schedule bvs 
        ON bvs.account_id = a.id 
        AND bvs.vaccine_name = v.vaccine_name
      WHERE (bvs.is_taken = 0 OR bvs.is_taken IS NULL)
        AND (
          DATE_ADD(a.dob, INTERVAL CAST(SUBSTRING_INDEX(v.scheduled_week, ' ', 1) AS UNSIGNED) 
              * CASE 
                  WHEN v.scheduled_week LIKE '%week%' THEN 7
                  WHEN v.scheduled_week LIKE '%month%' THEN 30
                  WHEN v.scheduled_week LIKE '%year%' THEN 365
                END DAY
          ) BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        )
    `);

    console.log(`🔍 Found ${records.length} unmarked vaccination records.`);

    for (let record of records) {
      const dueDate = dayjs(record.due_date);
      if (dueDate.isAfter(today.add(7, 'day'))) continue; // Not in the range

      // if (record.reminder_sent==1) {
      //   console.log(`⏩ Skipping ${record.vaccine_name} - reminder already sent.`);
      //   continue;
      // }

      const mailOptions = {
        from: process.env.EMAIL_USER || 'reddykaruna978@gmail.com',
        to: record.email,
        subject: `Reminder: ${record.vaccine_name} is due for ${record.child_name}`,
        text: `Hello,\n\nThis is a reminder that ${record.child_name} is due for ${record.vaccine_name} on ${record.due_date}.\n\nPlease mark it as "Taken" in the HealthMate app.\n\nStay healthy!`
      };

      try {
        await transporter.sendMail(mailOptions);

        await pool.query(`
          INSERT INTO baby_vaccination_schedule (account_id, vaccine_name, scheduled_week, is_taken, due_date, reminder_sent)
          VALUES (?, ?, ?, 0, ?, 1)
          ON DUPLICATE KEY UPDATE reminder_sent = 1
        `, [record.account_id, record.vaccine_name, record.scheduled_week, record.due_date]);

        console.log(`📧 Sent reminder to ${record.email} for ${record.vaccine_name}`);
      } catch (err) {
        console.error("❌ Email send failed:", err);
      }
    }

  } catch (err) {
    console.error("❌ Reminder job failed:", err);
  }
}


async function sendMedicationReminders() {
  const today = dayjs().format('YYYY-MM-DD');

  try {
    const [medications] = await pool.query(`
      SELECT cm.*, u.email, u.username
      FROM current_medications cm
      JOIN accounts a ON cm.account_id = a.id
      JOIN users u ON a.user_id = u.id
      WHERE cm.reminder_date = ?
        AND cm.reminder_sent = FALSE
    `, [today]);

    console.log(`💊 Found ${medications.length} medications needing reminders today.`);

    for (const med of medications) {
      const mailOptions = {
        from: process.env.EMAIL_USER || 'reddykaruna978@gmail.com',
        to: med.email,
        subject: `Medication Reminder: ${med.medication_name}`,
        text: `Hello ${med.username},\n\nThis is a reminder to take your medication "${med.medication_name}" today at ${med.reminder_time}.\n\nDosage: ${med.dosage}\nFrequency: ${med.frequency}\n\n— HealthMate`
      };

      try {
        await transporter.sendMail(mailOptions);
        await pool.query(`UPDATE current_medications SET reminder_sent = TRUE WHERE id = ?`, [med.id]);
        console.log(`📧 Medication email sent to ${med.email} for ${med.medication_name}`);
      } catch (err) {
        console.error("❌ Error sending medication email:", err);
      }
    }

  } catch (err) {
    console.error("❌ Error querying medications:", err);
  }
}



// Cron Jobs
cron.schedule('0 9 * * *', async () => {
  console.log("⏰ Running daily vaccine reminder cron at 9 AM...");
  await sendReminders();
});

cron.schedule('0 8 * * *', async () => {
  console.log("⏰ Running daily medication reminder cron at 8 AM...");
  await sendMedicationReminders();
});

// Manual test export
module.exports = {
  sendReminders,
  sendMedicationReminders
};
