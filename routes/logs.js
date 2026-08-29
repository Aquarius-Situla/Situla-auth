/**
 * routes/logs.js
 * Login logs retrieval via AuditService.
 */
'use strict';

const express = require('express');
const router = express.Router();
const AuditService = require('../services/auditService');
const { authenticateJWT } = require('../middleware/auth');

router.get('/login-logs', authenticateJWT, async (req, res) => {
    try {
        const rows = await AuditService.getRecentLogs(req.user.id, 20);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
