/**
 * routes/logs.js
 * Login logs retrieval.
 */
'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateJWT } = require('../middleware/auth');

router.get('/login-logs', authenticateJWT, (req, res) => {
    db.all('SELECT ip, location, device, created_at FROM login_logs WHERE user_id = ? ORDER BY id DESC LIMIT 20', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

module.exports = router;
