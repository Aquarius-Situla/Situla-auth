/**
 * routes/recovery.js
 * Recovery code generation and status.
 */
'use strict';

const express = require('express');
const router = express.Router();
const RecoveryService = require('../services/recoveryService');
const AuthService = require('../services/authService');
const { authenticateJWT } = require('../middleware/auth');

const sudoLimiter = (req, res, next) => {
    const limiter = req.app.get('sudoLimiter');
    if (limiter) return limiter(req, res, next);
    next();
};

/* ── POST /api/recovery-codes/generate ── */
router.post('/generate', authenticateJWT, sudoLimiter, async (req, res) => {
    if (!(await AuthService.verifyElevationOrPassword(req, res, req.body.currentPassword))) return;

    try {
        const codes = await RecoveryService.generateCodes(req.user.id);
        res.json({ success: true, codes });
    } catch (err) {
        console.error('[Recovery Codes Error]:', err.message);
        res.status(500).json({ success: false, message: 'Failed to generate recovery codes' });
    }
});

/* ── GET /api/recovery-codes/status ── */
router.get('/status', authenticateJWT, async (req, res) => {
    try {
        const status = await RecoveryService.getStatus(req.user.id);
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
