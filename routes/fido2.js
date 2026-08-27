/**
 * routes/fido2.js
 * FIDO2 hardware security key registration and 2FA login.
 */
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const db = require('../database');
const { authenticateJWT, setAuthCookie, verifyElevationOrPassword } = require('../middleware/auth');

const FIDO2_MIN_KEYS = 2;
const FIDO2_MAX_KEYS = 6;

function setChallenge(app, key, challenge) {
    const CHALLENGE_TTL_MS = 5 * 60 * 1000;
    app.locals.userChallenges.set(String(key), { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}
function consumeChallenge(app, key) {
    const k = String(key);
    const entry = app.locals.userChallenges.get(k);
    app.locals.userChallenges.delete(k);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.challenge;
}

/* ── GET /api/fido2/register-options ── */
router.get('/register-options', authenticateJWT, async (req, res) => {
    const RP_ID = req.app.get('RP_ID');
    const RP_NAME = req.app.get('RP_NAME');
    db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], async (err, row) => {
        if (row && row.cnt >= FIDO2_MAX_KEYS)
            return res.status(400).json({ error: `最多只能添加 ${FIDO2_MAX_KEYS} 把硬件密钥` });
        const options = await generateRegistrationOptions({
            rpName: RP_NAME, rpID: RP_ID,
            userID: Buffer.from(req.user.id.toString()),
            userName: req.user.user,
            attestationType: 'none',
            authenticatorSelection: { authenticatorAttachment: 'cross-platform', userVerification: 'preferred' }
        });
        setChallenge(req.app, `fido2_reg_${req.user.id}`, options.challenge);
        res.json(options);
    });
});

/* ── POST /api/fido2/register-verify ── */
router.post('/register-verify', authenticateJWT, async (req, res) => {
    if (!(await verifyElevationOrPassword(req, res))) return;

    const RP_ID = req.app.get('RP_ID');
    const ORIGIN = req.app.get('ORIGIN');
    try {
        const expectedChallenge = consumeChallenge(req.app, `fido2_reg_${req.user.id}`);
        if (!expectedChallenge) return res.status(400).json({ error: '挑战已过期，请重试' });

        db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], async (err, row) => {
            if (row && row.cnt >= FIDO2_MAX_KEYS)
                return res.status(400).json({ error: `最多只能添加 ${FIDO2_MAX_KEYS} 把硬件密钥` });
            try {
                const verification = await verifyRegistrationResponse({
                    response: req.body, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID
                });
                if (verification.verified) {
                    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
                    const name = (req.body._keyName || '安全密钥').trim().slice(0, 40);
                    const transports = JSON.stringify(req.body.response?.transports || []);
                    db.run(
                        'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at, type, transports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [req.user.id,
                         Buffer.from(credentialID).toString('base64url'),
                         Buffer.from(credentialPublicKey).toString('base64url'),
                         counter, name, new Date().toISOString(), 'fido2', transports],
                        (dbErr) => {
                            if (dbErr) return res.status(500).json({ error: 'Database error' });
                            res.json({ verified: true });
                        }
                    );
                } else {
                    res.status(400).json({ error: '验证失败' });
                }
            } catch (verifyErr) {
                console.error('[FIDO2 Register Error]:', verifyErr.message);
                return res.status(400).json({ error: verifyErr.message });
            }
        });
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }
});

/* ── GET /api/fido2/keys ── */
router.get('/keys', authenticateJWT, (req, res) => {
    db.all('SELECT id, name, created_at, transports FROM passkeys WHERE user_id = ? AND type = ? ORDER BY id ASC',
        [req.user.id, 'fido2'], (err, keys) => {
        res.json((keys || []).map(k => ({ ...k, transports: JSON.parse(k.transports || '[]') })));
    });
});

/* ── DELETE /api/fido2/keys/:id ── */
router.delete('/keys/:id', authenticateJWT, (req, res) => {
    db.run('DELETE FROM passkeys WHERE id = ? AND user_id = ? AND type = ?',
        [req.params.id, req.user.id, 'fido2'], function(err) {
        if (err) return res.status(500).json({ success: false });
        if (this.changes === 0) return res.status(404).json({ success: false, message: 'Not found' });
        db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], (err2, row) => {
            const remaining = row ? row.cnt : 0;
            if (remaining < FIDO2_MIN_KEYS) {
                db.run('UPDATE users SET two_fa_method = NULL WHERE id = ? AND two_fa_method = ?', [req.user.id, 'fido2']);
                return res.json({ success: true, autoDisabled: true, remaining });
            }
            res.json({ success: true, autoDisabled: false, remaining });
        });
    });
});

/* ── PATCH /api/fido2/keys/:id ── */
router.patch('/keys/:id', authenticateJWT, (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false });
    db.run('UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ? AND type = ?',
        [name, req.params.id, req.user.id, 'fido2'], function(err) {
        if (err || this.changes === 0) return res.status(404).json({ success: false });
        res.json({ success: true });
    });
});

/* ── POST /api/2fa/enable ── */
router.post('/enable', authenticateJWT, (req, res) => {
    const { method } = req.body;
    if (!['totp', 'fido2'].includes(method))
        return res.status(400).json({ success: false, message: '无效的 2FA 方式' });

    db.get('SELECT two_fa_method, totp_secret FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (!user) return res.status(404).json({ success: false });
        if (method === 'fido2') {
            db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], (err2, row) => {
                if (!row || row.cnt < FIDO2_MIN_KEYS)
                    return res.status(400).json({ success: false, message: `至少需要添加 ${FIDO2_MIN_KEYS} 把安全密钥才能启用 FIDO2 2FA（当前：${row ? row.cnt : 0} 把）` });
                db.run('UPDATE users SET two_fa_method = ?, totp_secret = NULL WHERE id = ?', ['fido2', req.user.id], (e) => {
                    if (e) return res.status(500).json({ success: false });
                    res.json({ success: true });
                });
            });
        } else {
            if (!user.totp_secret) return res.status(400).json({ success: false, message: '请先完成 TOTP 设置' });
            db.run('UPDATE users SET two_fa_method = ? WHERE id = ?', ['totp', req.user.id], (e) => {
                if (e) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
        }
    });
});

/* ── POST /api/fido2/challenge (2FA login step 1) ── */
router.post('/challenge', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, async () => {
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const RP_ID = req.app.get('RP_ID');
        const { tempToken } = req.body;
        if (!tempToken) return res.status(400).json({ error: 'Missing tempToken' });
        try {
            const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
            const userId = decoded.temp_id;
            db.all('SELECT credential_id, transports FROM passkeys WHERE user_id = ? AND type = ?',
                [userId, 'fido2'], async (err, keys) => {
                if (!keys || keys.length === 0) return res.status(400).json({ error: 'No FIDO2 keys registered' });
                const options = await generateAuthenticationOptions({
                    rpID: RP_ID, userVerification: 'preferred',
                    allowCredentials: keys.map(k => ({ id: k.credential_id, transports: JSON.parse(k.transports || '[]') }))
                });
                setChallenge(req.app, `fido2_login_${userId}`, options.challenge);
                res.json(options);
            });
        } catch (e) {
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
            const userId = decoded.temp_id;
            const expectedChallenge = consumeChallenge(req.app, `fido2_login_${userId}`);
            if (!expectedChallenge) return res.status(400).json({ error: '挑战已过期，请重新登录' });

            db.get('SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ? AND type = ?',
                [assertionResponse.id, userId, 'fido2'], async (err, key) => {
                if (!key) return res.status(400).json({ error: '未找到对应的安全密钥' });
                try {
                    const verification = await verifyAuthenticationResponse({
                        response: assertionResponse, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID,
                        authenticator: {
                            credentialID: Buffer.from(key.credential_id, 'base64url'),
                            credentialPublicKey: Buffer.from(key.public_key, 'base64url'),
                            counter: key.counter
                        }
                    });
                    if (verification.verified) {
                        db.run('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, key.id]);
                        db.get('SELECT * FROM users WHERE id = ?', [userId], (err2, user) => {
                            if (!user) return res.status(400).json({ error: 'User not found' });
                            setAuthCookie(req, res, user, 'fido2');
                            res.json({ verified: true });
                        });
                    } else {
                        res.status(400).json({ error: '验证失败' });
                    }
                } catch (verifyErr) {
                    console.error('[FIDO2 Verify Error]:', verifyErr.message);
                    res.status(400).json({ error: verifyErr.message });
                }
            });
        } catch (e) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }
    });
});

module.exports = router;
