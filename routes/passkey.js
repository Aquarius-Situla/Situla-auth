/**
 * routes/passkey.js
 * Passkey (WebAuthn resident key) registration and management.
 */
'use strict';

const express = require('express');
const router = express.Router();
const WebAuthnService = require('../services/webauthnService');
const AuthService = require('../services/authService');
const { authenticateJWT } = require('../middleware/auth');

function getRpId(req) {
    const configured = req.app.get('RP_ID');
    const rawHost = (req.headers['x-forwarded-host'] || req.get('host') || req.hostname || '').split(':')[0].trim().toLowerCase();
    if (configured && configured !== 'auth.example.com') {
        const confLower = configured.toLowerCase();
        if (rawHost === confLower || rawHost.endsWith('.' + confLower)) {
            return configured;
        }
    }
    if (rawHost && rawHost !== '127.0.0.1') {
        return rawHost;
    }
    return configured || 'localhost';
}

function getOrigin(req) {
    const originHeader = req.get('origin');
    if (originHeader) return originHeader;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) return `${proto}://${host}`;
    return req.app.get('ORIGIN') || `https://${getRpId(req)}`;
}

/* ── GET /api/webauthn/register-options ── */
router.get('/register-options', authenticateJWT, async (req, res) => {
    try {
        const RP_ID = getRpId(req);
        const RP_NAME = req.app.get('RP_NAME');
        const options = await WebAuthnService.getPasskeyRegisterOptions(req.user, RP_ID, RP_NAME);
        res.json(options);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* ── POST /api/webauthn/register-verify ── */
router.post('/register-verify', authenticateJWT, async (req, res) => {
    if (!(await AuthService.verifyElevationOrPassword(req, res))) return;

    try {
        const RP_ID = getRpId(req);
        const ORIGIN = getOrigin(req);
        const result = await WebAuthnService.verifyPasskeyRegistration(req.user, req.body, ORIGIN, RP_ID);
        res.json(result);
    } catch (error) {
        console.error('[Passkey Register Error]:', error.message);
        res.status(400).json({ error: error.message });
    }
});

/* ── GET /api/passkeys ── */
router.get('/', authenticateJWT, async (req, res) => {
    try {
        const keys = await WebAuthnService.getKeysByType(req.user.id, 'passkey');
        res.json(keys);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* ── DELETE /api/passkeys/:id ── */
router.delete('/:id', authenticateJWT, async (req, res) => {
    try {
        const result = await WebAuthnService.deleteKey(req.user.id, req.params.id, 'passkey');
        if (result.notFound) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

/* ── PATCH /api/passkeys/:id ── */
router.patch('/:id', authenticateJWT, async (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false });

    try {
        const ok = await WebAuthnService.renameKey(req.user.id, req.params.id, 'passkey', name);
        if (!ok) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
