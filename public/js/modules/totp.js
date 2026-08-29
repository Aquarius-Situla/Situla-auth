/**
 * public/js/modules/totp.js
 * TOTP Setup, Verification, and 2FA Disable flows.
 */

import { t, fetchApi, enterSudoStep } from './api.js';
import { set2faBadge } from './fido2.js';

let currentSecret = '';

export async function openTotpSetup() {
    try {
        const { ok, data } = await fetchApi('/api/totp/generate');
        if (!ok || !data) return;

        currentSecret = data.secret;
        const qrEl = document.getElementById('qrCode');
        const secretEl = document.getElementById('secretKey');
        const codeInp = document.getElementById('totpCode');
        const msgEl = document.getElementById('totpMsg');
        const totpSetup = document.getElementById('totpSetup');
        const twoFaDisabledUI = document.getElementById('twoFaDisabledUI');
        const totpEnabledUI = document.getElementById('totpEnabledUI');

        if (qrEl) qrEl.src = data.qr;
        if (secretEl) secretEl.textContent = data.secret;
        if (codeInp) codeInp.value = '';
        if (msgEl) {
            msgEl.textContent = '';
            msgEl.className = 'msg';
        }

        if (totpSetup) totpSetup.style.display = 'block';
        if (twoFaDisabledUI) twoFaDisabledUI.style.display = 'none';
        if (totpEnabledUI) totpEnabledUI.style.display = 'none';
    } catch (e) {
        console.error('[TOTP] Failed to generate setup:', e);
    }
}

export function setupTotpEvents(onSuccessReload) {
    // Copy secret on click
    const secretKeyEl = document.getElementById('secretKey');
    if (secretKeyEl) {
        secretKeyEl.addEventListener('click', function() {
            navigator.clipboard.writeText(this.textContent).then(() => {
                this.style.color = '#34c759';
                setTimeout(() => this.style.color = '', 1000);
            });
        });
    }

    // Reset 2FA
    document.getElementById('reset2faBtn')?.addEventListener('click', () => {
        const totpEnabledUI = document.getElementById('totpEnabledUI');
        const twoFaMethodSelector = document.getElementById('twoFaMethodSelector');
        if (totpEnabledUI) totpEnabledUI.style.display = 'none';
        if (twoFaMethodSelector) twoFaMethodSelector.style.display = 'block';
    });

    // Verify 2FA
    document.getElementById('verify2faBtn')?.addEventListener('click', async () => {
        const code = document.getElementById('totpCode')?.value?.replace(/\s/g, '') || '';
        const msg = document.getElementById('totpMsg');
        if (code.length !== 6) {
            if (msg) {
                msg.textContent = t('msg_enter_6_digits') || '请输入 6 位动态验证码';
                msg.className = 'msg msg-err';
            }
            return;
        }

        const { ok, data } = await fetchApi('/api/totp/verify', {
            method: 'POST',
            body: JSON.stringify({ token: code, secret: currentSecret })
        });

        if (ok && data.success) {
            if (msg) {
                msg.textContent = t('msg_2fa_enabled') || '双重认证已启用';
                msg.className = 'msg msg-ok';
            }
            setTimeout(() => {
                const totpSetup = document.getElementById('totpSetup');
                if (totpSetup) totpSetup.style.display = 'none';
                set2faBadge('totp');
                if (onSuccessReload) onSuccessReload();
            }, 1000);
        } else {
            if (msg) {
                msg.textContent = data.message || t('msg_2fa_wrong') || '验证码错误，请重试';
                msg.className = 'msg msg-err';
            }
        }
    });

    // Cancel TOTP setup
    document.getElementById('cancelTotpSetupBtn')?.addEventListener('click', async () => {
        const totpSetup = document.getElementById('totpSetup');
        if (totpSetup) totpSetup.style.display = 'none';
        if (onSuccessReload) await onSuccessReload();
    });

    // Disable 2FA (Both TOTP and FIDO2)
    async function disable2faCommon() {
        if (!confirm(t('alert_disable_2fa') || '确定要停用双重认证吗？')) return;

        const currentPassword = prompt('请输入当前密码以确认操作：');
        if (currentPassword === null) return;

        let totpToken = '';
        const isTotp = document.getElementById('totpEnabledUI')?.style.display === 'flex';
        if (isTotp) {
            totpToken = prompt('请输入 Authenticator 中的当前 6 位验证码：') || '';
            if (totpToken === null) return;
        }

        const { ok, data } = await fetchApi('/api/totp/disable', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, totpToken })
        });

        if (ok && data.success) {
            set2faBadge(null);
            if (onSuccessReload) onSuccessReload();
        } else {
            alert(data?.message || '停用失败，请检查密码和验证码是否正确');
        }
    }

    document.getElementById('disable2faBtn')?.addEventListener('click', disable2faCommon);
    document.getElementById('disableFido2Btn')?.addEventListener('click', disable2faCommon);
}
