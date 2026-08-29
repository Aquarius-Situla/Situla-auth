/*
 * Situla Auth 2.0 - TOTP Domain Service
 */
'use strict';

const { authenticator } = require('otplib');
authenticator.options = { window: [1, 1] };
const qrcode = require('qrcode');
const db = require('../core/database');
const { encrypt, decrypt } = require('../core/crypto');

class TotpService {
    static async generate(userId, username, rpName) {
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(username, rpName, secret);
        const encryptedSecret = encrypt(secret);

        await db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [encryptedSecret, userId]);
        const qr = await qrcode.toDataURL(otpauth);
        return { secret, qr };
    }

    static async verifyAndActivate(userId, token) {
        const user = await db.get('SELECT totp_pending_secret FROM users WHERE id = ?', [userId]);
        if (!user || !user.totp_pending_secret) {
            throw new Error('请先生成 TOTP 设置');
        }

        const decryptedSecret = decrypt(user.totp_pending_secret);
        if (!decryptedSecret) {
            throw new Error('解密 TOTP 密钥失败');
        }

        const cleanedToken = String(token).replace(/[\s-]/g, '').trim();
        const isValid = authenticator.verify({ token: cleanedToken, secret: decryptedSecret });
        if (!isValid) {
            return false;
        }

        await db.run(
            'UPDATE users SET totp_secret = ?, totp_pending_secret = "", two_fa_method = "totp" WHERE id = ?',
            [user.totp_pending_secret, userId]
        );
        return true;
    }

    static verifyToken(encryptedSecret, token) {
        if (!encryptedSecret || !token) return false;
        try {
            const secret = decrypt(encryptedSecret);
            if (!secret) return false;
            const cleaned = String(token).replace(/[\s-]/g, '').trim();
            return authenticator.verify({ token: cleaned, secret });
        } catch (e) {
            return false;
        }
    }

    static async disable(userId) {
        await db.run('UPDATE users SET totp_secret = NULL, two_fa_method = NULL WHERE id = ?', [userId]);
        return true;
    }
}

module.exports = TotpService;
