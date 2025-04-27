const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email provider
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password' // Use App Password, not your main password
  }
});

function sendMedicationReminder(to, subject, text) {
  const mailOptions = {
    from: 'your-email@gmail.com',
    to,
    subject,
    text
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendMedicationReminder };
