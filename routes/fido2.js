/**
 * routes/fido2.js
 * FIDO2 hardware security key registration and 2FA login.
 */
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const WebAuthnService = require('../services/webauthnService');
const AuthService = require('../services/authService');
const db = require('../core/database');
const { authenticateJWT } = require('../middleware/auth');

const FIDO2_MIN_KEYS = 2;

/* ── GET /api/fido2/register-options ── */
router.get('/register-options', authenticateJWT, async (req, res) => {
    try {
        const RP_ID = req.app.get('RP_ID');
        const RP_NAME = req.app.get('RP_NAME');
        const options = await WebAuthnService.getFido2RegisterOptions(req.user, RP_ID, RP_NAME);
        res.json(options);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

/* ── POST /api/fido2/register-verify ── */
router.post('/register-verify', authenticateJWT, async (req, res) => {
    if (!(await AuthService.verifyElevationOrPassword(req, res))) return;

    try {
        const RP_ID = req.app.get('RP_ID');
        const ORIGIN = req.app.get('ORIGIN');
        console.log(`[FIDO2 Register] User ${req.user.id} registering key: "${req.body.name || req.body._keyName}", id: "${req.body.id}", RP_ID: "${RP_ID}", ORIGIN: "${ORIGIN}"`);
        const result = await WebAuthnService.verifyFido2Registration(req.user, req.body, ORIGIN, RP_ID);
        console.log(`[FIDO2 Register Success] Key "${req.body.id}" registered successfully.`);
        res.json(result);
    } catch (e) {
        console.error('[FIDO2 Register Error]:', e.message);
        res.status(400).json({ error: e.message });
    }
});

/* ── GET /api/fido2/keys ── */
router.get('/keys', authenticateJWT, async (req, res) => {
    try {
        const keys = await WebAuthnService.getKeysByType(req.user.id, 'fido2');
        res.json(keys);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* ── DELETE /api/fido2/keys/:id ── */
router.delete('/keys/:id', authenticateJWT, async (req, res) => {
    try {
        const result = await WebAuthnService.deleteKey(req.user.id, req.params.id, 'fido2');
        if (result.notFound) return res.status(404).json({ success: false, message: 'Not found' });
        if (result.cannotDeleteActive2Fa) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/* ── PATCH /api/fido2/keys/:id ── */
router.patch('/keys/:id', authenticateJWT, async (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false });

    try {
        const ok = await WebAuthnService.renameKey(req.user.id, req.params.id, 'fido2', name);
        if (!ok) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/* ── POST /api/2fa/enable ── */
router.post('/enable', authenticateJWT, async (req, res) => {
    const { method, currentPassword } = req.body;
    if (!['totp', 'fido2'].includes(method)) {
        return res.status(400).json({ success: false, message: '无效的 2FA 方式' });
    }

    if (!(await AuthService.verifyElevationOrPassword(req, res, currentPassword))) return;

    try {
        const user = await db.get('SELECT two_fa_method, totp_secret FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ success: false });

        if (method === 'fido2') {
            const countRow = await db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2']);
            if (!countRow || countRow.cnt < FIDO2_MIN_KEYS) {
                return res.status(400).json({
                    success: false,
                    message: `至少需要添加 ${FIDO2_MIN_KEYS} 把安全密钥才能启用 FIDO2 2FA（当前：${countRow ? countRow.cnt : 0} 把）`
                });
            }
            await db.run('UPDATE users SET two_fa_method = ? WHERE id = ?', ['fido2', req.user.id]);
            res.json({ success: true });
        } else {
            if (!user.totp_secret) {
                return res.status(400).json({ success: false, message: '请先完成 TOTP 设置' });
            }
            await db.run('UPDATE users SET two_fa_method = ? WHERE id = ?', ['totp', req.user.id]);
            res.json({ success: true });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/* ── POST /api/fido2/challenge (2FA login step 1) ── */
router.post('/challenge', (req, res) => {
    const challengeLimiter = req.app.get('challengeLimiter') || req.app.get('loginLimiter');
    return challengeLimiter(req, res, async () => {
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const RP_ID = req.app.get('RP_ID');
        const { tempToken } = req.body;
        if (!tempToken) return res.status(400).json({ error: 'Missing tempToken' });

        try {
            const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
            const options = await WebAuthnService.getFido2AuthOptions(decoded.temp_id, RP_ID);
            console.log(`[FIDO2 Challenge] Generated challenge for user ${decoded.temp_id}, RP_ID: "${options.rpId}", allowCredentials:`, options.allowCredentials?.map(c => c.id));
            res.json(options);
        } catch (e) {
            console.error('[FIDO2 Challenge Error]:', e.message);
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
    });
});

/* ── POST /api/fido2/verify (2FA login step 2) ── */
router.post('/verify', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, async () => {
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const RP_ID = req.app.get('RP_ID');
        const ORIGIN = req.app.get('ORIGIN');
        const { tempToken, ...assertionResponse } = req.body;
        if (!tempToken) return res.status(400).json({ error: 'Missing tempToken' });

        try {
            const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
            const { verified, user } = await WebAuthnService.verifyFido2Auth(decoded.temp_id, assertionResponse, ORIGIN, RP_ID);
            if (verified) {
                AuthService.setAuthCookie(req, res, user, 'fido2');
                return res.json({ verified: true });
            }
            res.status(400).json({ error: '验证失败' });
        } catch (e) {
            console.error('[FIDO2 Verify Error]:', e.message);
            return res.status(400).json({ error: e.message });
        }
    });
});

module.exports = router;
