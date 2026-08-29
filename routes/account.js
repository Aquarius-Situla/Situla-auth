/**
 * routes/account.js
 * Account management: username, email, password, and status.
 */
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const AccountService = require('../services/accountService');
const AuthService = require('../services/authService');
const { authenticateJWT } = require('../middleware/auth');

const sudoLimiter = (req, res, next) => {
    const limiter = req.app.get('sudoLimiter');
    if (limiter) return limiter(req, res, next);
    next();
};

/* ── GET /api/status ── */
router.get('/status', authenticateJWT, async (req, res) => {
    let elevated = false;
    const elevationToken = req.cookies['situla_elevation'];
    if (elevationToken) {
        try {
            const decoded = jwt.verify(elevationToken, req.app.get('JWT_SECRET'));
            if (decoded.id === req.user.id && decoded.elevated) {
                elevated = true;
            }
        } catch (e) {}
    }

    try {
        const status = await AccountService.getAccountStatus(req.user.id, req.user.user, elevated);
        res.json(status);
    } catch (err) {
        console.error('[Status Error]:', err.message);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/* ── POST /api/change-username ── */
router.post('/change-username', authenticateJWT, sudoLimiter, async (req, res) => {
    const { newUsername, currentPassword } = req.body;
    if (!(await AuthService.verifyElevationOrPassword(req, res, currentPassword))) return;

    try {
        await AccountService.changeUsername(req.user.id, newUsername);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

/* ── POST /api/change-password ── */
router.post('/change-password', authenticateJWT, sudoLimiter, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!(await AuthService.verifyElevationOrPassword(req, res, currentPassword))) return;

    try {
        await AccountService.changePassword(req.user.id, newPassword);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

/* ── POST /api/change-email ── */
router.post('/change-email', authenticateJWT, sudoLimiter, async (req, res) => {
    const { newEmail, currentPassword } = req.body;
    if (!(await AuthService.verifyElevationOrPassword(req, res, currentPassword))) return;

    try {
        await AccountService.changeEmail(req.user.id, newEmail);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;
