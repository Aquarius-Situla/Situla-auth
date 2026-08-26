/**
 * tests/helpers/testApp.js
 * Creates an isolated Express app with an in-memory SQLite DB for testing.
 * Routes are mounted identically to server.js, but with test-safe config.
 */
'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Use in-memory SQLite for tests (no file I/O)
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_chars_long';
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
process.env.COOKIE_DOMAIN = 'localhost';
process.env.RP_ID = 'localhost';
process.env.COOKIE_NAME = 'test_session';

const db = require('../../database');

// Wait for DB to be ready and seed a test user
async function seedTestUser() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('DELETE FROM users', () => {
                bcrypt.hash('TestPassword123!', 10).then(hash => {
                    db.run(
                        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                        ['testuser', hash, 'test@example.com'],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                });
            });
        });
    });
}

function createApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    const JWT_SECRET = process.env.JWT_SECRET;
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
    const RP_ID = process.env.RP_ID;

    function encrypt(text) {
        if (!text || text.startsWith('enc:')) return text;
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return `enc:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted}`;
    }

    function decrypt(text) {
        if (!text || !text.startsWith('enc:')) return text;
        const parts = text.split(':');
        const iv = Buffer.from(parts[1], 'base64');
        const authTag = Buffer.from(parts[2], 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
        decipher.setAuthTag(authTag);
        let d = decipher.update(parts[3], 'base64', 'utf8');
        d += decipher.final('utf8');
        return d;
    }

    const rateLimit = require('express-rate-limit');
    const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }); // relaxed for tests

    app.set('JWT_SECRET', JWT_SECRET);
    app.set('ENCRYPTION_KEY', ENCRYPTION_KEY);
    app.set('COOKIE_NAME', process.env.COOKIE_NAME);
    app.set('COOKIE_DOMAIN', COOKIE_DOMAIN);
    app.set('RP_ID', RP_ID);
    app.set('RP_NAME', 'Test Auth');
    app.set('ORIGIN', `https://${RP_ID}`);
    app.set('ALL_TRUST_ROOTS', ['localhost']);
    app.set('loginLimiter', loginLimiter);
    app.locals.encrypt = encrypt;
    app.locals.decrypt = decrypt;
    app.locals.userChallenges = new Map();

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
