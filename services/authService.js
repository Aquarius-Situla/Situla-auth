/*
 * Situla Auth 2.0 - Authentication Domain Service
 */
'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../core/database');
const { sha256 } = require('../core/crypto');

const SALT_ROUNDS = 12;
const COOKIE_NAME = process.env.COOKIE_NAME || 'situla_session';
const ELEVATION_COOKIE = 'situla_elevation';

// In-memory caches for zero-latency JWT verification
const tokenVersionCache = new Map();
const revokedTokensCache = new Map();

// Initialize token version & revoked tokens cache
db.ready().then(async () => {
    try {
        const rows = await db.all('SELECT id, token_version FROM users');
        for (const row of rows) {
            tokenVersionCache.set(row.id, row.token_version || 0);
        }
        const now = Date.now();
        await db.run('DELETE FROM revoked_tokens WHERE expires_at < ?', [now]);
        const revokedRows = await db.all('SELECT jti, expires_at FROM revoked_tokens WHERE expires_at >= ?', [now]);
        for (const r of revokedRows) {
            revokedTokensCache.set(r.jti, r.expires_at);
        }
    } catch (err) {
        console.error('[AuthService] Token cache init error:', err);
    }
});

// Periodic cache & DB cleanup (evict expired revoked tokens every 30 minutes)
setInterval(async () => {
    const now = Date.now();
    try {
        await db.run('DELETE FROM revoked_tokens WHERE expires_at < ?', [now]);
    } catch (e) {}
    for (const [jti, exp] of revokedTokensCache.entries()) {
        if (now > exp) revokedTokensCache.delete(jti);
    }
}, 30 * 60 * 1000);

class AuthService {
    static get COOKIE_NAME() {
        return COOKIE_NAME;
    }

    static get tokenVersionCache() {
        return tokenVersionCache;
    }

    static get revokedTokensCache() {
        return revokedTokensCache;
    }

    static async verifyPassword(plaintext, storedHash, userId) {
        if (!storedHash) return false;
        if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
            return await bcrypt.compare(plaintext, storedHash);
        }
        // Legacy SHA-256 migration
        if (sha256(plaintext) === storedHash) {
            const newHash = await bcrypt.hash(plaintext, SALT_ROUNDS);
            await db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
            console.log(`[AuthService] Migrated user ${userId} password from SHA-256 to bcrypt.`);
            return true;
        }
        return false;
    }

    static async hashPassword(plaintext) {
        return await bcrypt.hash(plaintext, SALT_ROUNDS);
    }

    static setAuthCookie(req, res, user, authMethod = 'unknown') {
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');
        const tokenVersion = tokenVersionCache.get(user.id) || 0;
        const jti = crypto.randomUUID();

        const token = jwt.sign({
            id: user.id,
            user: user.username,
            username: user.username,
            email: user.email || '',
            token_version: tokenVersion,
            auth_method: authMethod,
            jti
        }, JWT_SECRET, { expiresIn: '7d' });

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: true,
            domain: COOKIE_DOMAIN,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'Lax'
        });

        // Async audit log
        const auditService = require('./auditService');
        auditService.logLogin(req, user.id, authMethod);
    }

    static async verifyElevationOrPassword(req, res, password) {
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const pwd = password || req.body?.currentPassword;
        const sessionToken = req.cookies[COOKIE_NAME];
        let sessionJti = '';

        if (sessionToken) {
            try {
                const decodedSession = jwt.verify(sessionToken, JWT_SECRET, { algorithms: ['HS256'] });
                sessionJti = decodedSession.jti || '';
            } catch (e) {}
        }

        const MAX_ELEVATION_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes hard absolute timeout

        if (pwd) {
            const userId = req.user.id;
            const user = await db.get('SELECT password FROM users WHERE id = ?', [userId]);
            if (!user) {
                res.status(401).json({ success: false, message: 'User not found' });
                return false;
            }
            const passwordOk = await this.verifyPassword(pwd, user.password, userId);
            if (passwordOk) {
                const currentVersion = tokenVersionCache.get(userId) || 0;
                const elevationToken = jwt.sign({
                    id: userId,
                    elevated: true,
                    elevated_since: Date.now(),
                    session_jti: sessionJti,
                    token_version: currentVersion
                }, JWT_SECRET, { expiresIn: '15m' });

                res.cookie(ELEVATION_COOKIE, elevationToken, {
                    httpOnly: true,
                    secure: true,
                    maxAge: 15 * 60 * 1000,
                    sameSite: 'Lax'
                });
                return true;
            }
            res.status(401).json({ success: false, message: '密码错误，请重试' });
            return false;
        } else {
            const elevationToken = req.cookies[ELEVATION_COOKIE];
            if (!elevationToken) {
                res.status(401).json({ success: false, message: '需要密码确认', requireElevation: true });
                return false;
            }
            try {
                const decoded = jwt.verify(elevationToken, JWT_SECRET, { algorithms: ['HS256'] });
                const currentVersion = tokenVersionCache.get(req.user.id) || 0;
                if (decoded.id === req.user.id && decoded.elevated) {
                    if (decoded.token_version !== undefined && decoded.token_version !== currentVersion) {
                        res.status(401).json({ success: false, message: '特权会话已过期，请重新输入密码', requireElevation: true });
                        return false;
                    }
                    if (decoded.session_jti && sessionJti && decoded.session_jti !== sessionJti) {
                        res.status(401).json({ success: false, message: '特权会话与当前设备不匹配，请重新验证密码', requireElevation: true });
                        return false;
                    }

                    // Enforce absolute maximum elevation lifespan
                    const elevatedSince = decoded.elevated_since || 0;
                    if (!elevatedSince || (Date.now() - elevatedSince > MAX_ELEVATION_LIFETIME_MS)) {
                        res.status(401).json({ success: false, message: '特权会话已达最长有效期，请重新输入密码', requireElevation: true });
                        return false;
                    }

                    // Refresh elevation cookie with preserved elevated_since
                    const newElevationToken = jwt.sign({
                        id: req.user.id,
                        elevated: true,
                        elevated_since: elevatedSince,
                        session_jti: sessionJti,
                        token_version: currentVersion
                    }, JWT_SECRET, { expiresIn: '15m' });

                    res.cookie(ELEVATION_COOKIE, newElevationToken, {
                        httpOnly: true,
                        secure: true,
                        maxAge: 15 * 60 * 1000,
                        sameSite: 'Lax'
                    });
                    return true;
                }
            } catch (e) {}
            res.status(401).json({ success: false, message: '特权会话已过期，请重新输入密码', requireElevation: true });
            return false;
        }
    }

    static logout(req, res) {
        const JWT_SECRET = req.app.get('JWT_SECRET');
        const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');
        const token = req.cookies[COOKIE_NAME];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                if (decoded.jti && decoded.exp) {
                    const expMs = decoded.exp * 1000;
                    revokedTokensCache.set(decoded.jti, expMs);
                    db.run(
                        'INSERT INTO revoked_tokens (jti, expires_at) VALUES (?, ?) ON CONFLICT(jti) DO UPDATE SET expires_at=excluded.expires_at',
                        [decoded.jti, expMs]
                    ).catch(e => console.error('[AuthService] Failed to persist revoked token:', e.message));
                }
            } catch (e) {}
        }
        res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
        res.clearCookie(ELEVATION_COOKIE);
    }

    static async logoutAll(req, res) {
        const COOKIE_DOMAIN = req.app.get('COOKIE_DOMAIN');
        const userId = req.user.id;
        const newVersion = (tokenVersionCache.get(userId) || 0) + 1;
        await db.run('UPDATE users SET token_version = ? WHERE id = ?', [newVersion, userId]);
        tokenVersionCache.set(userId, newVersion);
        res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
        res.clearCookie(ELEVATION_COOKIE);
    }
}

module.exports = AuthService;

