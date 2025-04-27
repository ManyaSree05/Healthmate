const express = require('express');
const router = express.Router();
const db = require('../db');

// View Baby Dashboard
router.get('/baby-dashboard/:id', (req, res) => {
  const accountId = req.params.id;

  db.query('SELECT * FROM accounts WHERE id = ?', [accountId], (err, accountResults) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error fetching account details');
    }

    const account = accountResults[0];
    if (!account) {
      return res.status(404).send('Account not found');
    }

    db.query('SELECT * FROM vaccinations WHERE account_id = ?', [accountId], (err, vaccineResults) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error fetching vaccine records');
      }

      res.render('baby_dashboard', {
        accountId: accountId,   // ✅ Send accountId to EJS
        account: account,
        vaccines: vaccineResults
      });
    });
  });
});

// Handle Marking Completed Vaccines
router.post('/baby-dashboard/update-vaccines/:id', (req, res) => {
  const accountId = req.params.id;
  const completed = req.body.completed;

  if (!completed) return res.redirect(`/baby-dashboard/${accountId}`);

  const completedIds = Array.isArray(completed) ? completed : [completed];

  completedIds.forEach(id => {
    db.query(
      'UPDATE vaccinations SET is_completed = 1, completed_on = CURDATE() WHERE id = ?',
      [id],
      (err) => {
        if (err) console.error(`Failed to update vaccine ID ${id}:`, err);
      }
    );
  });

  res.redirect(`/baby-dashboard/${accountId}`);
});

module.exports = router;
