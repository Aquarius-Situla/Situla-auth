/*
 * Situla Auth 2.0 - WebAuthn (Passkey & FIDO2) Service
 */
'use strict';

const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const db = require('../core/database');

const FIDO2_MIN_KEYS = 2;
const FIDO2_MAX_KEYS = 6;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// Unified challenge cache: key -> { challenge, expiresAt }
const challengeCache = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of challengeCache.entries()) {
        if (now > v.expiresAt) challengeCache.delete(k);
    }
}, 5 * 60 * 1000);

class WebAuthnService {
    static setChallenge(key, challenge) {
        challengeCache.set(String(key), {
            challenge,
            expiresAt: Date.now() + CHALLENGE_TTL_MS
        });
    }

    static consumeChallenge(key) {
        const k = String(key);
        const entry = challengeCache.get(k);
        challengeCache.delete(k);
        if (!entry || Date.now() > entry.expiresAt) return null;
        return entry.challenge;
    }

    static normalizeCredentialId(id) {
        if (!id || typeof id !== 'string') return id;
        try {
            // Detect if id was double-encoded: its decoded utf8 string will be a valid base64url string
            const decoded = Buffer.from(id, 'base64url').toString('utf8');
            if (/^[A-Za-z0-9_-]{16,}$/.test(decoded)) {
                return decoded;
            }
        } catch {}
        return id;
    }

    // ── Registration: Passkey ───────────────────────────────────────────────
    static async getPasskeyRegisterOptions(user, rpId, rpName) {
        const userName = (user && (user.username || user.user)) ? String(user.username || user.user) : 'User';
        const options = await generateRegistrationOptions({
            rpName,
            rpID: rpId,
            userID: Buffer.from(user.id.toString()),
            userName: userName,
            userDisplayName: userName,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred'
            }
        });
        this.setChallenge(`passkey_reg_${user.id}`, options.challenge);
        return options;
    }

    static async verifyPasskeyRegistration(user, body, origin, rpId) {
        const expectedChallenge = this.consumeChallenge(`passkey_reg_${user.id}`);
        if (!expectedChallenge) {
            throw new Error('Challenge expired or not found. Please try again.');
        }

        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpId
        });

        if (!verification.verified) {
            throw new Error('Verification failed');
        }

        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
        const name = (body._passkeyName || '通行密钥').trim().slice(0, 40);
        const transports = JSON.stringify(body.response?.transports || []);

        const credIdBase64 = typeof credentialID === 'string'
            ? credentialID
            : Buffer.from(credentialID).toString('base64url');

        const pubKeyBase64 = typeof credentialPublicKey === 'string'
            ? credentialPublicKey
            : Buffer.from(credentialPublicKey).toString('base64url');

        await db.run(
            'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at, type, transports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                user.id,
                credIdBase64,
                pubKeyBase64,
                counter,
                name,
                new Date().toISOString(),
                'passkey',
                transports
            ]
        );

        return { verified: true };
    }

    // ── Registration: FIDO2 ────────────────────────────────────────────────
    static async getFido2RegisterOptions(user, rpId, rpName) {
        const countRow = await db.get(
            'SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?',
            [user.id, 'fido2']
        );
        if (countRow && countRow.cnt >= FIDO2_MAX_KEYS) {
            throw new Error(`最多只能添加 ${FIDO2_MAX_KEYS} 把硬件密钥`);
        }

        const userName = (user && (user.username || user.user)) ? String(user.username || user.user) : 'User';
        const options = await generateRegistrationOptions({
            rpName,
            rpID: rpId,
            userID: Buffer.from(user.id.toString()),
            userName: userName,
            userDisplayName: userName,
            attestationType: 'none',
            authenticatorSelection: {
                authenticatorAttachment: 'cross-platform',
                userVerification: 'preferred'
            }
        });
        this.setChallenge(`fido2_reg_${user.id}`, options.challenge);
        return options;
    }

    static async verifyFido2Registration(user, body, origin, rpId) {
        const expectedChallenge = this.consumeChallenge(`fido2_reg_${user.id}`);
        if (!expectedChallenge) {
            throw new Error('挑战已过期，请重试');
        }

        const countRow = await db.get(
            'SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?',
            [user.id, 'fido2']
        );
        if (countRow && countRow.cnt >= FIDO2_MAX_KEYS) {
            throw new Error(`最多只能添加 ${FIDO2_MAX_KEYS} 把硬件密钥`);
        }

        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpId
        });

        if (!verification.verified) {
            throw new Error('验证失败');
        }

        const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
        const name = (body._keyName || body._fido2KeyName || body.name || '安全密钥').trim().slice(0, 40);
        const transports = JSON.stringify(body.response?.transports || []);

        const credIdBase64 = typeof credentialID === 'string'
            ? credentialID
            : Buffer.from(credentialID).toString('base64url');

        const pubKeyBase64 = typeof credentialPublicKey === 'string'
            ? credentialPublicKey
            : Buffer.from(credentialPublicKey).toString('base64url');

        await db.run(
            'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at, type, transports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                user.id,
                credIdBase64,
                pubKeyBase64,
                counter,
                name,
                new Date().toISOString(),
                'fido2',
                transports
            ]
        );

        return { verified: true };
    }

    // ── Authentication: Passkey Login ──────────────────────────────────────
    static async getPasskeyLoginOptions(rpId) {
        return await generateAuthenticationOptions({
            rpID: rpId,
            userVerification: 'preferred'
        });
    }

    static async verifyPasskeyLogin(body, expectedChallenge, origin, rpId) {
        let passkey = await db.get(
            'SELECT * FROM passkeys WHERE credential_id = ? AND type = ?',
            [body.id, 'passkey']
        );
        if (!passkey) {
            const legacyId = Buffer.from(body.id).toString('base64url');
            passkey = await db.get(
                'SELECT * FROM passkeys WHERE credential_id = ? AND type = ?',
                [legacyId, 'passkey']
            );
            if (passkey) {
                await db.run('UPDATE passkeys SET credential_id = ? WHERE id = ?', [body.id, passkey.id]);
                passkey.credential_id = body.id;
            }
        }
        if (!passkey) throw new Error('Key not found or not a valid passkey');

        const user = await db.get('SELECT * FROM users WHERE id = ?', [passkey.user_id]);
        if (!user) throw new Error('User not found');

        const cleanCredId = WebAuthnService.normalizeCredentialId(passkey.credential_id);

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpId,
            authenticator: {
                credentialID: Buffer.from(cleanCredId, 'base64url'),
                credentialPublicKey: Buffer.from(passkey.public_key, 'base64url'),
                counter: passkey.counter
            }
        });

        if (!verification.verified) {
            throw new Error('Verification failed');
        }

        await db.run(
            'UPDATE passkeys SET counter = ? WHERE id = ?',
            [verification.authenticationInfo.newCounter, passkey.id]
        );

        return { verified: true, user };
    }

    // ── Authentication: FIDO2 2FA ──────────────────────────────────────────
    static async getFido2AuthOptions(userId, rpId) {
        const keys = await db.all(
            'SELECT credential_id, transports FROM passkeys WHERE user_id = ? AND type = ?',
            [userId, 'fido2']
        );
        if (!keys || keys.length === 0) {
            throw new Error('No FIDO2 keys registered');
        }

        const allowCredentials = [];
        const seenIds = new Set();
        for (const k of keys) {
            if (!k.credential_id) continue;
            const cleanId = WebAuthnService.normalizeCredentialId(k.credential_id);
            if (cleanId && !seenIds.has(cleanId)) {
                seenIds.add(cleanId);
                allowCredentials.push({
                    id: cleanId,
                    type: 'public-key'
                });
            }
            if (k.credential_id && k.credential_id !== cleanId && !seenIds.has(k.credential_id)) {
                seenIds.add(k.credential_id);
                allowCredentials.push({
                    id: k.credential_id,
                    type: 'public-key'
                });
            }
        }

        const options = await generateAuthenticationOptions({
            rpID: rpId,
            userVerification: 'preferred',
            allowCredentials
        });

        this.setChallenge(`fido2_login_${userId}`, options.challenge);
        return options;
    }

    static async verifyFido2Auth(userId, body, origin, rpId) {
        const expectedChallenge = this.consumeChallenge(`fido2_login_${userId}`);
        if (!expectedChallenge) {
            throw new Error('挑战已过期，请重新登录');
        }

        let key = await db.get(
            'SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ? AND type = ?',
            [body.id, userId, 'fido2']
        );

        if (!key) {
            const legacyId = Buffer.from(body.id).toString('base64url');
            key = await db.get(
                'SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ? AND type = ?',
                [legacyId, userId, 'fido2']
            );
            if (key) {
                await db.run('UPDATE passkeys SET credential_id = ? WHERE id = ?', [body.id, key.id]);
                key.credential_id = body.id;
            }
        }

        if (!key) {
            const allKeys = await db.all('SELECT * FROM passkeys WHERE user_id = ? AND type = ?', [userId, 'fido2']);
            key = allKeys.find(k => WebAuthnService.normalizeCredentialId(k.credential_id) === body.id);
            if (key) {
                await db.run('UPDATE passkeys SET credential_id = ? WHERE id = ?', [body.id, key.id]);
                key.credential_id = body.id;
            }
        }

        if (!key) throw new Error('未找到对应的安全密钥');

        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!user) throw new Error('User not found');

        const cleanCredId = WebAuthnService.normalizeCredentialId(key.credential_id);

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpId,
            authenticator: {
                credentialID: Buffer.from(cleanCredId, 'base64url'),
                credentialPublicKey: Buffer.from(key.public_key, 'base64url'),
                counter: key.counter
            }
        });

        if (!verification.verified) {
            throw new Error('验证失败');
        }

        await db.run(
            'UPDATE passkeys SET counter = ? WHERE id = ?',
            [verification.authenticationInfo.newCounter, key.id]
        );

        return { verified: true, user };
    }

    // ── Key Management ─────────────────────────────────────────────────────
    static async getKeysByType(userId, type) {
        const rows = await db.all(
            'SELECT id, name, created_at, transports FROM passkeys WHERE user_id = ? AND type = ? ORDER BY id ASC',
            [userId, type]
        );
        return rows.map(k => ({
            ...k,
            transports: JSON.parse(k.transports || '[]')
        }));
    }

    static async deleteKey(userId, keyId, type) {
        if (type === 'fido2') {
            const user = await db.get('SELECT two_fa_method FROM users WHERE id = ?', [userId]);
            if (user && user.two_fa_method === 'fido2') {
                const countRow = await db.get(
                    'SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?',
                    [userId, 'fido2']
                );
                const currentCount = countRow ? countRow.cnt : 0;
                if (currentCount <= FIDO2_MIN_KEYS) {
                    return {
                        success: false,
                        cannotDeleteActive2Fa: true,
                        message: `无法删除：当前已启用 FIDO2 两步验证，且要求必须保留至少 ${FIDO2_MIN_KEYS} 把硬件密钥。若需删除，请先在安全设置中停用两步验证。`
                    };
                }
            }
        }

        const result = await db.run(
            'DELETE FROM passkeys WHERE id = ? AND user_id = ? AND type = ?',
            [keyId, userId, type]
        );
        if (result.changes === 0) return { success: false, notFound: true };

        if (type === 'fido2') {
            const countRow = await db.get(
                'SELECT COUNT(*) as cnt FROM passkeys WHERE user_id = ? AND type = ?',
                [userId, 'fido2']
            );
            const remaining = countRow ? countRow.cnt : 0;
            return { success: true, remaining };
        }

        return { success: true };
    }

    static async renameKey(userId, keyId, type, newName) {
        const result = await db.run(
            'UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ? AND type = ?',
            [newName, keyId, userId, type]
        );
        return result.changes > 0;
    }
}

module.exports = WebAuthnService;
