/**
 * routes/passkey.js
 * Passkey (WebAuthn resident key) registration and management.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { generateRegistrationOptions, verifyRegistrationResponse } = require('@simplewebauthn/server');

const db = require('../database');
const { authenticateJWT, verifyElevationOrPassword } = require('../middleware/auth');

function setChallenge(app, userId, challenge) {
    const CHALLENGE_TTL_MS = 5 * 60 * 1000;
    app.locals.userChallenges.set(String(userId), { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}
function consumeChallenge(app, userId) {
    const key = String(userId);
    const entry = app.locals.userChallenges.get(key);
    app.locals.userChallenges.delete(key);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.challenge;
}

/* ── GET /api/webauthn/register-options ── */
router.get('/register-options', authenticateJWT, async (req, res) => {
    const RP_ID = req.app.get('RP_ID');
    const RP_NAME = req.app.get('RP_NAME');
    const options = await generateRegistrationOptions({
        rpName: RP_NAME, rpID: RP_ID,
        userID: Buffer.from(req.user.id.toString()),
        userName: req.user.user,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
    });
    setChallenge(req.app, req.user.id, options.challenge);
    res.json(options);
});

/* ── POST /api/webauthn/register-verify ── */
router.post('/register-verify', authenticateJWT, async (req, res) => {
    if (!(await verifyElevationOrPassword(req, res))) return;

    const RP_ID = req.app.get('RP_ID');
    const ORIGIN = req.app.get('ORIGIN');
    try {
        const expectedChallenge = consumeChallenge(req.app, req.user.id);
        if (!expectedChallenge)
            return res.status(400).json({ error: 'Challenge expired or not found. Please try again.' });

        const verification = await verifyRegistrationResponse({
            response: req.body, expectedChallenge, expectedOrigin: ORIGIN, expectedRPID: RP_ID
        });

        if (verification.verified) {
            const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
            const name = (req.body._passkeyName || '通行密钥').trim().slice(0, 40);
            const transports = JSON.stringify(req.body.response?.transports || []);
            db.run(
                'INSERT INTO passkeys (user_id, credential_id, public_key, counter, name, created_at, type, transports) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [req.user.id,
                 Buffer.from(credentialID).toString('base64url'),
                 Buffer.from(credentialPublicKey).toString('base64url'),
                 counter, name, new Date().toISOString(), 'passkey', transports]
            );
            return res.json({ verified: true });
        }
    } catch (error) {
        console.error('[WebAuthn Register Error]:', error.message);
        return res.status(400).json({ error: error.message });
    }
});

/* ── GET /api/passkeys ── */
router.get('/', authenticateJWT, (req, res) => {
    db.all('SELECT id, name, created_at FROM passkeys WHERE user_id = ? ORDER BY id ASC', [req.user.id], (err, keys) => {
        res.json(keys || []);
    });
});

/* ── DELETE /api/passkeys/:id ── */
router.delete('/:id', authenticateJWT, (req, res) => {
    db.run('DELETE FROM passkeys WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ success: false });
        if (this.changes === 0) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true });
    });
});

/* ── PATCH /api/passkeys/:id ── */
router.patch('/:id', authenticateJWT, (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false });
    db.run('UPDATE passkeys SET name = ? WHERE id = ? AND user_id = ?', [name, req.params.id, req.user.id], function(err) {
        if (err || this.changes === 0) return res.status(404).json({ success: false });
        res.json({ success: true });
    });
});

module.exports = router;
