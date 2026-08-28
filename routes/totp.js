/**
 * routes/totp.js
 * TOTP (Time-based OTP) setup, verification, and disable.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
authenticator.options = { window: [1, 1] };
const qrcode = require('qrcode');
const db = require('../database');
const { authenticateJWT, verifyElevationOrPassword } = require('../middleware/auth');

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
        if (!user || !user.totp_pending_secret) return res.status(400).json({ success: false, message: '请先生成 TOTP 设置' });
        const decryptedSecret = decrypt(user.totp_pending_secret);
        let verifyOk = false;
        if (decryptedSecret) {
            try {
                verifyOk = authenticator.verify({ token: req.body.token, secret: decryptedSecret });
            } catch (e) {}
        }
        if (verifyOk) {
            db.run(
                'UPDATE users SET totp_secret = ?, totp_pending_secret = "", two_fa_method = ? WHERE id = ?',
                [user.totp_pending_secret, 'totp', req.user.id],
                (dbErr) => {
                    if (dbErr) return res.status(500).json({ success: false, message: '数据库错误' });
                    return res.json({ success: true });
                }
            );
            return;
        }
        res.status(400).json({ success: false, message: '动态验证码无效，请重试' });
    });
});

/* ── POST /api/totp/disable ── */
router.post('/disable', authenticateJWT, async (req, res) => {
    const { currentPassword, totpToken } = req.body;
    const decrypt = req.app.locals.decrypt;
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!(await verifyElevationOrPassword(req, res, currentPassword))) return;
        if (user.totp_secret) {
            const decryptedSecret = decrypt(user.totp_secret);
            let verifyOk = false;
            if (decryptedSecret && totpToken) {
                try {
                    verifyOk = authenticator.verify({ token: totpToken, secret: decryptedSecret });
                } catch(e) {}
            }
            if (!verifyOk)
                return res.status(401).json({ success: false, message: '验证码错误，请输入当前的 6 位验证码' });
        }
        db.run('UPDATE users SET totp_secret = NULL, two_fa_method = NULL WHERE id = ?', [req.user.id], (e) => {
            if (e) return res.status(500).json({ success: false, message: 'Database error' });
            res.json({ success: true });
        });
    });
});

module.exports = router;
