/**
 * middleware/auth.js
 * Authentication and authorization middlewares delegating to domain services.
 */
'use strict';

const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');

function authenticateJWT(req, res, next) {
    const JWT_SECRET = req.app.get('JWT_SECRET');
    const token = req.cookies[AuthService.COOKIE_NAME];
    
    const fail = (msg) => {
        if (req.path === '/admin') return res.redirect(302, '/');
        res.status(401).json({ error: msg || 'Unauthorized' });
    };

    if (!token) return fail();
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        const currentVersion = AuthService.tokenVersionCache.get(decoded.id) || 0;
        if (decoded.token_version !== currentVersion) return fail('Session expired');
        if (decoded.jti && AuthService.revokedTokensCache.has(decoded.jti)) return fail('Session revoked');
        req.user = decoded;
        next();
    } catch {
        fail();
    }
}

/**
 * Step-up authentication requirement for high-security operations
 */
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

module.exports = {
    authenticateJWT,
    requireStepUpAuth,
    verifyElevationOrPassword: (req, res, pwd) => AuthService.verifyElevationOrPassword(req, res, pwd),
    setAuthCookie: (req, res, user, method) => AuthService.setAuthCookie(req, res, user, method),
    verifyPassword: (plain, hash, id) => AuthService.verifyPassword(plain, hash, id),
    tokenVersionCache: AuthService.tokenVersionCache,
    revokedTokensCache: AuthService.revokedTokensCache,
    COOKIE_NAME: AuthService.COOKIE_NAME,
    SALT_ROUNDS: 12
};
