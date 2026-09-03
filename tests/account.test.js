/**
 * tests/account.test.js
 * Smoke tests for account management routes.
 */
'use strict';

const request = require('supertest');
const { createApp, seedTestUser } = require('./helpers/testApp');

let app;
let sessionCookie;

beforeAll(async () => {
    app = createApp();
    await seedTestUser();
    // Log in to get a session cookie
    const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'TestPassword123!' });
    sessionCookie = res.headers['set-cookie']?.[0];
});

describe('GET /api/status', () => {
    test('requires authentication', async () => {
        const res = await request(app).get('/api/status');
        expect(res.status).toBe(401);
    });

    test('returns user status when authenticated', async () => {
        const res = await request(app)
            .get('/api/status')
            .set('Cookie', sessionCookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('email');
        expect(res.body).toHaveProperty('passkeys');
        expect(res.body).toHaveProperty('fido2Keys');
        expect(res.body).toHaveProperty('recoveryCodesRemaining');
        expect(res.body).toHaveProperty('passwordUpdatedAt');
    });

    test('email is masked in non-elevated state', async () => {
        const res = await request(app)
            .get('/api/status')
            .set('Cookie', sessionCookie);
        expect(res.status).toBe(200);
        // Should be masked: test@example.com → t*****@example.com
        expect(res.body.email).toMatch(/\*{5}/);
        expect(res.body.email).toContain('@example.com');
        // fullEmail should NOT be present when not elevated
        expect(res.body.fullEmail).toBeUndefined();

        // Edge case tests for AccountService._maskEmail
        const AccountService = require('../services/accountService');
        expect(AccountService._maskEmail('bob@example.com')).toBe('b*****@example.com');
        expect(AccountService._maskEmail('ab@example.com')).toBe('a*****@example.com');
        expect(AccountService._maskEmail('alice@example.com')).toBe('al*****@example.com');
    });
});

describe('POST /api/change-username', () => {
    test('requires authentication', async () => {
        const res = await request(app)
            .post('/api/change-username')
            .send({ newUsername: 'hacker', currentPassword: 'anything' });
        expect(res.status).toBe(401);
    });

    test('rejects wrong current password', async () => {
        const res = await request(app)
            .post('/api/change-username')
            .set('Cookie', sessionCookie)
            .send({ newUsername: 'newname', currentPassword: 'WrongPassword!' });
        expect(res.status).toBe(401);
    });

    test('rejects empty username', async () => {
        const res = await request(app)
            .post('/api/change-username')
            .set('Cookie', sessionCookie)
            .send({ newUsername: '', currentPassword: 'TestPassword123!' });
        expect(res.status).toBe(400);
    });

    test('changes username with correct password', async () => {
        const res = await request(app)
            .post('/api/change-username')
            .set('Cookie', sessionCookie)
            .send({ newUsername: 'newTestUser', currentPassword: 'TestPassword123!' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('POST /api/change-password', () => {
    test('rejects passwords shorter than 12 chars', async () => {
        const res = await request(app)
            .post('/api/change-password')
            .set('Cookie', sessionCookie)
            .send({ currentPassword: 'TestPassword123!', newPassword: 'short' });
        expect(res.status).toBe(400);
    });

    test('rejects wrong current password', async () => {
        const res = await request(app)
            .post('/api/change-password')
            .set('Cookie', sessionCookie)
            .send({ currentPassword: 'WrongPassword!', newPassword: 'NewValidPassword123!' });
        expect(res.status).toBe(401);
    });
});

describe('POST /api/change-email', () => {
    test('rejects malformed email', async () => {
        const res = await request(app)
            .post('/api/change-email')
            .set('Cookie', sessionCookie)
            .send({ newEmail: 'not-an-email', currentPassword: 'TestPassword123!' });
        expect(res.status).toBe(400);
    });

    test('rejects wrong password', async () => {
        const res = await request(app)
            .post('/api/change-email')
            .set('Cookie', sessionCookie)
            .send({ newEmail: 'valid@example.com', currentPassword: 'WrongPassword!' });
        expect(res.status).toBe(401);
    });
});
