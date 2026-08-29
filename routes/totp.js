/**
 * routes/totp.js
 * TOTP (Time-based OTP) setup, verification, and disable.
 */
'use strict';

const express = require('express');
const router = express.Router();
const TotpService = require('../services/totpService');
const AuthService = require('../services/authService');
const db = require('../core/database');
const { authenticateJWT } = require('../middleware/auth');

/* ── GET /api/totp/generate ── */
router.get('/generate', authenticateJWT, async (req, res) => {
    try {
        const RP_NAME = req.app.get('RP_NAME');
        const data = await TotpService.generate(req.user.id, req.user.user, RP_NAME);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ── POST /api/totp/verify ── (finalise TOTP setup) */
router.post('/verify', authenticateJWT, async (req, res) => {
    try {
        const success = await TotpService.verifyAndActivate(req.user.id, req.body.token);
        if (success) {
            return res.json({ success: true });
        }
        res.status(400).json({ success: false, message: '动态验证码无效，请重试' });
    } catch (e) {
        res.status(400).json({ success: false, message: e.message });
    }
});

/* ── POST /api/totp/disable ── */
router.post('/disable', authenticateJWT, async (req, res) => {
    const { currentPassword, totpToken } = req.body;
    if (!(await AuthService.verifyElevationOrPassword(req, res, currentPassword))) return;

    try {
        const user = await db.get('SELECT totp_secret FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

        if (user.totp_secret) {
            const valid = TotpService.verifyToken(user.totp_secret, totpToken);
            if (!valid) {
                return res.status(401).json({ success: false, message: '验证码错误，请输入当前的 6 位验证码' });
            }
        }

        await TotpService.disable(req.user.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

module.exports = router;
