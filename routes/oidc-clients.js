/**
 * routes/oidc-clients.js
 * OIDC client management (create, list, delete).
 */
'use strict';

const express = require('express');
const router = express.Router();
const OidcService = require('../services/oidcService');
const AuthService = require('../services/authService');
const { authenticateJWT, requireStepUpAuth } = require('../middleware/auth');

/* ── GET /api/oidc/clients ── */
router.get('/', authenticateJWT, async (req, res) => {
    try {
        const list = await OidcService.listClients();
        res.json(list);
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error' });
    }
});

/* ── POST /api/oidc/clients ── */
router.post('/', authenticateJWT, requireStepUpAuth, async (req, res) => {
    const { client_name, redirect_uris, currentPassword } = req.body;
    if (!client_name || !redirect_uris || !Array.isArray(redirect_uris)) {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    if (!(await AuthService.verifyElevationOrPassword(req, res, currentPassword))) return;

    try {
        const newClient = await OidcService.createClient(client_name, redirect_uris);
        res.json({ success: true, ...newClient });
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error' });
    }
});

/* ── DELETE /api/oidc/clients/:id ── */
router.delete('/:id', authenticateJWT, requireStepUpAuth, async (req, res) => {
    if (!(await AuthService.verifyElevationOrPassword(req, res))) return;

    try {
        const deleted = await OidcService.deleteClient(req.params.id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'DB Error' });
    }
});

module.exports = router;
