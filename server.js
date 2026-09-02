/*
 * Situla Auth 2.0
 * Copyright (C) 2026 Situla
 * Clean, Modular Auth Portal & OIDC Provider
 */
'use strict';

require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const db = require('./core/database');
const {
    encrypt,
    decrypt,
    randomHex,
    assertProductionKeySecurity,
    JWT_SECRET: DEFAULT_JWT_SECRET,
    ENCRYPTION_KEY: DEFAULT_ENC_KEY
} = require('./core/crypto');
const AuthService = require('./services/authService');
const { authenticateJWT, tokenVersionCache, revokedTokensCache } = require('./middleware/auth');

// ── Configuration ──────────────────────────────────────────────────────────
const RAW_RP_ID     = (process.env.RP_ID || 'auth.example.com').trim();
const RP_ID         = RAW_RP_ID.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
const RP_NAME       = 'Situla Auth';
const ORIGIN        = process.env.ORIGIN || (process.env.NODE_ENV === 'production' || RP_ID !== 'localhost' ? `https://${RP_ID}` : `http://${RP_ID}`);
const COOKIE_NAME   = process.env.COOKIE_NAME || 'situla_session';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.example.com';
const JWT_SECRET    = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_ENC_KEY;
const ADMIN_USER    = process.env.ADMIN_USER || 'akadmin';
const ADMIN_PASS_RAW = (process.env.ADMIN_PASS || 'akadmin').replace(/^['"]|['"]$/g, '');

console.log(`[WebAuthn Init] Effective RP_ID: "${RP_ID}", ORIGIN: "${ORIGIN}"`);

// Enforce production secret hygiene
assertProductionKeySecurity(JWT_SECRET, ENCRYPTION_KEY);

// Trusted Redirects Resolution (Scoped domain whitelisting: COOKIE_DOMAIN, RP_ID, TRUSTED_DOMAINS)
function normalizeTrustRoot(entry) {
    if (!entry || typeof entry !== 'string') return '';
    return entry.trim().toLowerCase().replace(/^\*\./, '').replace(/^\./, '');
}

const ALL_TRUST_ROOTS = [...new Set([
    normalizeTrustRoot(COOKIE_DOMAIN),
    normalizeTrustRoot(RP_ID),
    ...(process.env.TRUSTED_DOMAINS || '')
        .split(',')
        .map(normalizeTrustRoot)
].filter(Boolean))];

function isTrustedRedirect(url) {
    if (!url || typeof url !== 'string') return false;
    // Allow safe internal relative paths (avoid protocol-relative // or /\)
    if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) {
        return true;
    }
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
        if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') return false;
        const hostname = parsed.hostname.toLowerCase();
        return ALL_TRUST_ROOTS.some(root => {
            if (!root) return false;
            return hostname === root || hostname.endsWith('.' + root);
        });
    } catch {
        return false;
    }
}

// ── Application Initialization ─────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);

app.set('JWT_SECRET', JWT_SECRET);
app.set('ENCRYPTION_KEY', ENCRYPTION_KEY);
app.set('COOKIE_NAME', COOKIE_NAME);
app.set('COOKIE_DOMAIN', COOKIE_DOMAIN);
app.set('RP_ID', RP_ID);
app.set('RP_NAME', RP_NAME);
app.set('ORIGIN', ORIGIN);
app.set('ALL_TRUST_ROOTS', ALL_TRUST_ROOTS);

// Limiters
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '尝试次数过多，请 15 分钟后再试。' }
});
const challengeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '请求过于频繁，请稍后再试。' }
});
const sudoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: '操作过于频繁，请稍后再试。' }
});
app.set('loginLimiter', loginLimiter);
app.set('challengeLimiter', challengeLimiter);
app.set('sudoLimiter', sudoLimiter);

// Pre-generated dummy hash for timing-safe login
let DUMMY_HASH = '';
bcrypt.hash('dummy_password_for_timing_protection', 12).then(h => {
    DUMMY_HASH = h;
    app.set('DUMMY_HASH', DUMMY_HASH);
});

// Middleware Stack
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

// ── Core Routes & Middleware ───────────────────────────────────────────────
// Auto-redirect logged-in users away from login page
app.get(['/', '/index.html'], (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
            const currentVersion = tokenVersionCache.get(decoded.id) || 0;
            if (decoded.token_version === currentVersion && (!decoded.jti || !revokedTokensCache.has(decoded.jti))) {
                const rd = req.query.rd;
                if (!rd) return res.redirect(302, '/admin');
                if (isTrustedRedirect(rd)) return res.redirect(302, rd);
                return res.redirect(302, `/warning.html?rd=${encodeURIComponent(rd)}`);
            }
        } catch (e) {}
    }
    next();
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const row = await db.get('SELECT 1 as alive');
        if (!row || row.alive !== 1) throw new Error('Database check failed');
        res.status(200).json({
            status: 'healthy',
            uptime: Math.floor(process.uptime()),
            db: 'connected',
            version: '2.0.0',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({
            status: 'unhealthy',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// NGINX Forward Auth
const PUBLIC_AUTH_PATHS = new Set([
    '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png',
    '/logo.png', '/logo.svg', '/icon.png', '/icon.svg', '/robots.txt',
    '/site.webmanifest', '/manifest.json', '/browserconfig.xml',
    '/assets/branding/favicon.svg'
]);

app.get('/verify', (req, res) => {
    const rawUri = req.headers['x-forwarded-uri'] || req.headers['x-original-uri'] || '';
    let pathname = '';
    try {
        pathname = path.posix.normalize(decodeURIComponent(rawUri.split('?')[0])).toLowerCase();
    } catch {
        pathname = path.posix.normalize(rawUri.split('?')[0]).toLowerCase();
    }
    if (PUBLIC_AUTH_PATHS.has(pathname)) return res.status(200).send('OK');

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
    } catch {
        res.status(401).send('Unauthorized');
    }
});

// Mount Routes
app.use('/api',                require('./routes/auth'));
app.use('/api',                require('./routes/account'));
app.use('/api',                require('./routes/logs'));
app.use('/api/webauthn',       require('./routes/passkey'));
app.use('/api/passkeys',       require('./routes/passkey'));
app.use('/api/fido2',          require('./routes/fido2'));
app.use('/api/2fa',            require('./routes/fido2'));
app.use('/api/totp',           require('./routes/totp'));
app.use('/api/recovery-codes', require('./routes/recovery'));
app.use('/api/oidc/clients',   require('./routes/oidc-clients'));
app.use('/api/auth',           require('./routes/auth'));

// Admin UI Page
app.get('/admin', authenticateJWT, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// First-run: seed admin user & cleanup corrupted keys
db.ready().then(async () => {
    const existing = await db.get('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (!existing) {
        const hashed = await bcrypt.hash(ADMIN_PASS_RAW, 12);
        const nowIso = new Date().toISOString();
        await db.run('INSERT INTO users (username, password, password_updated_at) VALUES (?, ?, ?)', [ADMIN_USER, hashed, nowIso]);
        console.log(`[Seed] Initial admin user "${ADMIN_USER}" created.`);
    }

    try {
        const cleanupResult = await db.run("DELETE FROM passkeys WHERE credential_id IS NULL OR trim(credential_id) = ''");
        if (cleanupResult && cleanupResult.changes > 0) {
            console.log(`[DB Cleanup] Pruned ${cleanupResult.changes} legacy corrupted empty key(s).`);
        }
    } catch (e) {}
});

// OIDC Provider & Server Boot
const port = process.env.PORT || 3000;
(async () => {
    try {
        const { default: oidcProvider } = await import('./oidc.mjs');

        app.get('/oidc/interaction/:uid', async (req, res) => {
            try {
                const interaction = await oidcProvider.interactionDetails(req, res);
                const token = req.cookies[COOKIE_NAME];
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
                        if (decoded.token_version === currentVersion && (!decoded.jti || !revokedTokensCache.has(decoded.jti))) {
                            return await oidcProvider.interactionFinished(
                                req, res, { login: { accountId: String(decoded.id) } }, { mergeWithLastSubmission: false }
                            );
                        }
                    } catch (e) {}
                }
                return res.redirect(`/?rd=${encodeURIComponent(`/oidc/interaction/${interaction.uid}`)}`);
            } catch (e) {
                console.error('[OIDC Interaction Error]:', e.message);
                return res.status(500).send('OIDC interaction error');
            }
        });

        app.use('/oidc', (req, res, next) => {
            req.headers.host = RP_ID;
            req.headers['x-forwarded-proto'] = 'https';
            oidcProvider.callback()(req, res, next);
        });

        console.log(`[OIDC] Mounted at https://${RP_ID}/oidc`);
    } catch (e) {
        console.error('[OIDC] Init failed:', e.message);
    }

    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

    app.use((err, req, res, next) => {
        console.error('[Error]', err.stack);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    app.listen(port, () => console.log(`Situla Auth 2.0 running on port ${port}`));
})();
