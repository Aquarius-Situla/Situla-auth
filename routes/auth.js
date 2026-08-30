/**
 * routes/auth.js
 * Login, logout, passkey authentication, and password verification.
 */
'use strict';

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const db = require('../core/database');
const AuthService = require('../services/authService');
const TotpService = require('../services/totpService');
const RecoveryService = require('../services/recoveryService');
const WebAuthnService = require('../services/webauthnService');
const { authenticateJWT } = require('../middleware/auth');

/* ── Password + 2FA Login ── */
router.post('/login', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, async () => {
        const { username, password, totp, tempToken } = req.body;
        const JWT_SECRET = req.app.get('JWT_SECRET');

        // 2FA step (TOTP or Recovery Code with tempToken)
        if (tempToken && totp) {
            try {
                const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
                const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.temp_id]);
                if (!user) {
                    return res.status(401).json({ success: false, message: '会话已过期，请重新登录' });
                }

                // 1. Attempt TOTP verification
                if (user.totp_secret && TotpService.verifyToken(user.totp_secret, totp)) {
                    AuthService.setAuthCookie(req, res, user, 'totp');
                    return res.json({ success: true });
                }

                // 2. Attempt Recovery Code verification (O(1) SHA-256)
                const rcOk = await RecoveryService.verifyAndConsume(user.id, totp);
                if (rcOk) {
                    AuthService.setAuthCookie(req, res, user, 'recovery');
                    return res.json({ success: true, usedRecoveryCode: true });
                }

                return res.status(401).json({ success: false, message: '动态验证码或恢复码无效' });
            } catch (e) {
                return res.status(401).json({ success: false, message: '会话已过期，请重新登录' });
            }
        }

        // Primary login step (Password)
        try {
            const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
            let passwordOk = false;
            if (user) {
                passwordOk = await AuthService.verifyPassword(password || '', user.password, user.id);
            } else {
                const DUMMY_HASH = req.app.get('DUMMY_HASH');
                if (DUMMY_HASH) await bcrypt.compare(password || '', DUMMY_HASH);
            }

            if (!user || !passwordOk) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            let twoFaMethod = user.two_fa_method;
            if (twoFaMethod === 'totp' && !user.totp_secret) {
                twoFaMethod = null;
            }

            if (twoFaMethod) {
                const newTempToken = jwt.sign({ temp_id: user.id }, JWT_SECRET, { expiresIn: '5m' });
                return res.json({ success: false, requireTotp: true, tempToken: newTempToken, twoFaMethod });
            }

            AuthService.setAuthCookie(req, res, user, 'password');
            res.json({ success: true });
        } catch (err) {
            console.error('[Login Error]:', err.message);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    });
});

/* ── Passkey Authentication ── */
router.get('/webauthn/login-options', (req, res) => {
    const challengeLimiter = req.app.get('challengeLimiter') || req.app.get('loginLimiter');
    return challengeLimiter(req, res, async () => {
        try {
            const RP_ID = req.app.get('RP_ID');
            const JWT_SECRET = req.app.get('JWT_SECRET');
            const options = await WebAuthnService.getPasskeyLoginOptions(RP_ID);
            const challengeToken = jwt.sign({ challenge: options.challenge }, JWT_SECRET, { expiresIn: '5m' });
            res.cookie('webauthn_challenge', challengeToken, { httpOnly: true, secure: true, maxAge: 5 * 60 * 1000, sameSite: 'Lax' });
            res.json(options);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

router.post('/webauthn/login-verify', (req, res) => {
    const loginLimiter = req.app.get('loginLimiter');
    return loginLimiter(req, res, async () => {
        const RP_ID = req.app.get('RP_ID');
        const ORIGIN = req.app.get('ORIGIN');
        const JWT_SECRET = req.app.get('JWT_SECRET');

        try {
            const token = req.cookies.webauthn_challenge;
            if (!token) return res.status(400).json({ error: 'Challenge expired. Please try again.' });
            res.clearCookie('webauthn_challenge');
            const expectedChallenge = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }).challenge;

            const { verified, user } = await WebAuthnService.verifyPasskeyLogin(req.body, expectedChallenge, ORIGIN, RP_ID);
            if (verified) {
                AuthService.setAuthCookie(req, res, user, 'passkey');
                return res.json({ verified: true });
            }
            res.status(400).json({ error: 'Verification failed' });
        } catch (error) {
            console.error('[WebAuthn Login Error]:', error.message);
            res.status(400).json({ error: error.message });
        }
    });
});

/* ── Password Verification (used by modal flows) ── */
router.post('/verify-password', authenticateJWT, (req, res) => {
    const sudoLimiter = req.app.get('sudoLimiter');
    const verifyLogic = async () => {
        const { currentPassword } = req.body;
        try {
            const user = await db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
            if (!user) return res.status(401).json({ success: false, message: 'User not found' });
            const pwdOk = await AuthService.verifyPassword(currentPassword || '', user.password, req.user.id);
            if (pwdOk) {
                res.json({ success: true });
            } else {
                res.status(401).json({ success: false, message: '密码错误' });
            }
        } catch (err) {
            res.status(500).json({ success: false, message: 'Database error' });
        }
    };
    if (sudoLimiter) return sudoLimiter(req, res, verifyLogic);
    verifyLogic();
});

/* ── Logout ── */
router.post('/logout', (req, res) => {
    AuthService.logout(req, res);
    res.json({ success: true });
});

router.post('/logout-all', authenticateJWT, async (req, res) => {
    try {
        await AuthService.logoutAll(req, res);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* ── Trusted Domains ── */
router.get('/trusted-domains', (req, res) => {
    res.json({ trustedRoots: req.app.get('ALL_TRUST_ROOTS') });
});

module.exports = router;
