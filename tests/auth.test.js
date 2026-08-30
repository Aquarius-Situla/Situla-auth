/**
 * tests/auth.test.js
 * Smoke tests for authentication routes.
 */
'use strict';

const request = require('supertest');
const { createApp, seedTestUser } = require('./helpers/testApp');

let app;
let sessionCookie;

beforeAll(async () => {
    app = createApp();
    await seedTestUser();
});

describe('POST /api/login', () => {
    test('rejects wrong password', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'testuser', password: 'WrongPassword!' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('accepts correct credentials', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'testuser', password: 'TestPassword123!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // Capture session cookie for subsequent tests
        sessionCookie = res.headers['set-cookie']?.[0];
        expect(sessionCookie).toBeTruthy();
    });

    test('rejects unknown username', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'nobody', password: 'anything' });
        expect(res.status).toBe(401);
    });
});

describe('POST /api/verify-password', () => {
    test('returns 401 without auth cookie', async () => {
        const res = await request(app)
            .post('/api/verify-password')
            .send({ currentPassword: 'TestPassword123!' });
        expect(res.status).toBe(401);
    });

    test('verifies correct password when authenticated', async () => {
        const res = await request(app)
            .post('/api/verify-password')
            .set('Cookie', sessionCookie)
            .send({ currentPassword: 'TestPassword123!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('rejects wrong password when authenticated', async () => {
        const res = await request(app)
            .post('/api/verify-password')
            .set('Cookie', sessionCookie)
            .send({ currentPassword: 'wrongpassword' });
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});

describe('POST /api/logout', () => {
    test('clears session cookie', async () => {
        const res = await request(app)
            .post('/api/logout')
            .set('Cookie', sessionCookie);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('GET /api/trusted-domains', () => {
    test('returns trust roots', async () => {
        const res = await request(app).get('/api/trusted-domains');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.trustedRoots)).toBe(true);
    });
});

describe('FIDO2 2FA & Recovery Code Fallback', () => {
    const db = require('../core/database');
    const RecoveryService = require('../services/recoveryService');
    const WebAuthnService = require('../services/webauthnService');
    let testUserId;
    let tempToken;

    beforeAll(async () => {
        const userRow = await db.get('SELECT id FROM users WHERE username = ?', ['testuser']);
        testUserId = userRow.id;

        // Set two_fa_method to fido2 and add 2 keys (one clean, one legacy double-encoded)
        await db.run('UPDATE users SET two_fa_method = "fido2" WHERE id = ?', [testUserId]);
        const rawKey1 = 'dGVzdF9jcmVkZW50aWFsXzE';
        const legacyKey2 = Buffer.from('dGVzdF9jcmVkZW50aWFsXzI').toString('base64url');

        await db.run(
            'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, type) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, rawKey1, 'pub1', 0, 'Hardware Key 1', 'fido2']
        );
        await db.run(
            'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, type) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, legacyKey2, 'pub2', 0, 'Hardware Key 2', 'fido2']
        );
    });

    afterAll(async () => {
        await db.run('UPDATE users SET two_fa_method = NULL WHERE id = ?', [testUserId]);
        await db.run('DELETE FROM passkeys WHERE user_id = ?', [testUserId]);
    });

    test('login with password returns requireTotp with twoFaMethod = fido2 and tempToken', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'testuser', password: 'TestPassword123!' });

        expect(res.status).toBe(200);
        expect(res.body.requireTotp).toBe(true);
        expect(res.body.twoFaMethod).toBe('fido2');
        expect(res.body.tempToken).toBeTruthy();
        tempToken = res.body.tempToken;
    });

    test('/api/fido2/challenge returns WebAuthn options with normalized allowCredentials', async () => {
        const res = await request(app)
            .post('/api/fido2/challenge')
            .send({ tempToken });

        expect(res.status).toBe(200);
        expect(res.body.challenge).toBeTruthy();
        expect(Array.isArray(res.body.allowCredentials)).toBe(true);
        expect(res.body.allowCredentials.length).toBe(2);

        // Verify normalized credential IDs
        const ids = res.body.allowCredentials.map(c => c.id);
        expect(ids).toContain('dGVzdF9jcmVkZW50aWFsXzE');
        expect(ids).toContain('dGVzdF9jcmVkZW50aWFsXzI');
    });

    test('supports logging in via recovery code during FIDO2 2FA', async () => {
        const codes = await RecoveryService.generateCodes(testUserId);
        const res = await request(app)
            .post('/api/login')
            .send({ tempToken, totp: codes[0] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.usedRecoveryCode).toBe(true);
        expect(res.headers['set-cookie']).toBeTruthy();
    });
});

