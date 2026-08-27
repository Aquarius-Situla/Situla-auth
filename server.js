/*
 * Situla Auth 2.0
 * Copyright (C) 2026 Situla
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 */

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');

const db = require('./database');

// 鈹€鈹€ Routes 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const authRoutes        = require('./routes/auth');
const accountRoutes     = require('./routes/account');
const passkeyRoutes     = require('./routes/passkey');
const fido2Routes       = require('./routes/fido2');
const totpRoutes        = require('./routes/totp');
const recoveryRoutes    = require('./routes/recovery');
const oidcClientRoutes  = require('./routes/oidc-clients');

// 鈹€鈹€ Config 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const COOKIE_NAME   = process.env.COOKIE_NAME   || 'situla_session';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.example.com';
const RP_ID         = process.env.RP_ID         || 'auth.example.com';
const RP_NAME       = 'Situla Auth';
const ORIGIN        = `https://${RP_ID}`;
const SALT_ROUNDS   = 12;
const ADMIN_USER    = process.env.ADMIN_USER || 'akadmin';
const ADMIN_PASS_RAW = (process.env.ADMIN_PASS || '').replace(/^['"]|['"]$/g, '');

// 鈹€鈹€ Auto-generate secrets if missing 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const PLACEHOLDER   = 'change_this_to_a_long_random_secret';
const DEFAULT_LEGACY = 'situla_default_secret_please_change';

let JWT_SECRET      = process.env.JWT_SECRET;
let ENCRYPTION_KEY  = process.env.ENCRYPTION_KEY;
let envUpdated      = false;

if (!JWT_SECRET || JWT_SECRET === PLACEHOLDER || JWT_SECRET === DEFAULT_LEGACY) {
    JWT_SECRET = crypto.randomBytes(32).toString('hex');
    console.log('[startup] JWT_SECRET not set 鈥?generated a new random secret.');
    envUpdated = true;
}
if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    console.log('[startup] ENCRYPTION_KEY not set 鈥?generated a new random key.');
    envUpdated = true;
}
if (envUpdated) {
    const envPath = path.join(__dirname, '.env');
    try {
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (/^JWT_SECRET=.*/m.test(envContent)) {
            envContent = envContent.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${JWT_SECRET}`);
        } else {
            envContent += `\nJWT_SECRET=${JWT_SECRET}\n`;
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

// 鈹€鈹€ Encryption utilities 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function encrypt(text) {
    if (!text || text.startsWith('enc:')) return text;
    try {
        const iv = crypto.randomBytes(12);
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
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(parts[3], 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        console.error('[Encryption] Failed to decrypt:', e.message);
        throw e;
    }
}

// 鈹€鈹€ Trusted redirect domains 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
function deriveDefaultTrustRoot(rpId) {
    const parts = rpId.split('.');
    if (parts.length <= 2) return rpId;
    return parts.slice(1).join('.');
}
const DEFAULT_TRUST_ROOT = deriveDefaultTrustRoot(RP_ID);
const EXTRA_TRUST_ROOTS = (process.env.TRUSTED_DOMAINS || '')
    .split(',').map(d => d.trim().toLowerCase().replace(/^\*\./, '')).filter(Boolean);
const ALL_TRUST_ROOTS = [...new Set([DEFAULT_TRUST_ROOT, ...EXTRA_TRUST_ROOTS])];

function isTrustedRedirect(url) {
    if (url && url.startsWith('/oidc/interaction/')) return true;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return ALL_TRUST_ROOTS.some(root => hostname === root || hostname.endsWith('.' + root));
    } catch { return false; }
}

// 鈹€鈹€ App setup 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const app = express();
app.set('trust proxy', 1);

// Store shared config on app so routes can read it without circular imports
app.set('JWT_SECRET',    JWT_SECRET);
app.set('ENCRYPTION_KEY', ENCRYPTION_KEY);
app.set('COOKIE_NAME',   COOKIE_NAME);
app.set('COOKIE_DOMAIN', COOKIE_DOMAIN);
app.set('RP_ID',         RP_ID);
app.set('RP_NAME',       RP_NAME);
app.set('ORIGIN',        ORIGIN);
app.set('ALL_TRUST_ROOTS', ALL_TRUST_ROOTS);

// Store shared functions on app.locals so routes can call them
app.locals.encrypt   = encrypt;
app.locals.decrypt   = decrypt;
app.locals.userChallenges = new Map(); // shared challenge store

// Rate limiter (stored on app so routes can use it)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts, please try again in 15 minutes.' }
});
app.set('loginLimiter', loginLimiter);

// Periodically clean up stale challenges
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of app.locals.userChallenges) {
        if (now > entry.expiresAt) app.locals.userChallenges.delete(key);
    }
}, 10 * 60 * 1000);

app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc:  ["'self'"],
            styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
            imgSrc:     ["'self'", 'data:'],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// 鈹€鈹€ Auto-redirect logged-in users away from login page 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
app.get(['/', '/index.html'], (req, res, next) => {
    const { tokenVersionCache, revokedTokensCache } = require('./middleware/auth');
    const jwt = require('jsonwebtoken');
    try {
        const token = req.cookies?.[COOKIE_NAME];
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
    next();
});

app.use(express.static('public'));

// 鈹€鈹€ NGINX Forward Auth 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
app.get('/verify', (req, res) => {
    const { tokenVersionCache, revokedTokensCache } = require('./middleware/auth');
    const jwt = require('jsonwebtoken');
    const originalUri = req.headers['x-forwarded-uri'] || req.headers['x-original-uri'] || '';
    const pathname = originalUri.split('?')[0].toLowerCase();
    const publicPaths = ['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
        '/logo.png', '/logo.svg', '/icon.png', '/icon.svg', '/robots.txt',
        '/site.webmanifest', '/manifest.json', '/browserconfig.xml'];
    if (publicPaths.includes(pathname)) return res.status(200).send('OK');

    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).send('Unauthorized');
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
        if (decoded.token_version !== currentVersion) return res.status(401).send('Unauthorized');
        if (decoded.jti && revokedTokensCache.has(decoded.jti)) return res.status(401).send('Unauthorized');
        if (decoded.user)  { res.setHeader('X-Remote-User', decoded.user);   res.setHeader('Remote-User', decoded.user); }
        if (decoded.email) { res.setHeader('X-Remote-Email', decoded.email); res.setHeader('Remote-Email', decoded.email); }
        res.status(200).send('OK');
    } catch { res.status(401).send('Unauthorized'); }
});

// 鈹€鈹€ Mount API routes 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
app.use('/api',                authRoutes);
app.use('/api',                accountRoutes);
app.use('/api',                logsRoutes);
app.use('/api/webauthn',       passkeyRoutes);
app.use('/api/passkeys',       passkeyRoutes);   // aliased for list/delete/rename
app.use('/api/fido2',          fido2Routes);
app.use('/api/2fa',            fido2Routes);      // /api/2fa/enable is in fido2Routes
app.use('/api/totp',           totpRoutes);
app.use('/api/recovery-codes', recoveryRoutes);
app.use('/api/oidc/clients',   oidcClientRoutes);
app.use('/api/auth',           authRoutes);       // /api/auth/elevate/totp

// 鈹€鈹€ Admin page 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const { authenticateJWT } = require('./middleware/auth');
app.get('/admin', authenticateJWT, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
         '/logo.png', '/logo.svg', '/icon.png', '/icon.svg'], (req, res) => {
    res.redirect(302, '/favicon.svg');
});

// 鈹€鈹€ First-run: seed admin user 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
db.get('SELECT * FROM users ORDER BY id ASC LIMIT 1', async (err, row) => {
    if (err) { console.error(err); return; }
    if (!row) {
        const hashed = await bcrypt.hash(ADMIN_PASS_RAW, SALT_ROUNDS);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [ADMIN_USER, hashed]);
    }
});

// 鈹€鈹€ Security migrations 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
db.serialize(() => {
    db.run(`UPDATE users SET two_fa_method = 'totp' WHERE totp_secret IS NOT NULL AND two_fa_method IS NULL AND id NOT IN (SELECT DISTINCT user_id FROM passkeys WHERE type = 'fido2')`,
        (err) => { if (err) console.error('[Migration]', err.message); else console.log('[Migration] State confusion fix applied.'); });
    db.all('SELECT id, totp_secret, totp_pending_secret FROM users', (err, users) => {
        if (err) return;
        let n = 0;
        (users || []).forEach(u => {
            let newTotp = u.totp_secret, newPending = u.totp_pending_secret, changed = false;
            if (newTotp    && !newTotp.startsWith('enc:'))    { newTotp    = encrypt(newTotp);    changed = true; }
            if (newPending && !newPending.startsWith('enc:')) { newPending = encrypt(newPending); changed = true; }
            if (changed) { db.run('UPDATE users SET totp_secret = ?, totp_pending_secret = ? WHERE id = ?', [newTotp, newPending, u.id]); n++; }
        });
        if (n > 0) console.log(`[Migration] Encrypted TOTP secrets for ${n} users.`);
    });
});

// 鈹€鈹€ Pre-generate dummy hash for timing-safe login 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
let DUMMY_HASH = '';
(async () => { DUMMY_HASH = await bcrypt.hash('dummy_password_for_timing_protection', SALT_ROUNDS); app.set('DUMMY_HASH', DUMMY_HASH); })();

// 鈹€鈹€ OIDC Provider + server start 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const port = process.env.PORT || 3000;

(async () => {
    try {
        const { default: oidcProvider } = await import('./oidc.mjs');

        app.get('/oidc/interaction/:uid', async (req, res) => {
            try {
                const interaction = await oidcProvider.interactionDetails(req, res);
                const { tokenVersionCache, revokedTokensCache } = require('./middleware/auth');
                const jwt = require('jsonwebtoken');
                const token = req.cookies[COOKIE_NAME];
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
                        if (decoded.token_version === currentVersion && (!decoded.jti || !revokedTokensCache.has(decoded.jti))) {
                            return await oidcProvider.interactionFinished(req, res, { login: { accountId: String(decoded.id) } }, { mergeWithLastSubmission: false });
                        }
                    } catch (e) {}
                }
                return res.redirect(`/?rd=${encodeURIComponent(`/oidc/interaction/${interaction.uid}`)}`);
            } catch (e) {
                console.error('[OIDC Interaction]', e.message);
                return res.status(500).send('OIDC interaction error');
            }
        });

        app.use('/oidc', (req, res, next) => {
            req.headers.host = process.env.RP_ID || 'auth.aquanexus.me';
            req.headers['x-forwarded-proto'] = 'https';
            oidcProvider.callback()(req, res, next);
        });

        console.log(`[OIDC] Provider mounted at ${process.env.OIDC_ISSUER || `https://${RP_ID}`}/oidc`);
    } catch (e) {
        console.error('[OIDC] Failed to initialize:', e.message);
        console.warn('[OIDC] Server will start WITHOUT OIDC support.');
    }

    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
    app.use((err, req, res, next) => {
        console.error('[Error]', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    app.listen(port, () => console.log(`Situla Auth 2.0 listening on port ${port}`));
})();

