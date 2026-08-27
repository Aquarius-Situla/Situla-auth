/**
 * routes/account.js
 * Account management: username, email, password, status.
 */
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

const db = require('../database');
const { authenticateJWT, verifyElevationOrPassword, SALT_ROUNDS } = require('../middleware/auth');


const jwt = require('jsonwebtoken');

/* ── GET /api/status ── */
router.get('/status', authenticateJWT, (req, res) => {
    let elevated = false;
    const elevationToken = req.cookies['situla_elevation'];
    if (elevationToken) {
        try {
            const decoded = jwt.verify(elevationToken, req.app.get('JWT_SECRET'));
            if (decoded.id === req.user.id && decoded.elevated) elevated = true;
        } catch (e) {}
    }

    db.get('SELECT totp_secret, email, two_fa_method FROM users WHERE id = ?', [req.user.id], (err, user) => {

        if (err) console.error('Status users error:', err);
        db.all('SELECT id, name, created_at, type, transports FROM passkeys WHERE user_id = ? ORDER BY id ASC', [req.user.id], (err2, keys) => {
            if (err2) console.error('Status passkeys error:', err2);
            db.get('SELECT COUNT(*) as total FROM recovery_codes WHERE user_id = ? AND used = 0', [req.user.id], (err3, rc) => {
                if (err3) console.error('Status rc error:', err3);
                const allKeys = keys || [];
                const passkeys = allKeys.filter(k => (k.type || 'passkey') === 'passkey');
                const fido2Keys = allKeys.filter(k => k.type === 'fido2').map(k => ({
                    ...k, transports: JSON.parse(k.transports || '[]')
                }));
                const twoFaMethod = user ? user.two_fa_method : null;
                res.json({
                    username: req.user.user,
                    email: user ? (user.email || '') : '',
                    hasTOTP: !!(user && user.totp_secret),
                    twoFaMethod,
                    passkeyCount: passkeys.length,
                    passkeys,
                    fido2Keys,
                    fido2Count: fido2Keys.length,
                    recoveryCodesRemaining: rc ? rc.total : 0,
                    elevated
                });
            });
        });
    });
});

/* ── POST /api/change-username ── */
router.post('/change-username', authenticateJWT, (req, res) => {
    const { newUsername, currentPassword } = req.body;
    const trimmed = (newUsername || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, message: '用户名不能为空' });
    if (trimmed.length > 64) return res.status(400).json({ success: false, message: '用户名过长' });

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!(await verifyElevationOrPassword(req, res, currentPassword))) return;

        db.run('UPDATE users SET username = ? WHERE id = ?', [trimmed, req.user.id], function(e) {
            if (e) return res.status(500).json({ success: false, message: '用户名已被占用' });
            res.json({ success: true });
        });
    });
});

/* ── POST /api/change-password ── */
router.post('/change-password', authenticateJWT, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 12)
        return res.status(400).json({ success: false, message: '新密码至少需要12位' });
    if (newPassword.length > 128)
        return res.status(400).json({ success: false, message: '密码过长（最多128位）' });

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!(await verifyElevationOrPassword(req, res, currentPassword))) return;

        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, req.user.id], (e) => {
            if (e) return res.status(500).json({ success: false, message: '数据库错误' });
            res.json({ success: true });
        });
    });
});

/* ── POST /api/change-email ── */
router.post('/change-email', authenticateJWT, (req, res) => {
    const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');
    const COOKIE_NAME = req.app.get('COOKIE_NAME');
    const { newEmail, currentPassword } = req.body;
    const trimmed = (newEmail || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, message: '邮箱不能为空' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed))
        return res.status(400).json({ success: false, message: '邮箱格式不正确' });

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!(await verifyElevationOrPassword(req, res, currentPassword))) return;

        db.run('UPDATE users SET email = ? WHERE id = ?', [trimmed, req.user.id], function(e) {
            if (e) return res.status(500).json({ success: false, message: '数据库错误' });
            res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
            res.json({ success: true });
        });
    });
});

module.exports = router;
