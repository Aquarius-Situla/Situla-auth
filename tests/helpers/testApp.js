/**
 * tests/helpers/testApp.js
 * Creates an isolated Express app with an in-memory SQLite DB for testing.
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

// Use in-memory SQLite for tests
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_chars_long';
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.COOKIE_DOMAIN = 'localhost';
process.env.RP_ID = 'localhost';
process.env.COOKIE_NAME = 'test_session';

const db = require('../../core/database');
const { encrypt, decrypt } = require('../../core/crypto');
const AuthService = require('../../services/authService');

async function seedTestUser() {
    await db.ready();
    await db.run('DELETE FROM users');
    const hash = await bcrypt.hash('TestPassword123!', 10);
    const nowIso = new Date().toISOString();
    const result = await db.run(
        'INSERT INTO users (username, password, email, password_updated_at) VALUES (?, ?, ?, ?)',
        ['testuser', hash, 'test@example.com', nowIso]
    );
    AuthService.tokenVersionCache.set(result.lastID, 0);
    return result.lastID;
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    const JWT_SECRET = process.env.JWT_SECRET;
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
    const RP_ID = process.env.RP_ID;

    const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
    const sudoLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

    app.set('JWT_SECRET', JWT_SECRET);
    app.set('ENCRYPTION_KEY', ENCRYPTION_KEY);
    app.set('COOKIE_NAME', process.env.COOKIE_NAME);
    app.set('COOKIE_DOMAIN', COOKIE_DOMAIN);
    app.set('RP_ID', RP_ID);
    app.set('RP_NAME', 'Test Auth');
    app.set('ORIGIN', `https://${RP_ID}`);
    app.set('ALL_TRUST_ROOTS', ['localhost']);
    app.set('loginLimiter', loginLimiter);
    app.set('sudoLimiter', sudoLimiter);

    app.use('/api',                require('../../routes/auth'));
    app.use('/api',                require('../../routes/account'));
    app.use('/api/passkeys',       require('../../routes/passkey'));
    app.use('/api/fido2',          require('../../routes/fido2'));
    app.use('/api/2fa',            require('../../routes/fido2'));
    app.use('/api/totp',           require('../../routes/totp'));
    app.use('/api/recovery-codes', require('../../routes/recovery'));
    app.use('/api/oidc/clients',   require('../../routes/oidc-clients'));

    return app;
}

module.exports = { createApp, seedTestUser };
