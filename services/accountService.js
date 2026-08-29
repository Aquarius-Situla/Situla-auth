/*
 * Situla Auth 2.0 - Account Domain Service
 */
'use strict';

const db = require('../core/database');
const AuthService = require('./authService');
const WebAuthnService = require('./webauthnService');
const RecoveryService = require('./recoveryService');

class AccountService {
    static async getAccountStatus(userId, username, isElevated) {
        const user = await db.get('SELECT totp_secret, email, two_fa_method FROM users WHERE id = ?', [userId]);
        const passkeys = await WebAuthnService.getKeysByType(userId, 'passkey');
        const fido2Keys = await WebAuthnService.getKeysByType(userId, 'fido2');
        const rcStatus = await RecoveryService.getStatus(userId);

        return {
            username,
            email: user ? (user.email || '') : '',
            hasTOTP: !!(user && user.totp_secret),
            twoFaMethod: user ? user.two_fa_method : null,
            passkeyCount: passkeys.length,
            passkeys,
            fido2Keys,
            fido2Count: fido2Keys.length,
            recoveryCodesRemaining: rcStatus.remaining,
            elevated: isElevated
        };
    }

    static async changeUsername(userId, newUsername) {
        const trimmed = (newUsername || '').trim();
        if (!trimmed) throw new Error('用户名不能为空');
        if (trimmed.length > 64) throw new Error('用户名过长');

        try {
            await db.run('UPDATE users SET username = ? WHERE id = ?', [trimmed, userId]);
            return true;
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE')) {
                throw new Error('用户名已被占用');
            }
            throw err;
        }
    }

    static async changePassword(userId, newPassword) {
        if (!newPassword || newPassword.length < 12) {
            throw new Error('新密码至少需要12位');
        }
        if (newPassword.length > 128) {
            throw new Error('密码过长（最多128位）');
        }

        const newHash = await AuthService.hashPassword(newPassword);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [newHash, userId]);
        return true;
    }

    static async changeEmail(userId, newEmail) {
        const trimmed = (newEmail || '').trim();
        if (!trimmed) throw new Error('邮箱不能为空');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            throw new Error('邮箱格式不正确');
        }

        await db.run('UPDATE users SET email = ? WHERE id = ?', [trimmed, userId]);
        return true;
    }
}

module.exports = AccountService;
