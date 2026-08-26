/**
 * routes/totp.js
 * TOTP (Time-based OTP) setup, verification, and disable.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const db = require('../database');
const { authenticateJWT, verifyPassword } = require('../middleware/auth');

/* ── GET /api/totp/generate ── */
router.get('/generate', authenticateJWT, (req, res) => {
    const RP_NAME = req.app.get('RP_NAME');
    const encrypt = req.app.locals.encrypt;
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.user, RP_NAME, secret);
    db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [encrypt(secret), req.user.id], () => {
        qrcode.toDataURL(otpauth, (err, imageUrl) => res.json({ secret, qr: imageUrl }));
    });
});

/* ── POST /api/totp/verify ── (finalise TOTP setup) */
router.post('/verify', authenticateJWT, (req, res) => {
    const decrypt = req.app.locals.decrypt;
    db.get('SELECT totp_pending_secret, two_fa_method FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (!user || !user.totp_pending_secret)
            return res.status(400).json({ success: false, message: 'No pending TOTP setup' });
        if (authenticator.verify({ token: req.body.token, secret: decrypt(user.totp_pending_secret) })) {
            db.run(
                'UPDATE users SET totp_secret = ?, totp_pending_secret = "", two_fa_method = ? WHERE id = ?',
                [user.totp_pending_secret, 'totp', req.user.id]
            );
            return res.json({ success: true });
        }
        res.status(400).json({ success: false, message: 'Invalid token' });
    });
});

/* ── POST /api/totp/disable ── */
router.post('/disable', authenticateJWT, async (req, res) => {
    const { currentPassword, totpToken } = req.body;
    const decrypt = req.app.locals.decrypt;
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!await verifyPassword(currentPassword || '', user.password, user.id))
            return res.status(401).json({ success: false, message: '当前密码错误' });
        if (user.totp_secret) {
            if (!totpToken || !authenticator.verify({ token: totpToken, secret: decrypt(user.totp_secret) }))
                return res.status(401).json({ success: false, message: '验证码错误，请输入当前的 6 位验证码' });
        }
        db.run('UPDATE users SET totp_secret = NULL, two_fa_method = NULL WHERE id = ?', [req.user.id], (e) => {
            if (e) return res.status(500).json({ success: false, message: 'Database error' });
            res.json({ success: true });
        });
    });
});

module.exports = router;
