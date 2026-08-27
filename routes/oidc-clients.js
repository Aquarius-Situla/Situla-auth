/**
 * routes/oidc-clients.js
 * OIDC client management (create, list, delete).
 */
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const { authenticateJWT, requireStepUpAuth, verifyElevationOrPassword } = require('../middleware/auth');

/* ── GET /api/oidc/clients ── */
router.get('/', authenticateJWT, (req, res) => {
    db.all('SELECT id, client_id, client_name, redirect_uris, created_at FROM oidc_clients ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'DB Error' });
        const list = (rows || []).map(r => {
            let uris = [];
            try { uris = JSON.parse(r.redirect_uris || '[]'); } catch(e) {}
            return { ...r, redirect_uris: uris };
        });
        res.json(list);
    });
});

/* ── POST /api/oidc/clients ── */
router.post('/', authenticateJWT, (req, res) => {
    const encrypt = req.app.locals.encrypt;
    const { client_name, redirect_uris, currentPassword } = req.body;
    if (!client_name || !redirect_uris || !Array.isArray(redirect_uris))
        return res.status(400).json({ success: false, message: 'Invalid payload' });

    db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (!user) return res.status(401).json({ success: false, message: 'User not found' });
        if (!(await verifyElevationOrPassword(req, res, currentPassword))) return;

        const client_id = 'client_' + crypto.randomBytes(8).toString('hex');
        const client_secret = crypto.randomBytes(32).toString('base64url');
        const encryptedSecret = encrypt(client_secret);

        db.run(
            'INSERT INTO oidc_clients (client_id, client_secret_enc, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?, ?)',
            [client_id, encryptedSecret, client_name, JSON.stringify(redirect_uris), new Date().toISOString()],
            function(err) {
                if (err) return res.status(500).json({ success: false, message: 'DB Error' });
                res.json({ success: true, client_id, client_secret, client_name });
            }
        );
    });
});

/* ── DELETE /api/oidc/clients/:id ── */
router.delete('/:id', authenticateJWT, requireStepUpAuth, async (req, res) => {
    if (!(await verifyElevationOrPassword(req, res))) return;

    db.run('DELETE FROM oidc_clients WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ success: false, message: 'DB Error' });
        res.json({ success: true });
    });
});

module.exports = router;
