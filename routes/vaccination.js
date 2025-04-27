const express = require('express');
const router = express.Router();
const db = require('../db');

// Render vaccination page
router.get('/:accountId', (req, res) => {
  const accountId = req.params.accountId;
  const userId = req.session.userId || 1; // Default for testing if session is missing

  const query = `
    SELECT vaccine_name, recommended_week 
    FROM vaccination_records 
    WHERE account_id = ? AND user_id = ? AND status = 'done'
  `;

  db.query(query, [accountId, userId], (err, results) => {
    if (err) {
      console.error('Fetch error:', err);
      return res.status(500).send("Database error while fetching marked vaccines");
    }

    const markedVaccines = {};
    results.forEach(row => {
      markedVaccines[`${row.vaccine_name}|${row.recommended_week}`] = true;
    });

    res.render('vaccination', {
      accountId,
      userId,
      markedVaccines
    });
  });
});

// Save selected vaccines
router.post('/save', (req, res) => {
  const { vaccines, accountId } = req.body;
  const userId = req.session.userId || 1;
  const today = new Date();

  if (!vaccines || !Array.isArray(vaccines)) {
    return res.status(400).send("Invalid vaccine data");
  }

  const values = vaccines.map((item) => {
    const [vaccineName, recommendedWeek] = item.split("|||");
    return [userId, accountId, vaccineName, recommendedWeek, today, 'done'];
  });

  const query = `
    INSERT INTO vaccination_records 
    (user_id, account_id, vaccine_name, recommended_week, marked_date, status)
    VALUES ?
    ON DUPLICATE KEY UPDATE 
      status='done', marked_date=VALUES(marked_date)
  `;

  db.query(query, [values], (err) => {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).send("Database error");
    }
    res.redirect(`/${accountId}/vaccinations`);
  });
});

module.exports = router;
