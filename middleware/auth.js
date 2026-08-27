/**
 * middleware/auth.js
 * Shared authentication middleware and utilities.
 * Exported so all route files can import without circular dependencies.
 */
'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database');

const COOKIE_NAME = process.env.COOKIE_NAME || 'situla_session';
const SALT_ROUNDS = 12;

// ── In-memory caches (module-level singletons) ─────────────────────────────
// These MUST be singletons shared across all route files, so we export them.

/** Maps userId → token_version for zero-latency JWT verification */
const tokenVersionCache = new Map();
db.all('SELECT id, token_version FROM users', (err, rows) => {
    if (!err && rows) {
        for (const row of rows) {
            tokenVersionCache.set(row.id, row.token_version || 0);
        }
    }
});

/** Revoked JTIs → expiry timestamp (ms) for stateless session blacklisting */
const revokedTokensCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of revokedTokensCache.entries()) {
        if (now > exp) revokedTokensCache.delete(jti);
    }
}, 60 * 60 * 1000);


// ── Crypto helpers ─────────────────────────────────────────────────────────

/** SHA-256 — only used for migrating legacy admin passwords */
function sha256Hash(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex');
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt (new) and legacy SHA-256 (old) hashes.
 * Auto-migrates SHA-256 to bcrypt on successful login.
 */
async function verifyPassword(plaintext, storedHash, userId) {
    if (!storedHash) return false;
    if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
        return await bcrypt.compare(plaintext, storedHash);
    }
    if (sha256Hash(plaintext) === storedHash) {
        const newHash = await bcrypt.hash(plaintext, SALT_ROUNDS);
        db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
        console.log(`[security] Migrated user ${userId} password from SHA-256 to bcrypt.`);
        return true;
    }
    return false;
}


// ── JWT middleware ─────────────────────────────────────────────────────────

function authenticateJWT(req, res, next) {
    const JWT_SECRET = req.app.get('JWT_SECRET');
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

/** Only allow sensitive operations for sessions authenticated via strong methods */
function requireStepUpAuth(req, res, next) {
    const validMethods = ['passkey', 'totp', 'fido2', 'recovery'];
    if (!validMethods.includes(req.user.auth_method)) {
        return res.status(403).json({
            success: false,
            message: '您的当前会话安全级别过低，请先使用 Passkey 或 2FA 重新登录以管理 OIDC 客户端。'
        });
    }
    next();
}

/**
 * Set the session cookie for a successfully authenticated user.
 * @param {import('express').Response} res
 * @param {{ id: number, username: string, email?: string }} user
 * @param {string} authMethod  e.g. 'password', 'passkey', 'totp', 'fido2'
 */
async function logLogin(req, userId, authMethod) {
    if (!req) return;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
    const ua = req.headers['user-agent'] || 'Unknown Device';
    
    let device = 'Unknown Device';
    if (ua.includes('Windows')) device = 'Windows';
    else if (ua.includes('Macintosh')) device = 'MacBook / iMac';
    else if (ua.includes('iPhone')) device = 'iPhone';
    else if (ua.includes('iPad')) device = 'iPad';
    else if (ua.includes('Android')) device = 'Android Device';
    else if (ua.includes('Linux')) device = 'Linux';
    
    let location = 'Unknown Location';
    try {
        let cleanIp = ip.split(',')[0].trim();
        if (cleanIp !== '::1' && cleanIp !== '127.0.0.1' && !cleanIp.startsWith('192.168.') && !cleanIp.startsWith('10.') && !cleanIp.startsWith('172.16.')) {
            const res = await fetch(`http://ip-api.com/json/${cleanIp}?lang=zh-CN`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success') {
                    location = `${data.country} ${data.city}`;
                }
            }
        } else {
            location = 'Local Network';
        }
    } catch (e) { }
    
    db.run('INSERT INTO login_logs (user_id, ip, location, device) VALUES (?, ?, ?, ?)',
           [userId, ip.substring(0, 45), location, device], (err) => {
               if (err) console.error('Error inserting login log:', err);
           });
}

function setAuthCookie(req, res, user, authMethod = 'unknown') {
    const JWT_SECRET = res.app.get('JWT_SECRET');
    const COOKIE_DOMAIN = res.app.get('COOKIE_DOMAIN');
    const tokenVersion = tokenVersionCache.get(user.id) || 0;
    const token = jwt.sign({
        id: user.id,
        user: user.username,
        email: user.email || '',
        token_version: tokenVersion,
        auth_method: authMethod,
        jti: crypto.randomUUID()
    }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true, secure: true, domain: COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'Lax'
    });
    logLogin(req, user.id, authMethod);
}

module.exports = {
    authenticateJWT,
    requireStepUpAuth,
    setAuthCookie,
    verifyPassword,
    tokenVersionCache,
    revokedTokensCache,
    COOKIE_NAME,
    SALT_ROUNDS,
};
