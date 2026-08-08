/*
 * Situla Auth 2.0
 * Copyright (C) 2026 Situla
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

require('dotenv').config(); // Load .env at startup — enables docker compose restart to pick up changes
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const helmet = require('helmet');
const db = require('./database');

const SALT_ROUNDS = 12;

const app = express();
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

/* ── Rate Limiters ── */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,                   // max 15 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '尝试次数过多，请 15 分钟后再试' }
});

/* ── Auto-generate JWT_SECRET if missing or still at placeholder ── */
const PLACEHOLDER = 'change_this_to_a_long_random_secret';
const DEFAULT_LEGACY = 'situla_default_secret_please_change';
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === PLACEHOLDER || JWT_SECRET === DEFAULT_LEGACY) {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.log('[startup] JWT_SECRET not set — generated a new random secret.');
    // Persist to .env so the secret survives container restarts
    const envPath = path.join(__dirname, '.env');
    try {
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (/^JWT_SECRET=.*/m.test(envContent)) {
            envContent = envContent.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${JWT_SECRET}`);
        } else {
            envContent += `\nJWT_SECRET=${JWT_SECRET}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('[startup] JWT_SECRET written to .env for persistence.');
    } catch (e) {
        console.warn('[startup] Could not write JWT_SECRET to .env:', e.message);
    }
}
const ADMIN_USER = process.env.ADMIN_USER || 'akadmin';
const ADMIN_PASS_RAW = (process.env.ADMIN_PASS || '').replace(/^['\"]|['\"]$/g, '');
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.example.com';
const COOKIE_NAME = 'situla_session';
const RP_ID = process.env.RP_ID || 'auth.example.com';
const RP_NAME = 'Situla Auth';
/* In Nginx reverse proxy, the client origin is usually https://auth.example.com */
const ORIGIN = `https://${RP_ID}`;

/* Legacy SHA-256 hash — only used for initial admin account creation on first run */
function sha256Hash(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex');
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt (new) and legacy SHA-256 (old) hashes.
 * Automatically migrates SHA-256 hashes to bcrypt on successful login.
 */
async function verifyPassword(plaintext, storedHash, userId) {
    if (!storedHash) return false;
    // Detect bcrypt hash by prefix
    if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
        return await bcrypt.compare(plaintext, storedHash);
    }
    // Legacy SHA-256 check — migrate to bcrypt on success
    if (sha256Hash(plaintext) === storedHash) {
        const newHash = await bcrypt.hash(plaintext, SALT_ROUNDS);
        db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
        console.log(`[security] Migrated user ${userId} password hash from SHA-256 to bcrypt.`);
        return true;
    }
    return false;
}

db.get('SELECT * FROM users ORDER BY id ASC LIMIT 1', async (err, row) => {
    if (err) { console.error(err); return; }
    if (!row) {
        // New install: hash admin password with bcrypt from the start
        const hashed = await bcrypt.hash(ADMIN_PASS_RAW, SALT_ROUNDS);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [ADMIN_USER, hashed]);
    }
});

function authenticateJWT(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

function setAuthCookie(res, user) {
    const token = jwt.sign({ id: user.id, user: user.username, email: user.email || '' }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true, secure: true, domain: COOKIE_DOMAIN, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'Lax'
    });
}

/* NGINX Forward Auth endpoint */
app.get('/verify', (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).send('Unauthorized');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Inject SSO headers for reverse proxies (like FreshRSS HTTP_AUTH)
        if (decoded && decoded.user) {
            res.setHeader('X-Remote-User', decoded.user);
            res.setHeader('Remote-User', decoded.user);
        }
        if (decoded && decoded.email) {
            res.setHeader('X-Remote-Email', decoded.email);
            res.setHeader('Remote-Email', decoded.email);
        }
        res.status(200).send('OK');
    } catch (err) {
        res.status(401).send('Unauthorized');
    }
});

/* Password & TOTP Login — rate limited */
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password, totp, tempToken } = req.body;

    // TOTP verification using temporary token (avoiding password resubmission)
    if (tempToken && totp) {
        try {
            const decoded = jwt.verify(tempToken, JWT_SECRET);
            db.get('SELECT * FROM users WHERE id = ?', [decoded.temp_id], (err, user) => {
                if (!user || !user.totp_secret) return res.status(401).json({ success: false, message: 'Invalid session' });
                
                if (authenticator.verify({ token: totp, secret: user.totp_secret })) {
                    setAuthCookie(res, user);
                    return res.json({ success: true });
                }

                const normalised = totp.replace(/[\s-]/g, '').toUpperCase();
                const codeHash = crypto.createHash('sha256').update(normalised).digest('hex');
                db.get(
                    'SELECT * FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used = 0',
                    [user.id, codeHash],
                    (err2, rc) => {
                        if (!rc) return res.status(401).json({ success: false, message: '验证码或恢复码无效' });
                        db.run('UPDATE recovery_codes SET used = 1 WHERE id = ?', [rc.id]);
                        setAuthCookie(res, user);
                        res.json({ success: true, usedRecoveryCode: true });
                    }
                );
            });
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Session expired' });
        }
        return;
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        // Always run password check to prevent timing-based username enumeration
        const passwordOk = user ? await verifyPassword(password || '', user.password, user.id) : false;
        if (!user || !passwordOk) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (user.totp_secret) {
            const tempToken = jwt.sign({ temp_id: user.id }, JWT_SECRET, { expiresIn: '5m' });
            return res.json({ success: false, requireTotp: true, tempToken });
        }
        setAuthCookie(res, user);
        res.json({ success: true });
    });
});

/* WebAuthn challenge store with TTL — prevents replay attacks and memory leaks */
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const userChallenges = new Map();

function setChallenge(userId, challenge) {
    userChallenges.set(String(userId), { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}

function consumeChallenge(userId) {
    const key = String(userId);
    const entry = userChallenges.get(key);
    userChallenges.delete(key);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.challenge;
}

// Periodically clean up any stale challenges (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of userChallenges) {
        if (now > entry.expiresAt) userChallenges.delete(key);
    }
}, 10 * 60 * 1000);

/* Passkey Login Options */
app.get('/api/webauthn/login-options', (req, res) => {
    db.get('SELECT * FROM users ORDER BY id ASC LIMIT 1', async (err, user) => {
        if (!user) return res.status(400).json({ error: 'User not found' });
        
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: 'preferred'
        });
        setChallenge(user.id, options.challenge);
        res.json(options);
    });
});

/* Passkey Verify */
app.post('/api/webauthn/login-verify', async (req, res) => {
    console.log('[Login Verify] req.body.id:', req.body.id);
    db.get('SELECT * FROM passkeys WHERE credential_id = ?', [req.body.id], (err, passkey) => {
        if (!passkey) {
            console.error('[Login Verify] Key not found!');
            return res.status(400).json({ error: 'Key not found' });
        }
        
        db.get('SELECT * FROM users WHERE id = ?', [passkey.user_id], async (err, user) => {
            if (!user) return res.status(400).json({ error: 'User not found' });

            try {
                const expectedChallenge = consumeChallenge(user.id);
                if (!expectedChallenge) {
                    return res.status(400).json({ error: 'Challenge expired or not found. Please try again.' });
                }
                const verification = await verifyAuthenticationResponse({
                    response: req.body,
                    expectedChallenge,
                    expectedOrigin: ORIGIN,
                    expectedRPID: RP_ID,
                    authenticator: {
                        credentialID: Buffer.from(passkey.credential_id, 'base64url'),
                        credentialPublicKey: Buffer.from(passkey.public_key, 'base64url'),
                        counter: passkey.counter
                    }
                });
                
                if (verification.verified) {
                    db.run('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, passkey.id]);
                    setAuthCookie(res, user);
                    return res.json({ verified: true });
                }
            } catch (error) {
                console.error('[WebAuthn Login Error]:', error.message, error);
                return res.status(400).json({ error: error.message });
            }
        });
    });
});

/* ---- ADMIN ROUTES ---- */

/* Change username */
app.post('/api/change-username', authenticateJWT, (req, res) => {
    // currentPassword required to confirm identity
    const { newUsername, currentPassword } = req.body;
    const trimmed = (newUsername || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, message: '用户名不能为空' });
    if (trimmed.length > 64) return res.status(400).json({ success: false, message: '用户名过长' });

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!await verifyPassword(currentPassword || '', user.password, user.id))
            return res.status(401).json({ success: false, message: '当前密码错误' });

        db.run('UPDATE users SET username = ? WHERE id = ?', [trimmed, req.user.id], function(e) {
            if (e) return res.status(500).json({ success: false, message: '用户名已被占用' });
            res.json({ success: true });
        });
    });
});

/* Change password */
app.post('/api/change-password', authenticateJWT, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    // newPassword is received as raw string — JSON handles all special chars correctly
    if (!newPassword || newPassword.length < 1)
        return res.status(400).json({ success: false, message: '新密码不能为空' });
    if (newPassword.length > 128)
        return res.status(400).json({ success: false, message: '密码过长（最多128位）' });

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!await verifyPassword(currentPassword || '', user.password, user.id))
            return res.status(401).json({ success: false, message: '当前密码错误' });

        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, req.user.id], (e) => {
            if (e) return res.status(500).json({ success: false, message: '数据库错误' });
            res.json({ success: true });
        });
    });
});

/* Change email */
app.post('/api/change-email', authenticateJWT, (req, res) => {
    const { newEmail, currentPassword } = req.body;
    const trimmed = (newEmail || '').trim();
    if (!trimmed) return res.status(400).json({ success: false, message: '邮箱不能为空' });
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return res.status(400).json({ success: false, message: '邮箱格式不正确' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
        if (!await verifyPassword(currentPassword || '', user.password, user.id))
            return res.status(401).json({ success: false, message: '当前密码错误' });

        db.run('UPDATE users SET email = ? WHERE id = ?', [trimmed, req.user.id], function(e) {
            if (e) return res.status(500).json({ success: false, message: '数据库错误' });
            // Force re-login on success
            res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
            res.json({ success: true });
        });
    });
});


app.get('/api/totp/generate', authenticateJWT, (req, res) => {

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.user, RP_NAME, secret);
    qrcode.toDataURL(otpauth, (err, imageUrl) => res.json({ secret, qr: imageUrl }));
});

app.post('/api/totp/disable', authenticateJWT, async (req, res) => {
    const { currentPassword, totpToken } = req.body;
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

        // Require current password to confirm identity
        if (!await verifyPassword(currentPassword || '', user.password, user.id))
            return res.status(401).json({ success: false, message: '当前密码错误' });

        // Require valid TOTP token to disable TOTP
        if (user.totp_secret) {
            if (!totpToken || !authenticator.verify({ token: totpToken, secret: user.totp_secret }))
                return res.status(401).json({ success: false, message: '验证码错误，请输入当前的 6 位验证码' });
        }

        db.run('UPDATE users SET totp_secret = NULL WHERE id = ?', [req.user.id], (e) => {
            if (e) return res.status(500).json({ success: false, message: 'Database error' });
            res.json({ success: true });
        });
    });
});

app.get('/api/status', authenticateJWT, (req, res) => {
    db.get('SELECT totp_secret, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) console.error('Status users error:', err);
        db.all('SELECT id, name, created_at FROM passkeys WHERE user_id = ? ORDER BY id ASC', [req.user.id], (err2, keys) => {
            if (err2) console.error('Status passkeys error:', err2);
            db.get('SELECT COUNT(*) as total FROM recovery_codes WHERE user_id = ? AND used = 0', [req.user.id], (err3, rc) => {
                if (err3) console.error('Status rc error:', err3);
                console.log('API Status Response:', { userId: req.user.id, passkeyCount: keys ? keys.length : 0 });
                res.json({
                    email: user ? (user.email || '') : '',
                    hasTOTP: !!(user && user.totp_secret),
                    passkeyCount: keys ? keys.length : 0,
                    passkeys: keys || [],
                    recoveryCodesRemaining: rc ? rc.total : 0
                });
            });
        });
    });
});

/* List passkeys */
app.get('/api/passkeys', authenticateJWT, (req, res) => {
    db.all('SELECT id, name, created_at FROM passkeys WHERE user_id = ? ORDER BY id ASC', [req.user.id], (err, keys) => {
        res.json(keys || []);
    });
});

/* Delete a passkey */
app.delete('/api/passkeys/:id', authenticateJWT, (req, res) => {
    db.run('DELETE FROM passkeys WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ success: false });
        if (this.changes === 0) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true });
    });
});

/* Rename a passkey */
app.patch('/api/passkeys/:id', authenticateJWT, (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false });
    db.run('UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ?', [name, req.params.id, req.user.id], function(err) {
        if (err || this.changes === 0) return res.status(404).json({ success: false });
        res.json({ success: true });
    });
});

/* Generate recovery codes — invalidates old ones, returns plaintext once */
app.post('/api/recovery-codes/generate', authenticateJWT, (req, res) => {
    const COUNT = 8;
    // Generate COUNT codes in format XXXXX-XXXXX (10 uppercase alphanumeric chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 ambiguity
    const codes = [];
    for (let i = 0; i < COUNT; i++) {
        let raw = '';
        for (let j = 0; j < 10; j++) raw += chars[crypto.randomInt(chars.length)];
        codes.push(raw.slice(0, 5) + '-' + raw.slice(5)); // display: XXXXX-XXXXX
    }

    // Delete old codes, insert new hashed ones
    db.run('DELETE FROM recovery_codes WHERE user_id = ?', [req.user.id], () => {
        const stmt = db.prepare('INSERT INTO recovery_codes (user_id, code_hash, used) VALUES (?, ?, 0)');
        codes.forEach(c => {
            const normalised = c.replace(/-/g, ''); // store hash of raw 10-char form
            stmt.run([req.user.id, crypto.createHash('sha256').update(normalised).digest('hex')]);
        });
        stmt.finalize();
        res.json({ success: true, codes }); // plaintext returned ONCE
    });
});

/* Recovery code status */
app.get('/api/recovery-codes/status', authenticateJWT, (req, res) => {
    db.get('SELECT COUNT(*) as total FROM recovery_codes WHERE user_id = ? AND used = 0', [req.user.id], (err, row) => {
        db.get('SELECT COUNT(*) as usedCount FROM recovery_codes WHERE user_id = ? AND used = 1', [req.user.id], (err2, row2) => {
            const total = row ? row.total : 0;
            const used = row2 ? row2.usedCount : 0;
            res.json({ remaining: total, used, hasAny: (total + used) > 0 });
        });
    });
});

app.post('/api/totp/verify', authenticateJWT, (req, res) => {
    if (authenticator.verify({ token: req.body.token, secret: req.body.secret })) {
        db.run('UPDATE users SET totp_secret = ? WHERE id = ?', [req.body.secret, req.user.id]);
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Invalid token' });
});

app.get('/api/webauthn/register-options', authenticateJWT, async (req, res) => {
    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: Buffer.from(req.user.id.toString()),
        userName: req.user.user,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
    });
    setChallenge(req.user.id, options.challenge);
    res.json(options);
});

app.post('/api/webauthn/register-verify', authenticateJWT, async (req, res) => {
    try {
        const expectedChallenge = consumeChallenge(req.user.id);
        if (!expectedChallenge) {
            return res.status(400).json({ error: 'Challenge expired or not found. Please try again.' });
        }
        const verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID
        });
        
        if (verification.verified) {
            const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
            const name = (req.body._passkeyName || '通行密钥').trim().slice(0, 40);
            const createdAt = new Date().toISOString();
            db.run(
                'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [req.user.id,
                 Buffer.from(credentialID).toString('base64url'),
                 Buffer.from(credentialPublicKey).toString('base64url'),
                 counter, name, createdAt]
            );
            return res.json({ verified: true });
        }
    } catch (error) {
        console.error('[WebAuthn Register Error]:', error.message, error);
        return res.status(400).json({ error: error.message });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
    res.json({ success: true });
});

app.get('/admin', authenticateJWT, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Situla Auth 2.0 listening on port ${port}`));
