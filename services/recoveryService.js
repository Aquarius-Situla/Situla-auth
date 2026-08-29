/*
 * Situla Auth 2.0 - Recovery Codes Service
 */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../core/database');

const COUNT = 8;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class RecoveryService {
    static async generateCodes(userId) {
        const plainCodes = [];
        const records = [];

        for (let i = 0; i < COUNT; i++) {
            let raw = '';
            for (let j = 0; j < 10; j++) raw += CHARS[crypto.randomInt(CHARS.length)];
            const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
            const normalised = raw.toUpperCase();
            const hash = crypto.createHash('sha256').update(normalised).digest('hex');

            plainCodes.push(formatted);
            records.push(hash);
        }

        // Strong transactional replacement
        await db.transaction(async (tx) => {
            await tx.run('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
            for (const hash of records) {
                await tx.run('INSERT INTO recovery_codes (user_id, code_hash, used) VALUES (?, ?, 0)', [userId, hash]);
            }
        });

        return plainCodes;
    }

    static async verifyAndConsume(userId, inputCode) {
        const normalised = String(inputCode).replace(/[\s-]/g, '').toUpperCase();
        if (!normalised || normalised.length < 8) return false;

        const inputSha256 = crypto.createHash('sha256').update(normalised).digest('hex');

        // 1. Direct O(1) SHA-256 lookup (fast path, immune to DoS)
        const shaMatch = await db.get(
            'SELECT id FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used = 0 LIMIT 1',
            [userId, inputSha256]
        );

        if (shaMatch) {
            await db.run('UPDATE recovery_codes SET used = 1 WHERE id = ?', [shaMatch.id]);
            return true;
        }

        // 2. Legacy Bcrypt fallback
        const legacyRows = await db.all(
            "SELECT id, code_hash FROM recovery_codes WHERE user_id = ? AND used = 0 AND (code_hash LIKE '$2b$%' OR code_hash LIKE '$2a$%')",
            [userId]
        );

        for (const row of legacyRows) {
            try {
                if (await bcrypt.compare(normalised, row.code_hash)) {
                    await db.run('UPDATE recovery_codes SET used = 1 WHERE id = ?', [row.id]);
                    return true;
                }
            } catch (e) {}
        }

        return false;
    }

    static async getStatus(userId) {
        const activeRow = await db.get(
            'SELECT COUNT(*) as total FROM recovery_codes WHERE user_id = ? AND used = 0',
            [userId]
        );
        const usedRow = await db.get(
            'SELECT COUNT(*) as usedCount FROM recovery_codes WHERE user_id = ? AND used = 1',
            [userId]
        );

        const remaining = activeRow ? activeRow.total : 0;
        const used = usedRow ? usedRow.usedCount : 0;
        return {
            remaining,
            used,
            hasAny: (remaining + used) > 0
        };
    }
}

module.exports = RecoveryService;
