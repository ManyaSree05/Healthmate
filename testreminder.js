const nodemailer = require('nodemailer');

// Setup your email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'reddykaruna978@gmail.com',
    pass: 'ajjt ugfm lmgz buwu'  // App password from Google
  }
});

// Sample test data (can be real or dummy)
const mailOptions = {
  from: 'reddykaruna978@gmail.com',
  to: 'srikarunareddy008@gmail.com', // your test email
  subject: 'Test Vaccination Reminder',
  text: `Hello,

This is a test reminder that your child is due for a vaccine (e.g., BCG) on 2025-04-15.

Please log in to HealthMate and mark the vaccine as taken once done.

Thank you!
— HealthMate Team`
};

// Send the email
transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error("❌ Error sending test email:", err);
  } else {
    console.log("✅ Test email sent:", info.response);
  }
});
