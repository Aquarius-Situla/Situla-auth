/**
 * tests/security.test.js
 * Security integration tests verifying defensive patches against state-sponsored/APT threat models.
 */
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { createApp, seedTestUser } = require('./helpers/testApp');
const db = require('../core/database');
const AuthService = require('../services/authService');
const RecoveryService = require('../services/recoveryService');
const WebAuthnService = require('../services/webauthnService');
const { hmacSha256, assertProductionKeySecurity } = require('../core/crypto');

let app;
let testUserId;
let sessionCookie;

beforeAll(async () => {
    app = createApp();
    testUserId = await seedTestUser();
    const res = await request(app)
        .post('/api/login')
        .send({ username: 'testuser', password: 'TestPassword123!' });
    sessionCookie = res.headers['set-cookie']?.[0];
});

describe('1. Open Redirect & PSL (Public Suffix List) Security', () => {
    test('trusted-domains returns strict root domains without naive PSL splitting', async () => {
        const res = await request(app).get('/api/trusted-domains');
        expect(res.status).toBe(200);
        expect(res.body.trustedRoots).toEqual(['localhost']);
    });

    test('validates redirect URLs against scoped trust roots and rejects open redirects', () => {
        function normalizeTrustRoot(entry) {
            if (!entry || typeof entry !== 'string') return '';
            return entry.trim().toLowerCase().replace(/^\*\./, '').replace(/^\./, '');
        }

        function isTrustedRedirect(url, roots) {
            if (!url || typeof url !== 'string') return false;
            if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return true;
            try {
                const parsed = new URL(url);
                if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
                const hostname = parsed.hostname.toLowerCase();
                return roots.some(root => hostname === root || hostname.endsWith('.' + root));
            } catch {
                return false;
            }
        }

        // 1. Standard Production Domain (.aquanexus.me + auth.aquanexus.me)
        const prodRoots = [...new Set([
            normalizeTrustRoot('.aquanexus.me'),
            normalizeTrustRoot('auth.aquanexus.me')
        ])];
        expect(prodRoots).toEqual(['aquanexus.me', 'auth.aquanexus.me']);
        expect(isTrustedRedirect('https://aquanexus.me', prodRoots)).toBe(true);
        expect(isTrustedRedirect('https://aquanexus.me/', prodRoots)).toBe(true);
        expect(isTrustedRedirect('https://app.aquanexus.me/dashboard', prodRoots)).toBe(true);
        expect(isTrustedRedirect('https://auth.aquanexus.me/admin', prodRoots)).toBe(true);
        expect(isTrustedRedirect('/admin', prodRoots)).toBe(true);

        // Open redirect attack vectors
        expect(isTrustedRedirect('https://evil-aquanexus.me', prodRoots)).toBe(false);
        expect(isTrustedRedirect('https://aquanexus.me.evil.com', prodRoots)).toBe(false);
        expect(isTrustedRedirect('//evil.com', prodRoots)).toBe(false);
        expect(isTrustedRedirect('/\\evil.com', prodRoots)).toBe(false);
        expect(isTrustedRedirect('javascript:alert(1)', prodRoots)).toBe(false);

        // 2. Multi-part Public Suffix TLD safety (e.g. auth.com.gov.uk)
        const govRoots = [...new Set([
            normalizeTrustRoot('auth.com.gov.uk'),
            normalizeTrustRoot('auth.com.gov.uk')
        ])];
        expect(govRoots).toEqual(['auth.com.gov.uk']);
        expect(isTrustedRedirect('https://auth.com.gov.uk/portal', govRoots)).toBe(true);
        expect(isTrustedRedirect('https://other.com.gov.uk', govRoots)).toBe(false);
        expect(isTrustedRedirect('https://com.gov.uk', govRoots)).toBe(false);
        expect(isTrustedRedirect('https://gov.uk', govRoots)).toBe(false);
    });
});

describe('2. FIDO2 2FA Factor Anti-Downgrade Protection', () => {
    test('blocks deletion of FIDO2 keys when 2FA is active and remaining keys <= 2', async () => {
        // Enable FIDO2 2FA for test user and insert 2 dummy keys
        await db.run('UPDATE users SET two_fa_method = "fido2" WHERE id = ?', [testUserId]);
        await db.run(
            'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, type) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, 'cred_key_1', 'pub_key_1', 0, 'Key 1', 'fido2']
        );
        const key2 = await db.run(
            'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, type) VALUES (?, ?, ?, ?, ?, ?)',
            [testUserId, 'cred_key_2', 'pub_key_2', 0, 'Key 2', 'fido2']
        );

        // Attempt to delete one key via API
        const res = await request(app)
            .delete(`/api/fido2/keys/${key2.lastID}`)
            .set('Cookie', sessionCookie);

        expect(res.status).toBe(400);
        expect(res.body.cannotDeleteActive2Fa).toBe(true);
        expect(res.body.success).toBe(false);

        // Verify that 2FA method was NOT downgraded
        const user = await db.get('SELECT two_fa_method FROM users WHERE id = ?', [testUserId]);
        expect(user.two_fa_method).toBe('fido2');

        // Cleanup
        await db.run('UPDATE users SET two_fa_method = NULL WHERE id = ?', [testUserId]);
        await db.run('DELETE FROM passkeys WHERE user_id = ?', [testUserId]);
    });
});

describe('3. Salted HMAC-SHA256 Recovery Codes & Backward Compatibility', () => {
    test('generates recovery codes hashed with HMAC-SHA256 and consumes correctly', async () => {
        const codes = await RecoveryService.generateCodes(testUserId);
        expect(codes.length).toBe(8);

        // Verify stored hash in DB matches HMAC-SHA256 format
        const rows = await db.all('SELECT code_hash, used FROM recovery_codes WHERE user_id = ?', [testUserId]);
        expect(rows.length).toBe(8);
        const normalised = codes[0].replace(/[\s-]/g, '').toUpperCase();
        const expectedHmac = hmacSha256(process.env.ENCRYPTION_KEY, `${testUserId}:${normalised}`);
        expect(rows.some(r => r.code_hash === expectedHmac)).toBe(true);

        // Consume the code
        const consumed = await RecoveryService.verifyAndConsume(testUserId, codes[0]);
        expect(consumed).toBe(true);

        // Cannot reuse the consumed code
        const reused = await RecoveryService.verifyAndConsume(testUserId, codes[0]);
        expect(reused).toBe(false);
    });

    test('supports legacy raw SHA-256 and Bcrypt recovery codes for smooth migration', async () => {
        const legacyCode = 'ABCD-EFGH-23';
        const normalised = 'ABCDEFGH23';
        const legacySha = crypto.createHash('sha256').update(normalised).digest('hex');

        await db.run(
            'INSERT INTO recovery_codes (user_id, code_hash, used) VALUES (?, ?, 0)',
            [testUserId, legacySha]
        );

        const ok = await RecoveryService.verifyAndConsume(testUserId, legacyCode);
        expect(ok).toBe(true);
    });
});

describe('4. Persistent JWT Revocation & TTL Eviction', () => {
    test('persists revoked JTI to database upon logout and checks revoked cache', async () => {
        const loginRes = await request(app)
            .post('/api/login')
            .send({ username: 'testuser', password: 'TestPassword123!' });
        const cookie = loginRes.headers['set-cookie']?.[0];
        const rawToken = cookie.split(';')[0].split('=')[1];
        const decoded = jwt.decode(rawToken);

        // Logout
        await request(app)
            .post('/api/logout')
            .set('Cookie', cookie);

        // Verify in-memory cache has revoked jti
        expect(AuthService.revokedTokensCache.has(decoded.jti)).toBe(true);

        // Verify database table has persisted the revoked token
        const row = await db.get('SELECT * FROM revoked_tokens WHERE jti = ?', [decoded.jti]);
        expect(row).toBeTruthy();
        expect(row.jti).toBe(decoded.jti);
        expect(row.expires_at).toBe(decoded.exp * 1000);
    });
});

describe('5. Sudo Elevation Absolute Lifespan Enforcement', () => {
    test('rejects elevation session if elevated_since exceeds 30 minutes', async () => {
        const expiredElevationToken = jwt.sign({
            id: testUserId,
            elevated: true,
            elevated_since: Date.now() - (35 * 60 * 1000), // 35 mins ago
            token_version: 0
        }, process.env.JWT_SECRET, { expiresIn: '15m' });

        const res = await request(app)
            .post('/api/change-username')
            .set('Cookie', [`${process.env.COOKIE_NAME}=${sessionCookie.split(';')[0].split('=')[1]}`, `situla_elevation=${expiredElevationToken}`])
            .send({ newUsername: 'new_secure_user' });

        expect(res.status).toBe(401);
        expect(res.body.requireElevation).toBe(true);
        expect(res.body.message).toContain('最长有效期');
    });
});

describe('6. Production Key Hardening Assertion', () => {
    test('assertProductionKeySecurity throws in production with default secrets', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit called with ${code}`);
        });

        expect(() => {
            assertProductionKeySecurity('situla_jwt_secret_placeholder_must_be_overridden', 'valid_key');
        }).toThrow(/process.exit/);

        expect(() => {
            assertProductionKeySecurity('valid_jwt_secret_123', '0000000000000000000000000000000000000000000000000000000000000000');
        }).toThrow(/process.exit/);

        mockExit.mockRestore();
        process.env.NODE_ENV = originalEnv;
    });
});
