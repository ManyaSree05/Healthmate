// routes/allRoutes.js
module.exports = (app, db) => {
    const bcrypt = require('bcrypt');
    const multer = require('multer');
    const fs = require('fs');
    const { sendReminders, sendMedicationReminders } = require('../ReminderCron');
    





  
    function calculateAgeAndCategory(dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      let category = "self";
      if (age <= 16) category = "child";
      else if (age >= 60) category = "elder";
      return { age, category };
    }
  
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        const dir = 'uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
      },
      filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
      }
    });
    const upload = multer({ storage: storage });
  

    app.get('/', (req, res) => {
      res.render('welcome'); // Make sure you have welcome.ejs inside your "views" folder
    });
    app.get('/about', (req, res) => {
      res.render('about');
    });
    app.get('/register', (req, res) => res.render('register'));
  
    app.post('/register', async (req, res) => {
      try {
        const { username, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed]);
        res.redirect('/login');
      } catch (err) {
        console.error('Error inserting user:', err);
        res.send('Registration failed');
      }
    });
  
    app.get('/login', (req, res) => res.render('login'));
  
    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (results.length === 0) return res.send('No user found');
        const match = await bcrypt.compare(password, results[0].password);
        if (match) {
          req.session.user = results[0];
          res.redirect('/accounts');
        } else {
          res.send('Incorrect password');
        }
      } catch (err) {
        console.error('Login error:', err);
        res.send('Login failed');
      }
    });
  
    app.get('/logout', (req, res) => {
      req.session.destroy();
      res.redirect('/login');
    });
  
    app.get('/accounts', async (req, res) => {
      if (!req.session.user) return res.redirect('/login');
      try {
        const [results] = await db.query('SELECT * FROM accounts WHERE user_id = ?', [req.session.user.id]);
        res.render('accounts', { accounts: results, user: req.session.user });
      } catch (err) {
        console.error('Fetching accounts failed:', err);
        res.send('Error loading accounts');
      }
    });
  
    app.post('/accounts', async (req, res) => {
      const { name, dob, gender, blood_group } = req.body;
      const { age, category } = calculateAgeAndCategory(dob);
      try {
        await db.query(
          'INSERT INTO accounts (user_id, name, dob, age, gender, category) VALUES (?, ?, ?, ?, ?, ?)',
          [req.session.user.id, name, dob, age, gender, category]
        );
        res.redirect('/accounts');
      } catch (err) {
        console.error('Error adding account:', err);
        res.send('Error creating account');
      }
    });
  
    app.get('/accounts/:id', async (req, res) => {
      const accId = req.params.id;
      try {
        const [results] = await db.query('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accId, req.session.user.id]);
        if (results.length === 0) return res.send("Unauthorized or invalid account");
        const account = results[0];
        res.render('account_dashboard', { account });
      } catch (err) {
        console.error('Error loading account dashboard:', err);
        res.send('Account not found');
      }
    });
    const methodOverride = require('method-override');
    app.use(methodOverride('_method'));
    app.delete('/accounts/:id', async (req, res) => {
      const accountId = req.params.id;
    
      try {
        // Optionally: delete dependent data like medications, health records, etc.
        await db.query('DELETE FROM current_medications WHERE account_id = ?', [accountId]);
        await db.query('DELETE FROM basic_health WHERE account_id = ?', [accountId]);
        await db.query('DELETE FROM special_conditions WHERE account_id = ?', [accountId]);
        await db.query('DELETE FROM baby_vaccination_schedule WHERE account_id = ?', [accountId]);
        await db.query('DELETE FROM documents WHERE account_id = ?', [accountId]);
        await db.query('DELETE FROM vaccination_records WHERE account_id = ?', [accountId]);
        await db.query('DELETE FROM accounts WHERE id = ?', [accountId]);
    
        res.redirect('/accounts');
      } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).send('Error deleting account');
      }
    });
    
  
    app.get('/accounts/:id/documents', async (req, res) => {
      const accountId = req.params.id;
      try {
        const [docs] = await db.query('SELECT * FROM documents WHERE account_id = ?', [accountId]);
        res.render('upload_documents', { accountId, docs });
      } catch (err) {
        console.error('Fetching documents failed:', err);
        res.send('Could not load documents');
      }
    });
  
    app.post('/accounts/:id/documents', upload.single('document'), async (req, res) => {
      const accountId = req.params.id;
      const file = req.file;
      if (!file) return res.send('No file uploaded.');
      try {
        await db.query('INSERT INTO documents (account_id, file_name) VALUES (?, ?)', [accountId, file.filename]);
        res.redirect(`/accounts/${accountId}/documents`);
      } catch (err) {
        console.error('Document upload failed:', err);
        res.send('Upload error');
      }
    });
  
    app.get('/accounts/:id/self-tracker', async (req, res) => {
      const accountId = req.params.id;
      const [results] = await db.query('SELECT * FROM self_tracker WHERE account_id = ? ORDER BY created_at DESC', [accountId]);
      res.render('self_tracker', { accountId, entries: results });
    });
  
    app.post('/accounts/:id/self-tracker', async (req, res) => {
      const accountId = req.params.id;
      const { exercise, duration, meditation, sleep, screen_time, notes } = req.body;
      await db.query(`INSERT INTO self_tracker (account_id, exercise, duration, meditation, sleep, screen_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [accountId, exercise, duration, meditation, sleep, screen_time, notes]);
      res.redirect(`/accounts/${accountId}/self-tracker`);
    });

        // BASIC INFO
    app.get('/accounts/:id/basic_info', async (req, res) => {
      const accId = req.params.id;
      const [[acc]] = await db.query('SELECT * FROM accounts WHERE id = ?', [accId]);
      const [history] = await db.query(
        'SELECT * FROM basic_health WHERE account_id = ? ORDER BY created_at DESC',
        [accId]
      );
      res.render('basic_info', { acc, history });
    });

    app.post('/accounts/:id/basic_info', async (req, res) => {
      const accId = req.params.id;
      const { bp, sugar, height_cm, weight_kg, blood_group, allergies, eyesight } = req.body;

      await db.query(
        `INSERT INTO basic_health (account_id, bp, sugar, height_cm, weight_kg, blood_group, allergies, eyesight) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [accId, bp, sugar, height_cm, weight_kg, blood_group, allergies, eyesight]
      );

      res.redirect(`/accounts/${accId}`);
    });


    // SPECIAL CONDITIONS
    app.get('/accounts/:id/special_conditions', async (req, res) => {
      const accId = req.params.id;
      const [[acc]] = await db.query('SELECT * FROM accounts WHERE id = ?', [accId]);
      const [history] = await db.query(
        'SELECT * FROM special_conditions WHERE account_id = ? ORDER BY diagnosed_on DESC',
        [accId]
      );
      res.render('special_conditions', { acc, history });
    });

    app.post('/accounts/:id/special_conditions', async (req, res) => {
      const accId = req.params.id;
      const { condition1, description, diagnosed_on } = req.body;

      await db.query(
        'INSERT INTO special_conditions (account_id, condition1, description, diagnosed_on) VALUES (?, ?, ?, ?)',
        [accId, condition1, description, diagnosed_on]
      );

      res.redirect(`/accounts/${accId}`);
    });


    // MEDICATIONS
    app.get('/accounts/:id/medications', async (req, res) => {
      const accId = req.params.id;
      const [[acc]] = await db.query('SELECT * FROM accounts WHERE id = ?', [accId]);
      const [history] = await db.query(
        'SELECT * FROM current_medications WHERE account_id = ? ORDER BY reminder_date DESC, reminder_time DESC',
        [accId]
      );
      res.render('medications_reminders', { acc, history });
    });

    app.post('/accounts/:id/medications', async (req, res) => {
      const accId = req.params.id;
      const { medication_name, dosage, frequency, reminder_date, reminder_time, notify_by } = req.body;

      await db.query(
        'INSERT INTO current_medications (account_id, medication_name, dosage, frequency, reminder_date, reminder_time, notify_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [accId, medication_name, dosage, frequency, reminder_date, reminder_time, notify_by]
      );

      res.redirect(`/accounts/${accId}`);
    });

      
        
    app.get('/baby/:id/vaccination-schedule', async (req, res) => {
      const accountId = req.params.id;
      try {
        const [results] = await db.query(`
          SELECT vaccine_name, scheduled_week AS week_due, is_taken AS status
          FROM baby_vaccination_schedule
          WHERE account_id = ?
        `, [accountId]);
        console.log("✅ Records sent to EJS:", results);
        res.render("vaccination_schedule", { accountId, records: results });
      } catch (err) {
        console.error("❌ DB error:", err);
        res.status(500).send("Error loading vaccine schedule");
      }
    });
  
    app.post('/mark-vaccine', async (req, res) => {
      const { accountId, vaccineName, weekDue, status } = req.body;
      try {
        const [results] = await db.query(
          'SELECT * FROM vaccination_records WHERE account_id = ? AND vaccine_name = ? AND week_due = ?',
          [accountId, vaccineName, weekDue]
        );
        if (results.length > 0) {
          await db.query('UPDATE vaccination_records SET status = ?, taken_at = NOW() WHERE id = ?', [status, results[0].id]);
        } else {
          await db.query('INSERT INTO vaccination_records (account_id, vaccine_name, week_due, status, taken_at) VALUES (?, ?, ?, ?, NOW())', [accountId, vaccineName, weekDue, status]);
        }
        res.json({ success: true });
      } catch (err) {
        console.error('Vaccination update error:', err);
        res.status(500).json({ success: false, message: 'Query failed' });
      }
    });
  
    function calculateDueDate(dob, weekDue) {
      const date = new Date(dob);
      const match = weekDue.match(/^(\d+)(\.\d+)? (weeks|months|years)$/);
      if (!match) return null;
      const num = parseFloat(match[1] + (match[2] || ''));
      const unit = match[3];
      if (unit === 'weeks') date.setDate(date.getDate() + num * 7);
      else if (unit === 'months') date.setMonth(date.getMonth() + num);
      else if (unit === 'years') date.setFullYear(date.getFullYear() + num);
      return date.toISOString().split('T')[0];
    }
    app.post('/baby/save-vaccines', async (req, res) => {
      const { accountId, vaccines } = req.body;
      if (!accountId || !Array.isArray(vaccines)) {
        return res.status(400).send("Invalid request data");
      }
    
      try {
        const [dobResults] = await db.query('SELECT dob FROM accounts WHERE id = ?', [accountId]);
        if (dobResults.length === 0) return res.status(404).send("DOB not found");
        const dob = dobResults[0].dob;
    
        for (const vaccine of vaccines) {
          const { vaccineName, weekDue, status } = vaccine;
          const dueDate = calculateDueDate(dob, weekDue);
          const isTaken = status === 'taken';
          const takenOn = isTaken ? new Date() : null;
    
          const [existing] = await db.query(
            'SELECT * FROM baby_vaccination_schedule WHERE account_id = ? AND vaccine_name = ? AND scheduled_week = ?',
            [accountId, vaccineName, weekDue]
          );
    
          if (existing.length > 0) {
            await db.query(`
              UPDATE baby_vaccination_schedule 
              SET is_taken = ?, taken_on = ?, due_date = ?, reminder_sent = FALSE 
              WHERE account_id = ? AND vaccine_name = ? AND scheduled_week = ?
            `, [isTaken, takenOn, dueDate, accountId, vaccineName, weekDue]);
          } else {
            
            await db.query(`
              INSERT INTO baby_vaccination_schedule 
              (account_id, vaccine_name, scheduled_week, is_taken, taken_on, due_date) 
              VALUES (?, ?, ?, ?, ?, ?)
            `, [accountId, vaccineName, weekDue, isTaken, takenOn, dueDate]);
          }
        }
    
        res.status(200).send("Saved successfully");
      } catch (err) {
        console.error("❌ Error saving vaccines:", err);
        res.status(500).send("Database error");
      }
    });
    
    app.get('/backfill-due-dates', async (req, res) => {
      const [records] = await db.query(`
        SELECT bvs.id, bvs.scheduled_week, a.dob
        FROM baby_vaccination_schedule bvs
        JOIN accounts a ON bvs.account_id = a.id
        WHERE bvs.due_date IS NULL
      `);
    
      const calculateDueDate = (dob, weekDue) => {
        const date = new Date(dob);
        const match = weekDue.match(/^(\d+)(\.\d+)? (weeks|months|years)$/);
        if (!match) return null;
        const num = parseFloat(match[1] + (match[2] || ''));
        const unit = match[3];
        if (unit === 'weeks') date.setDate(date.getDate() + num * 7);
        else if (unit === 'months') date.setMonth(date.getMonth() + num);
        else if (unit === 'years') date.setFullYear(date.getFullYear() + num);
        return date.toISOString().split('T')[0];
      };
    
      for (const record of records) {
        const dueDate = calculateDueDate(record.dob, record.scheduled_week);
        await db.query(`UPDATE baby_vaccination_schedule SET due_date = ? WHERE id = ?`, [dueDate, record.id]);
      }
    
      res.send(`✅ Backfilled ${records.length} records with due_date`);
    });
    
    app.get('/baby/pending-vaccines/:accountId', async (req, res) => {
  const accountId = req.params.accountId;

  try {
    const [results] = await db.query(`
      SELECT 
        v.vaccine_name,
        v.week_due,
        DATE_ADD(a.dob, INTERVAL CAST(SUBSTRING_INDEX(v.week_due, ' ', 1) AS UNSIGNED) WEEK) AS due_date,
        IFNULL(bvs.is_taken, 0) AS is_taken,
        bvs.taken_on
      FROM vaccinations v
      JOIN accounts a ON a.id = ?
      LEFT JOIN baby_vaccination_schedule bvs 
        ON bvs.account_id = a.id 
        AND bvs.vaccine_name = v.vaccine_name
      WHERE (bvs.is_taken = 0 OR bvs.is_taken IS NULL)
    `, [accountId]);

    res.json(results);
  } catch (err) {
    console.error("❌ Error fetching pending vaccines:", err);
    res.status(500).send("Database error");
  }
});



    
    
    app.get('/test-reminders', async (req, res) => {
        await sendReminders();
        res.send('✅ Manual reminder check triggered');
    });
    app.get('/test-medications', async (req, res) => {
        await sendMedicationReminders();
        res.send('✅ Manual medication reminder check triggered');
      });
  
  };


