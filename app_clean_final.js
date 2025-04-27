
const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const babyDashboardRoutes = require('./routes/baby_dashboard');
const vaccinationRoutes = require('./routes/vaccination');

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'partials/layout');

let db;

(async () => {
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Daddy#123',
      database: 'healthmate'
    });
    console.log("MySQL connected ✅");

    app.locals.db = db;

    // Middleware and routes setup
    require('./routes/allroutes')(app, db); // load routes from another file for cleaner structure

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

    // Load cron jobs
    require('./cron/medicationReminder');
    require('./ReminderCron');

  } catch (err) {
    console.error("MySQL connection failed:", err);
  }
})();
