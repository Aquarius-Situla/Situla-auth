/*
 * Situla Auth 2.0 - Account Domain Service
 */
'use strict';

const db = require('../core/database');
const AuthService = require('./authService');
const WebAuthnService = require('./webauthnService');
const RecoveryService = require('./recoveryService');

class AccountService {
    /**
     * Masks an email address for display in non-elevated state.
     * Keeps 1 char for local part <= 4 chars (e.g. bob@example.com → b*****@example.com),
     * keeps 2 chars for local part > 4 chars (e.g. alice@example.com → al*****@example.com),
     * and preserves the full domain.
     * (not set) → ''
     */
    static _maskEmail(email) {
        if (!email) return '';
        const atIdx = email.lastIndexOf('@');
        if (atIdx <= 0) return email; // malformed, return as-is
        const local = email.slice(0, atIdx);
        const domain = email.slice(atIdx); // includes '@'
        const keep = local.length <= 4 ? 1 : 2;
        return local.slice(0, keep) + '*****' + domain;
    }

    static async getAccountStatus(userId, username, isElevated) {
        const user = await db.get('SELECT totp_secret, email, two_fa_method, password_updated_at FROM users WHERE id = ?', [userId]);
        const passkeys = await WebAuthnService.getKeysByType(userId, 'passkey');
        const fido2Keys = await WebAuthnService.getKeysByType(userId, 'fido2');
        const rcStatus = await RecoveryService.getStatus(userId);

        const rawEmail = user ? (user.email || '') : '';
        const result = {
            username,
            // Always return masked email; fullEmail only returned when elevated
            email: AccountService._maskEmail(rawEmail),
            passwordUpdatedAt: user ? (user.password_updated_at || '') : '',
            hasTOTP: !!(user && user.totp_secret),
            twoFaMethod: user ? user.two_fa_method : null,
            passkeyCount: passkeys.length,
            passkeys,
            fido2Keys,
            fido2Count: fido2Keys.length,
            recoveryCodesRemaining: rcStatus.remaining,
            elevated: isElevated
        };

        // Only expose full email when the session is elevated (user has verified password)
        if (isElevated) {
            result.fullEmail = rawEmail;
        }

        return result;
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
        if (!newPassword || newPassword.length < 6) {
            throw new Error('新密码至少需要6位');
        }
        if (newPassword.length > 128) {
            throw new Error('密码过长（最多128位）');
        }

        const newHash = await AuthService.hashPassword(newPassword);
        const nowIso = new Date().toISOString();
        await db.run('UPDATE users SET password = ?, password_updated_at = ? WHERE id = ?', [newHash, nowIso, userId]);
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
