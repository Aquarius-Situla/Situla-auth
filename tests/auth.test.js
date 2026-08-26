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
