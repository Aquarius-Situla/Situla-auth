/**
 * routes/recovery.js
 * Recovery code generation and status.
 */
'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database');
const { authenticateJWT, SALT_ROUNDS, verifyElevationOrPassword } = require('../middleware/auth');

/* ── POST /api/recovery-codes/generate ── */
router.post('/generate', authenticateJWT, async (req, res) => {
    if (!(await verifyElevationOrPassword(req, res, req.body.currentPassword))) return;

    const COUNT = 8;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes = [];
    for (let i = 0; i < COUNT; i++) {
        let raw = '';
        for (let j = 0; j < 10; j++) raw += chars[crypto.randomInt(chars.length)];
        codes.push(raw.slice(0, 5) + '-' + raw.slice(5));
    }

    db.run('DELETE FROM recovery_codes WHERE user_id = ?', [req.user.id], async () => {
        const stmt = db.prepare('INSERT INTO recovery_codes (user_id, code_hash, used) VALUES (?, ?, 0)');
        for (const c of codes) {
            const normalised = c.replace(/-/g, '');
            const hashed = await bcrypt.hash(normalised, SALT_ROUNDS);
            stmt.run([req.user.id, hashed]);
        }
        stmt.finalize();
        res.json({ success: true, codes });
    });
});

/* ── GET /api/recovery-codes/status ── */
router.get('/status', authenticateJWT, (req, res) => {
    db.get('SELECT COUNT(*) as total FROM recovery_codes WHERE user_id = ? AND used = 0', [req.user.id], (err, row) => {
        db.get('SELECT COUNT(*) as usedCount FROM recovery_codes WHERE user_id = ? AND used = 1', [req.user.id], (err2, row2) => {
            const total = row ? row.total : 0;
            const used = row2 ? row2.usedCount : 0;
            res.json({ remaining: total, used, hasAny: (total + used) > 0 });
        });
    });
});

module.exports = router;
