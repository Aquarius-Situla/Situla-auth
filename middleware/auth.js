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
    
    const fail = (msg) => {
        if (req.path === '/admin') return res.redirect(302, '/');
        res.status(401).json({ error: msg || 'Unauthorized' });
    };

    if (!token) return fail();
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentVersion = tokenVersionCache.get(decoded.id) || 0;
        if (decoded.token_version !== currentVersion) return fail('Session expired');
        if (decoded.jti && revokedTokensCache.has(decoded.jti)) return fail('Session revoked');
        req.user = decoded;
        next();
    } catch {
        fail();
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
    let rawIp = req.headers['cf-connecting-ip'] || 
                req.headers['x-real-ip'] || 
                req.headers['x-forwarded-for'] || 
                req.socket.remoteAddress || 
                'Unknown';
    
    if (typeof rawIp === 'string' && rawIp.includes(',')) {
        rawIp = rawIp.split(',')[0].trim();
    }
    
    const cleanIp = String(rawIp).replace(/^::ffff:/, '').replace(/^\[|\]$/g, '').trim();
    const ua = req.headers['user-agent'] || 'Unknown Device';
    
    let device = '未知设备';
    if (ua.includes('iPhone')) device = 'iPhone';
    else if (ua.includes('iPad')) device = 'iPad';
    else if (ua.includes('Android')) device = 'Android 设备';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) device = 'Mac';
    else if (ua.includes('Windows')) device = 'Windows PC';
    else if (ua.includes('Linux')) device = 'Linux';
    
    let location = '未知位置';
    const isPrivate = !cleanIp || 
                      cleanIp === 'Unknown' ||
                      cleanIp === '::1' || 
                      cleanIp === '127.0.0.1' || 
                      cleanIp === 'localhost' ||
                      cleanIp.startsWith('10.') || 
                      cleanIp.startsWith('192.168.') || 
                      cleanIp.startsWith('172.16.') || 
                      cleanIp.startsWith('172.17.') || 
                      cleanIp.startsWith('172.18.') || 
                      cleanIp.startsWith('172.19.') || 
                      cleanIp.startsWith('172.2') || 
                      cleanIp.startsWith('172.3') || 
                      cleanIp.startsWith('fc00:') || 
                      cleanIp.startsWith('fd00:') || 
                      cleanIp.startsWith('fe80:');
    
    if (isPrivate) {
        location = '局域网';
    } else {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(cleanIp)}?lang=zh-CN`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.status === 'success') {
                    const parts = [data.country, data.regionName, data.city].filter(Boolean);
                    const unique = [...new Set(parts)];
                    location = unique.join(' ') || data.country || '未知位置';
                }
            }
        } catch (e) {
            if (req.headers['cf-ipcountry']) {
                location = req.headers['cf-ipcountry'];
            }
        }
    }
    
    db.run('INSERT INTO login_logs (user_id, ip, location, device) VALUES (?, ?, ?, ?)',
           [userId, cleanIp.substring(0, 64), location, device], (err) => {
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



/**
 * Verify if the user is elevated (sudo mode) or check their password.
 * If password is correct, sets the elevation cookie (15m).
 * Returns true if allowed, false if not.
 * If requireElevation response is sent, returns false and the caller should return.
 */
async function verifyElevationOrPassword(req, res, password) {
    const ELEVATION_COOKIE = 'situla_elevation';
    const JWT_SECRET = req.app.get('JWT_SECRET');
    const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');

    const pwd = password || req.body?.currentPassword;

    if (pwd) {
        // Check password
        const userId = req.user.id;
        const user = await new Promise((resolve) => {
            db.get('SELECT password FROM users WHERE id = ?', [userId], (err, row) => resolve(row));
        });
        if (!user) {
            res.status(401).json({ success: false, message: 'User not found' });
            return false;
        }
        const passwordOk = await verifyPassword(pwd, user.password, userId);
        if (passwordOk) {
            // Set elevation cookie
            const elevationToken = jwt.sign({ id: userId, elevated: true }, JWT_SECRET, { expiresIn: '15m' });
            res.cookie(ELEVATION_COOKIE, elevationToken, {
                httpOnly: true, secure: true, domain: COOKIE_DOMAIN,
                maxAge: 15 * 60 * 1000, sameSite: 'Lax'
            });
            return true;
        }
        res.status(401).json({ success: false, message: '密码错误，请重试' });
        return false;
    } else {
        // No password provided, check elevation cookie
        const elevationToken = req.cookies[ELEVATION_COOKIE];
        if (!elevationToken) {
            res.status(401).json({ success: false, message: '需要密码确认', requireElevation: true });
            return false;
        }
        try {
            const decoded = jwt.verify(elevationToken, JWT_SECRET, { algorithms: ['HS256'] });
            if (decoded.id === req.user.id && decoded.elevated) {
                // Refresh elevation cookie to reset the 15m timer
                const newElevationToken = jwt.sign({ id: req.user.id, elevated: true }, JWT_SECRET, { expiresIn: '15m' });
                res.cookie(ELEVATION_COOKIE, newElevationToken, {
                    httpOnly: true, secure: true, domain: COOKIE_DOMAIN,
                    maxAge: 15 * 60 * 1000, sameSite: 'Lax'
                });
                return true;
            }
        } catch {
            // Token expired or invalid
        }
        res.status(401).json({ success: false, message: '特权会话已过期，请重新输入密码', requireElevation: true });
        return false;
    }
}

module.exports = {
    verifyElevationOrPassword,
    authenticateJWT,
    requireStepUpAuth,
    setAuthCookie,
    verifyPassword,
    tokenVersionCache,
    revokedTokensCache,
    COOKIE_NAME,
    SALT_ROUNDS,
};
