/**
 * routes/auth.js
 * Login, logout, passkey login, and password verification routes.
 */
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
authenticator.options = { window: [1, 1] };
const { generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');

const db = require('../database');
const { authenticateJWT, setAuthCookie, verifyPassword, revokedTokensCache, tokenVersionCache, COOKIE_NAME } = require('../middleware/auth');

// Challenge store is shared via app.locals (set in server.js)
function setChallenge(app, userId, challenge) {
    const CHALLENGE_TTL_MS = 5 * 60 * 1000;
    app.locals.userChallenges.set(String(userId), { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}
function consumeChallenge(app, userId) {
    const key = String(userId);
    const entry = app.locals.userChallenges.get(key);
    app.locals.userChallenges.delete(key);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.challenge;
}

function decrypt(app, text) {
    return app.locals.decrypt(text);
}

/* ── Password + TOTP Login ── */
router.post('/login', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, async () => {
        const { username, password, totp, tempToken } = req.body;
        const JWT_SECRET = req.app.get('JWT_SECRET');

        if (tempToken && totp) {
            try {
                const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
                const targetUserId = decoded.temp_id;
                db.get('SELECT * FROM users WHERE id = ?', [targetUserId], (err, user) => {
                    if (err || !user) {
                        return res.status(401).json({ success: false, message: '会话已过期，请重新登录' });
                    }

                    // Attempt TOTP verification if secret exists
                    let totpOk = false;
                    if (user.totp_secret) {
                        try {
                            const decryptedSecret = decrypt(req.app, user.totp_secret);
                            if (decryptedSecret) {
                                const cleanedTotp = String(totp).replace(/[\s-]/g, '').trim();
                                totpOk = authenticator.verify({ token: cleanedTotp, secret: decryptedSecret });
                            }
                        } catch (totpErr) {
                            console.error('[TOTP Verify Exception]:', totpErr.message);
                        }
                    }

                    if (totpOk) {
                        setAuthCookie(req, res, user, 'totp');
                        return res.json({ success: true });
                    }

                    // Attempt Recovery Code verification
                    const normalised = String(totp).replace(/[\s-]/g, '').toUpperCase();
                    db.all('SELECT * FROM recovery_codes WHERE user_id = ? AND used = 0', [user.id], async (err2, rcList) => {
                        if (!rcList || rcList.length === 0) {
                            return res.status(401).json({ success: false, message: '动态验证码或恢复码无效' });
                        }

                        let validRc = null;
                        const crypto = require('crypto');
                        for (const rc of rcList) {
                            try {
                                if (rc.code_hash.startsWith('$2b$') || rc.code_hash.startsWith('$2a$')) {
                                    if (await bcrypt.compare(normalised, rc.code_hash)) { validRc = rc; break; }
                                } else {
                                    if (crypto.createHash('sha256').update(normalised).digest('hex') === rc.code_hash) { validRc = rc; break; }
                                }
                            } catch (rcErr) {}
                        }
                        if (!validRc) {
                            return res.status(401).json({ success: false, message: '动态验证码或恢复码无效' });
                        }
                        db.run('UPDATE recovery_codes SET used = 1 WHERE id = ?', [validRc.id]);
                        setAuthCookie(req, res, user, 'recovery');
                        res.json({ success: true, usedRecoveryCode: true });
                    });
                });
            } catch (e) {
                return res.status(401).json({ success: false, message: '会话已过期，请重新登录' });
            }
            return;
        }

        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            let passwordOk = false;
            if (user) {
                passwordOk = await verifyPassword(password || '', user.password, user.id);
            } else {
                const DUMMY_HASH = req.app.get('DUMMY_HASH');
                if (DUMMY_HASH) await bcrypt.compare(password || '', DUMMY_HASH);
            }
            if (!user || !passwordOk) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
            let twoFaMethod = user.two_fa_method;
            if (twoFaMethod === 'totp' && (!user.totp_secret || user.totp_secret === '')) {
                twoFaMethod = null;
            }
            if (twoFaMethod) {
                const tempToken = jwt.sign({ temp_id: user.id }, JWT_SECRET, { expiresIn: '5m' });
                return res.json({ success: false, requireTotp: true, tempToken, twoFaMethod });
            }
            setAuthCookie(req, res, user, 'password');
            res.json({ success: true });
        });
    });
});

/* ── Passkey Login ── */
router.get('/webauthn/login-options', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, async () => {
        const RP_ID = req.app.get('RP_ID');
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const options = await generateAuthenticationOptions({ rpID: RP_ID, userVerification: 'preferred' });
        const challengeToken = jwt.sign({ challenge: options.challenge }, JWT_SECRET, { expiresIn: '5m' });
        res.cookie('webauthn_challenge', challengeToken, { httpOnly: true, secure: true, maxAge: 5 * 60 * 1000, sameSite: 'Lax' });
        res.json(options);
    });
});

router.post('/webauthn/login-verify', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, () => {
        const RP_ID = req.app.get('RP_ID');
        const ORIGIN = req.app.get('ORIGIN');
        const JWT_SECRET = req.app.get('JWT_SECRET');

        db.get('SELECT * FROM passkeys WHERE credential_id = ?', [req.body.id], (err, passkey) => {
            if (!passkey) return res.status(400).json({ error: 'Key not found' });
            db.get('SELECT * FROM users WHERE id = ?', [passkey.user_id], async (err, user) => {
                if (!user) return res.status(400).json({ error: 'User not found' });
                try {
                    const token = req.cookies.webauthn_challenge;
                    if (!token) return res.status(400).json({ error: 'Challenge expired. Please try again.' });
                    res.clearCookie('webauthn_challenge');
                    const expectedChallenge = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }).challenge;
                    const verification = await verifyAuthenticationResponse({
                        response: req.body, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID,
                        authenticator: {
                            credentialID: Buffer.from(passkey.credential_id, 'base64url'),
                            credentialPublicKey: Buffer.from(passkey.public_key, 'base64url'),
                            counter: passkey.counter
                        }
                    });
                    if (verification.verified) {
                        db.run('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, passkey.id]);
                        setAuthCookie(req, res, user, 'passkey');
                        return res.json({ verified: true });
                    }
                } catch (error) {
                    return res.status(400).json({ error: error.message });
                }
            });
        });
    });
});

/* ── Password Verification (used by modal flows) ── */
router.post('/verify-password', authenticateJWT, (req, res) => {
    const { currentPassword } = req.body;
    db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });
        const pwdOk = await verifyPassword(currentPassword || '', user.password, req.user.id);
        if (pwdOk) {
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: '密码错误' });
        }
    });
});

/* ── Logout ── */
router.post('/logout', (req, res) => {
    const JWT_SECRET = req.app.get('JWT_SECRET');
    const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');
    const token = req.cookies[COOKIE_NAME];
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            if (decoded.jti && decoded.exp) {
                revokedTokensCache.set(decoded.jti, decoded.exp * 1000);
            }
        } catch (e) { /* ignore */ }
    }
    res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
        res.clearCookie('situla_elevation', { domain: COOKIE_DOMAIN });
    res.json({ success: true });
});

router.post('/logout-all', authenticateJWT, (req, res) => {
    const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');
    const userId = req.user.id;
    const newVersion = (tokenVersionCache.get(userId) || 0) + 1;
    db.run('UPDATE users SET token_version = ? WHERE id = ?', [newVersion, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        tokenVersionCache.set(userId, newVersion);
        res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
        res.clearCookie('situla_elevation', { domain: COOKIE_DOMAIN });
        res.json({ success: true });
    });
});

/* ── Trusted Domains ── */
router.get('/trusted-domains', (req, res) => {
    res.json({ trustedRoots: req.app.get('ALL_TRUST_ROOTS') });
});

module.exports = router;
