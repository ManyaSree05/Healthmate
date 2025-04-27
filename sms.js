const twilio = require('twilio');

// Use environment variables for security
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

function sendSMS(to, body) {
  return client.messages.create({
    body,
    from: fromNumber,
    to
  });
}

module.exports = { sendSMS };
