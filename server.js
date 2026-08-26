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
const mailer = require('./mailer');

const COOKIE_NAME = process.env.COOKIE_NAME || 'situla_session';
const SALT_ROUNDS = 12;

let DUMMY_HASH = '';
(async () => {
    DUMMY_HASH = await bcrypt.hash('dummy_password_for_timing_protection', SALT_ROUNDS);
})();

const app = express();
app.set('trust proxy', 1);

app.use((req, res, next) => {
    fs.appendFileSync('/app/request.log', `[REQ] ${req.method} ${req.url}\n`);
    next();
});

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
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

// Auto-redirect logged-in users away from the login page
app.get(['/', '/index.html'], (req, res, next) => {
    try {
        const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            const currentVersion = tokenVersionCache.get(decoded.id) || 0;
            if (decoded.token_version === currentVersion && (!decoded.jti || !revokedTokensCache.has(decoded.jti))) {
                const rd = req.query.rd;
                if (!rd) return res.redirect(302, '/admin');
                if (isTrustedRedirect(rd)) return res.redirect(302, rd);
                return res.redirect(302, '/admin');
            }
        }
    } catch (e) {
        console.error('[Redirect] error:', e.message);
    }
    next(); // Fall through to express.static
});

app.use(express.static('public'));

/* ── Rate Limiters ── */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,                   // max 5 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts, please try again in 15 minutes.' }
});

/* ── Auto-generate JWT_SECRET and ENCRYPTION_KEY if missing ── */
const PLACEHOLDER = 'change_this_to_a_long_random_secret';
const DEFAULT_LEGACY = 'situla_default_secret_please_change';

let JWT_SECRET = process.env.JWT_SECRET;
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
let envUpdated = false;

if (!JWT_SECRET || JWT_SECRET === PLACEHOLDER || JWT_SECRET === DEFAULT_LEGACY) {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.log('[startup] JWT_SECRET not set — generated a new random secret.');
    envUpdated = true;
}

if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    console.log('[startup] ENCRYPTION_KEY not set — generated a new random key.');
    envUpdated = true;
}

if (envUpdated) {
    // Persist to .env so the secrets survive container restarts
    const envPath = path.join(__dirname, '.env');
    try {
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        
        if (/^JWT_SECRET=.*/m.test(envContent)) {
            envContent = envContent.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${JWT_SECRET}`);
        } else if (envContent && !envContent.endsWith('\n')) {
            envContent += `\nJWT_SECRET=${JWT_SECRET}\n`;
        } else {
            envContent += `JWT_SECRET=${JWT_SECRET}\n`;
        }

        if (/^ENCRYPTION_KEY=.*/m.test(envContent)) {
            envContent = envContent.replace(/^ENCRYPTION_KEY=.*/m, `ENCRYPTION_KEY=${ENCRYPTION_KEY}`);
        } else {
            envContent += `ENCRYPTION_KEY=${ENCRYPTION_KEY}\n`;
        }
        
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('[startup] Secrets written to .env for persistence.');
    } catch (e) {
        console.warn('[startup] Could not write secrets to .env:', e.message);
    }
}

/* ── Encryption Utilities ── */
function encrypt(text) {
    if (!text) return text;
    // Prefix to identify encrypted text
    if (text.startsWith('enc:')) return text;
    try {
        const iv = crypto.randomBytes(12); // GCM standard IV size
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag().toString('base64');
        return `enc:${iv.toString('base64')}:${authTag}:${encrypted}`;
    } catch (e) {
        console.error('[Encryption] Failed to encrypt:', e.message);
        throw e;
    }
}

function decrypt(text) {
    if (!text || !text.startsWith('enc:')) return text;
    try {
        const parts = text.split(':');
        if (parts.length !== 4) throw new Error('Invalid encrypted format');
        const iv = Buffer.from(parts[1], 'base64');
        const authTag = Buffer.from(parts[2], 'base64');
        const encrypted = parts[3];
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('[Encryption] Failed to decrypt:', e.message);
        throw e;
    }
}

const ADMIN_USER = process.env.ADMIN_USER || 'akadmin';
const ADMIN_PASS_RAW = (process.env.ADMIN_PASS || '').replace(/^['\"]|['\"]$/g, '');
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.example.com';
const RP_ID = process.env.RP_ID || 'auth.example.com';
const RP_NAME = 'Situla Auth';
/* In Nginx reverse proxy, the client origin is usually https://auth.example.com */
const ORIGIN = `https://${RP_ID}`;

/* ── Trusted Redirect Domains ── */
// Auto-derive the default trust root from RP_ID:
//   auth.a.example.com  →  a.example.com  (direct parent)
//   auth.example.com    →  example.com
function deriveDefaultTrustRoot(rpId) {
    const parts = rpId.split('.');
    // If only one or two parts (e.g. "localhost" or "example.com"), trust the whole thing
    if (parts.length <= 2) return rpId;
    // Strip the first segment ("auth") to get the parent domain
    return parts.slice(1).join('.');
}

const DEFAULT_TRUST_ROOT = deriveDefaultTrustRoot(RP_ID);

// TRUSTED_DOMAINS: comma-separated list of additional trust roots in .env
// e.g. TRUSTED_DOMAINS=a.com,b.org
const EXTRA_TRUST_ROOTS = (process.env.TRUSTED_DOMAINS || '')
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^\*\./, ''))
    .filter(Boolean);

// Combined unique set of trust roots (without leading dots)
const ALL_TRUST_ROOTS = [...new Set([DEFAULT_TRUST_ROOT, ...EXTRA_TRUST_ROOTS])];

/**
 * Returns true if `url` is a safe redirect target:
 * the hostname must equal a trust root or be a direct/indirect subdomain of one.
 */
function isTrustedRedirect(url) {
    // Allow internal OIDC interaction paths (relative URL, no hostname)
    if (url && url.startsWith('/oidc/interaction/')) return true;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return ALL_TRUST_ROOTS.some(root =>
            hostname === root || hostname.endsWith('.' + root)
        );
    } catch {
        return false;
    }
}

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

// Cache for token versions to allow synchronous, 0-latency JWT verification without DB lookups
const tokenVersionCache = new Map();
db.all('SELECT id, token_version FROM users', (err, rows) => {
    if (!err && rows) {
        for (const row of rows) {
            tokenVersionCache.set(row.id, row.token_version || 0);
        }
    }
});

// Cache for revoked specific JWTs (stateless session blacklisting)
const revokedTokensCache = new Map();
// Cleanup expired tokens from blacklist every hour
setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of revokedTokensCache.entries()) {
        if (now > exp) revokedTokensCache.delete(jti);
    }
}, 60 * 60 * 1000);

function authenticateJWT(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
        if (decoded.token_version !== currentVersion) {
            return res.status(401).json({ error: 'Session expired' });
        }
        if (decoded.jti && revokedTokensCache.has(decoded.jti)) {
            return res.status(401).json({ error: 'Session revoked' });
        }
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

function setAuthCookie(res, user) {
    const tokenVersion = tokenVersionCache.get(user.id) || 0;
    const token = jwt.sign({ 
        id: user.id, 
        user: user.username, 
        email: user.email || '', 
        token_version: tokenVersion,
        jti: crypto.randomUUID()
    }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true, secure: true, domain: COOKIE_DOMAIN, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'Lax'
    });
}

/* NGINX Forward Auth endpoint */
app.get('/verify', (req, res) => {
    // 允许常见的站点图标和清单文件绕过认证
    const originalUri = req.headers['x-forwarded-uri'] || req.headers['x-original-uri'] || '';
    const pathname = originalUri.split('?')[0].toLowerCase();
    
    const publicPaths = [
        '/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
        '/logo.png', '/logo.svg', '/icon.png', '/icon.svg',
        '/robots.txt', '/site.webmanifest', '/manifest.json', '/browserconfig.xml'
    ];
    
    if (publicPaths.includes(pathname)) {
        return res.status(200).send('OK');
    }

    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).send('Unauthorized');
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
        if (decoded.token_version !== currentVersion) {
            return res.status(401).send('Unauthorized');
        }
        if (decoded.jti && revokedTokensCache.has(decoded.jti)) {
            return res.status(401).send('Unauthorized');
        }
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

/* Public endpoint: returns the list of trusted redirect root domains */
app.get('/api/trusted-domains', (req, res) => {
    res.json({ trustedRoots: ALL_TRUST_ROOTS });
});

/* Password & TOTP Login — rate limited */
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password, totp, tempToken } = req.body;

    // TOTP verification using temporary token (avoiding password resubmission)
    if (tempToken && totp) {
        try {
            const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
            db.get('SELECT * FROM users WHERE id = ?', [decoded.temp_id], (err, user) => {
                if (!user || (!user.totp_secret && user.two_fa_method !== 'totp')) return res.status(401).json({ success: false, message: 'Invalid session' });
                
                if (authenticator.verify({ token: totp, secret: decrypt(user.totp_secret) })) {
                    setAuthCookie(res, user);
                    return res.json({ success: true });
                }

                const normalised = totp.replace(/[\s-]/g, '').toUpperCase();
                db.all('SELECT * FROM recovery_codes WHERE user_id = ? AND used = 0', [user.id], async (err2, rcList) => {
                    if (!rcList || rcList.length === 0) return res.status(401).json({ success: false, message: '验证码或恢复码无效' });
                    
                    let validRc = null;
                    for (const rc of rcList) {
                        if (rc.code_hash.startsWith('$2b$') || rc.code_hash.startsWith('$2a$')) {
                            if (await bcrypt.compare(normalised, rc.code_hash)) { validRc = rc; break; }
                        } else {
                            // Legacy SHA-256
                            if (crypto.createHash('sha256').update(normalised).digest('hex') === rc.code_hash) { validRc = rc; break; }
                        }
                    }

                    if (!validRc) return res.status(401).json({ success: false, message: '验证码或恢复码无效' });
                    
                    db.run('UPDATE recovery_codes SET used = 1 WHERE id = ?', [validRc.id]);
                    setAuthCookie(res, user);
                    res.json({ success: true, usedRecoveryCode: true });
                });
            });
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Session expired' });
        }
        return;
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        // Always run password check to prevent timing-based username enumeration
        let passwordOk = false;
        if (user) {
            passwordOk = await verifyPassword(password || '', user.password, user.id);
        } else {
            if (DUMMY_HASH) await bcrypt.compare(password || '', DUMMY_HASH);
        }
        if (!user || !passwordOk) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        // Check for any 2FA method: TOTP (legacy totp_secret column) or FIDO2
        const twoFaMethod = user.two_fa_method;
        if (twoFaMethod) {
            const tempToken = jwt.sign({ temp_id: user.id }, JWT_SECRET, { expiresIn: '5m' });
            return res.json({ success: false, requireTotp: true, tempToken, twoFaMethod });
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
app.get('/api/webauthn/login-options', loginLimiter, async (req, res) => {
    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'preferred'
    });
    
    // Store challenge in a temp signed cookie to avoid tying to a specific user
    const challengeToken = jwt.sign({ challenge: options.challenge }, JWT_SECRET, { expiresIn: '5m' });
    res.cookie('webauthn_challenge', challengeToken, { httpOnly: true, secure: true, maxAge: 5 * 60 * 1000, sameSite: 'Lax' });
    
    res.json(options);
});

/* Passkey Verify */
app.post('/api/webauthn/login-verify', loginLimiter, async (req, res) => {
    console.log('[Login Verify] req.body.id:', req.body.id);
    db.get('SELECT * FROM passkeys WHERE credential_id = ?', [req.body.id], (err, passkey) => {
        if (!passkey) {
            console.error('[Login Verify] Key not found!');
            return res.status(400).json({ error: 'Key not found' });
        }
        
        db.get('SELECT * FROM users WHERE id = ?', [passkey.user_id], async (err, user) => {
            if (!user) return res.status(400).json({ error: 'User not found' });

            try {
                const token = req.cookies.webauthn_challenge;
                if (!token) return res.status(400).json({ error: 'Challenge expired. Please try again.' });
                res.clearCookie('webauthn_challenge');
                const expectedChallenge = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }).challenge;

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
    if (!newPassword || newPassword.length < 12)
        return res.status(400).json({ success: false, message: '新密码至少需要12位' });
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
    db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [encrypt(secret), req.user.id], () => {
        qrcode.toDataURL(otpauth, (err, imageUrl) => res.json({ secret, qr: imageUrl }));
    });
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
            if (!totpToken || !authenticator.verify({ token: totpToken, secret: decrypt(user.totp_secret) }))
                return res.status(401).json({ success: false, message: '验证码错误，请输入当前的 6 位验证码' });
        }

        db.run('UPDATE users SET totp_secret = NULL, two_fa_method = NULL WHERE id = ?', [req.user.id], (e) => {
            if (e) return res.status(500).json({ success: false, message: 'Database error' });
            res.json({ success: true });
        });
    });
});

app.get('/api/status', authenticateJWT, (req, res) => {
    db.get('SELECT totp_secret, email, two_fa_method FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) console.error('Status users error:', err);
        // Fetch passkeys (type='passkey') and fido2 keys separately
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
                    email: user ? (user.email || '') : '',
                    hasTOTP: !!(user && user.totp_secret),
                    twoFaMethod,
                    passkeyCount: passkeys.length,
                    passkeys: passkeys,
                    fido2Keys,
                    fido2Count: fido2Keys.length,
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
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes = [];
    for (let i = 0; i < COUNT; i++) {
        let raw = '';
        for (let j = 0; j < 10; j++) raw += chars[crypto.randomInt(chars.length)];
        codes.push(raw.slice(0, 5) + '-' + raw.slice(5));
    }

    db.run('DELETE FROM recovery_codes WHERE user_id = ?', [req.user.id], async () => {
        const stmt = db.prepare('INSERT INTO recovery_codes (user_id, code_hash, used) VALUES (?, ?, 0)');
        for (const c of codes) {
            const normalised = c.replace(/-/g, '');
            const hashed = await bcrypt.hash(normalised, SALT_ROUNDS);
            stmt.run([req.user.id, hashed]);
        }
        stmt.finalize();
        res.json({ success: true, codes });
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
    db.get('SELECT totp_pending_secret, two_fa_method FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (!user || !user.totp_pending_secret) return res.status(400).json({ success: false, message: 'No pending TOTP setup' });
        if (authenticator.verify({ token: req.body.token, secret: decrypt(user.totp_pending_secret) })) {
            db.run('UPDATE users SET totp_secret = ?, totp_pending_secret = "", two_fa_method = ? WHERE id = ?',
                [user.totp_pending_secret, 'totp', req.user.id]);
            return res.json({ success: true });
        }
        res.status(400).json({ success: false, message: 'Invalid token' });
    });
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
            const transports = JSON.stringify(req.body.response?.transports || []);
            db.run(
                'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at, type, transports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [req.user.id,
                 Buffer.from(credentialID).toString('base64url'),
                 Buffer.from(credentialPublicKey).toString('base64url'),
                 counter, name, createdAt, 'passkey', transports]
            );
            return res.json({ verified: true });
        }
    } catch (error) {
        console.error('[WebAuthn Register Error]:', error.message, error);
        return res.status(400).json({ error: error.message });
    }
});

/* ── FIDO2 2FA Routes ── */
const FIDO2_MIN_KEYS = 2;
const FIDO2_MAX_KEYS = 6;

/* Register a new FIDO2 2FA key — options */
app.get('/api/fido2/register-options', authenticateJWT, async (req, res) => {
    // Check key count limit
    db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], async (err, row) => {
        if (row && row.cnt >= FIDO2_MAX_KEYS) {
            return res.status(400).json({ error: `最多只能添加 ${FIDO2_MAX_KEYS} 把硬件密钥` });
        }
        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: Buffer.from(req.user.id.toString()),
            userName: req.user.user,
            attestationType: 'none',
            authenticatorSelection: {
                authenticatorAttachment: 'cross-platform', // External keys only (YubiKey, etc.)
                userVerification: 'preferred',
            },
            // No authenticatorTransports restriction — browser handles USB/NFC/BLE automatically
        });
        setChallenge(`fido2_reg_${req.user.id}`, options.challenge);
        res.json(options);
    });
});

/* Register a new FIDO2 2FA key — verify */
app.post('/api/fido2/register-verify', authenticateJWT, async (req, res) => {
    try {
        const expectedChallenge = consumeChallenge(`fido2_reg_${req.user.id}`);
        if (!expectedChallenge) {
            return res.status(400).json({ error: '挑战已过期，请重试' });
        }
        // Check current fido2 key count
        db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], async (err, row) => {
            if (row && row.cnt >= FIDO2_MAX_KEYS) {
                return res.status(400).json({ error: `最多只能添加 ${FIDO2_MAX_KEYS} 把硬件密钥` });
            }
            try {
                const verification = await verifyRegistrationResponse({
                    response: req.body,
                    expectedChallenge,
                    expectedOrigin: ORIGIN,
                    expectedRPID: RP_ID
                });
                if (verification.verified) {
                    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
                    const name = (req.body._keyName || '安全密钥').trim().slice(0, 40);
                    const createdAt = new Date().toISOString();
                    const transports = JSON.stringify(req.body.response?.transports || []);
                    db.run(
                        'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at, type, transports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [req.user.id,
                         Buffer.from(credentialID).toString('base64url'),
                         Buffer.from(credentialPublicKey).toString('base64url'),
                         counter, name, createdAt, 'fido2', transports],
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

/* List FIDO2 keys */
app.get('/api/fido2/keys', authenticateJWT, (req, res) => {
    db.all('SELECT id, name, created_at, transports FROM passkeys WHERE user_id = ? AND type = ? ORDER BY id ASC',
        [req.user.id, 'fido2'], (err, keys) => {
        res.json((keys || []).map(k => ({ ...k, transports: JSON.parse(k.transports || '[]') })));
    });
});

/* Delete a FIDO2 key — auto-disables 2FA if below minimum */
app.delete('/api/fido2/keys/:id', authenticateJWT, (req, res) => {
    db.run('DELETE FROM passkeys WHERE id = ? AND user_id = ? AND type = ?',
        [req.params.id, req.user.id, 'fido2'], function(err) {
        if (err) return res.status(500).json({ success: false });
        if (this.changes === 0) return res.status(404).json({ success: false, message: 'Not found' });
        // Check remaining count
        db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], (err2, row) => {
            const remaining = row ? row.cnt : 0;
            if (remaining < FIDO2_MIN_KEYS) {
                // Auto-disable FIDO2 2FA
                db.run('UPDATE users SET two_fa_method = NULL WHERE id = ? AND two_fa_method = ?',
                    [req.user.id, 'fido2']);
                return res.json({ success: true, autoDisabled: true, remaining });
            }
            res.json({ success: true, autoDisabled: false, remaining });
        });
    });
});

/* Rename a FIDO2 key */
app.patch('/api/fido2/keys/:id', authenticateJWT, (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false });
    db.run('UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ? AND type = ?',
        [name, req.params.id, req.user.id, 'fido2'], function(err) {
        if (err || this.changes === 0) return res.status(404).json({ success: false });
        res.json({ success: true });
    });
});

/* Enable 2FA for a given method */
app.post('/api/2fa/enable', authenticateJWT, (req, res) => {
    const { method } = req.body;
    if (!['totp', 'fido2'].includes(method)) {
        return res.status(400).json({ success: false, message: '无效的 2FA 方式' });
    }
    db.get('SELECT two_fa_method, totp_secret FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (!user) return res.status(404).json({ success: false });
        if (method === 'fido2') {
            db.get('SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?', [req.user.id, 'fido2'], (err2, row) => {
                if (!row || row.cnt < FIDO2_MIN_KEYS) {
                    return res.status(400).json({
                        success: false,
                        message: `至少需要添加 ${FIDO2_MIN_KEYS} 把安全密钥才能启用 FIDO2 2FA（当前：${row ? row.cnt : 0} 把）`
                    });
                }
                db.run('UPDATE users SET two_fa_method = ?, totp_secret = NULL WHERE id = ?', ['fido2', req.user.id], (e) => {
                    if (e) return res.status(500).json({ success: false });
                    res.json({ success: true });
                });
            });
        } else {
            // totp: totp_secret must already be set
            if (!user.totp_secret) {
                return res.status(400).json({ success: false, message: '请先完成 TOTP 设置' });
            }
            db.run('UPDATE users SET two_fa_method = ? WHERE id = ?', ['totp', req.user.id], (e) => {
                if (e) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
        }
    });
});

/* FIDO2 2FA login challenge — requires tempToken in body */
app.post('/api/fido2/challenge', loginLimiter, async (req, res) => {
    const { tempToken } = req.body;
    if (!tempToken) return res.status(400).json({ error: 'Missing tempToken' });
    try {
        const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
        const userId = decoded.temp_id;
        db.all('SELECT credential_id, transports FROM passkeys WHERE user_id = ? AND type = ?',
            [userId, 'fido2'], async (err, keys) => {
            if (!keys || keys.length === 0) {
                return res.status(400).json({ error: 'No FIDO2 keys registered' });
            }
            const options = await generateAuthenticationOptions({
                rpID: RP_ID,
                userVerification: 'preferred',
                allowCredentials: keys.map(k => ({
                    id: k.credential_id,
                    transports: JSON.parse(k.transports || '[]'),
                })),
            });
            setChallenge(`fido2_login_${userId}`, options.challenge);
            res.json(options);
        });
    } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired session' });
    }
});

/* FIDO2 2FA login verify */
app.post('/api/fido2/verify', loginLimiter, async (req, res) => {
    const { tempToken, ...assertionResponse } = req.body;
    if (!tempToken) return res.status(400).json({ error: 'Missing tempToken' });
    try {
        const decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
        const userId = decoded.temp_id;
        const expectedChallenge = consumeChallenge(`fido2_login_${userId}`);
        if (!expectedChallenge) return res.status(400).json({ error: '挑战已过期，请重新登录' });

        db.get('SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ? AND type = ?',
            [assertionResponse.id, userId, 'fido2'], async (err, key) => {
            if (!key) return res.status(400).json({ error: '未找到对应的安全密钥' });
            try {
                const verification = await verifyAuthenticationResponse({
                    response: assertionResponse,
                    expectedChallenge,
                    expectedOrigin: ORIGIN,
                    expectedRPID: RP_ID,
                    authenticator: {
                        credentialID: Buffer.from(key.credential_id, 'base64url'),
                        credentialPublicKey: Buffer.from(key.public_key, 'base64url'),
                        counter: key.counter,
                    }
                });
                if (verification.verified) {
                    db.run('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, key.id]);
                    db.get('SELECT * FROM users WHERE id = ?', [userId], (err2, user) => {
                        if (!user) return res.status(400).json({ error: 'User not found' });
                        setAuthCookie(res, user);
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

app.post('/api/logout', (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            if (decoded.jti && decoded.exp) {
                revokedTokensCache.set(decoded.jti, decoded.exp * 1000);
            }
        } catch (e) {
            // ignore
        }
    }
    res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
    res.json({ success: true });
});

app.post('/api/logout-all', authenticateJWT, (req, res) => {
    const userId = req.user.id;
    const newVersion = (tokenVersionCache.get(userId) || 0) + 1;
    db.run('UPDATE users SET token_version = ? WHERE id = ?', [newVersion, userId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        tokenVersionCache.set(userId, newVersion);
        res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
        res.json({ success: true });
    });
});

app.get('/admin', authenticateJWT, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.get(['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/logo.png', '/logo.svg', '/icon.png', '/icon.svg'], (req, res) => {
    res.redirect(302, '/favicon.svg');
});


/* ── Security Migrations ── */
db.serialize(() => {
    // 1. Fix state confusion
    db.run(`UPDATE users SET two_fa_method = 'totp' WHERE totp_secret IS NOT NULL AND two_fa_method IS NULL AND id NOT IN (SELECT DISTINCT user_id FROM passkeys WHERE type = 'fido2')`, (err) => {
        if (err) console.error('[Migration] Failed to fix two_fa_method state:', err.message);
        else console.log('[Migration] State confusion fix applied.');
    });

    // 2. Encrypt plaintext TOTP secrets
    db.all(`SELECT id, totp_secret, totp_pending_secret FROM users`, (err, users) => {
        if (err) return console.error('[Migration] Failed to fetch users for encryption:', err.message);
        let migratedCount = 0;
        users.forEach(u => {
            let needsUpdate = false;
            let newTotp = u.totp_secret;
            let newPending = u.totp_pending_secret;

            if (newTotp && !newTotp.startsWith('enc:')) {
                newTotp = encrypt(newTotp);
                needsUpdate = true;
            }
            if (newPending && !newPending.startsWith('enc:')) {
                newPending = encrypt(newPending);
                needsUpdate = true;
            }

            if (needsUpdate) {
                db.run(`UPDATE users SET totp_secret = ?, totp_pending_secret = ? WHERE id = ?`, [newTotp, newPending, u.id]);
                migratedCount++;
            }
        });
        if (migratedCount > 0) console.log(`[Migration] Encrypted TOTP secrets for ${migratedCount} users.`);
    });
});

const port = process.env.PORT || 3000;

/* ── OIDC Provider Startup & Catch-all Routing ── */
(async () => {
    try {
        // Dynamically import the ESM oidc module from CJS context
        const { default: oidcProvider } = await import('./oidc.mjs');

        // 1. Mount the custom interaction route
        app.get('/oidc/interaction/:uid', async (req, res) => {
            try {
                const interaction = await oidcProvider.interactionDetails(req, res);

                const token = req.cookies[COOKIE_NAME];
                if (token) {
                    try {
                        const jwt = require('jsonwebtoken');
                        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
                        if (decoded.token_version === currentVersion && (!decoded.jti || !revokedTokensCache.has(decoded.jti))) {
                            const result = { login: { accountId: String(decoded.id) } };
                            return await oidcProvider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
                        }
                    } catch (e) {}
                }

                const returnTo = `/oidc/interaction/${interaction.uid}`;
                return res.redirect(`/?rd=${encodeURIComponent(returnTo)}`);
            } catch (e) {
                console.error('[OIDC Interaction]', e.message);
                return res.status(500).send('OIDC interaction error');
            }
        });

        // DEBUG MIDDLEWARE FOR OIDC
        app.use('/oidc', (req, res, next) => {
            console.log(`[OIDC Request] method=${req.method} url=${req.url} originalUrl=${req.originalUrl} host=${req.headers.host} proto=${req.headers['x-forwarded-proto']}`);
            next();
        });

        // 2. Mount the full OIDC provider middleware BEFORE the wildcard route!
        app.use('/oidc', oidcProvider.callback());

        console.log(`[OIDC] Provider mounted at ${process.env.OIDC_ISSUER || `https://${process.env.RP_ID}`}/oidc`);
        console.log(`[OIDC] Discovery: ${process.env.OIDC_ISSUER || `https://${process.env.RP_ID}`}/oidc/.well-known/openid-configuration`);
    } catch (e) {
        console.error('[OIDC] Failed to initialize OIDC provider:', e.message);
        console.warn('[OIDC] Server will start WITHOUT OIDC support.');
    }

    // 3. Mount the wildcard route LAST, so it only catches unmatched requests (like React SPA routing)
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    
    // 4. Finally mount the error handler
    app.use((err, req, res, next) => {
        console.error('[Error]', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    app.listen(port, () => console.log(`Situla Auth 2.0 listening on port ${port}`));
})();
