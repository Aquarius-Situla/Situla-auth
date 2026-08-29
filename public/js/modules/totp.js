/**
 * public/js/modules/totp.js
 * TOTP setup, verification, and disable.
 */

import { fetchApi, enterSudoStep } from './api.js';
import { closeAllModals } from './ui.js';

export function setupTotpModals() {
    const setupBtn = document.getElementById('setupTotpBtn');
    const verifyForm = document.getElementById('totpStep1Form');
    const disableBtn = document.getElementById('disableTotpBtn');

    if (setupBtn) {
        setupBtn.onclick = async () => {
            const modal = document.getElementById('totpModal');
            const qrImg = document.getElementById('totpQrImage');
            const secretText = document.getElementById('totpSecretText');

            try {
                const { ok, data } = await fetchApi('/api/totp/generate');
                if (ok && data) {
                    if (qrImg) qrImg.src = data.qr;
                    if (secretText) secretText.textContent = data.secret;
                    if (modal) modal.style.display = 'flex';
                }
            } catch (e) {
                console.error('[TOTP] Generate error:', e);
            }
        };
    }

    if (verifyForm) {
        verifyForm.onsubmit = async (e) => {
            e.preventDefault();
            const tokenInput = document.getElementById('totpVerifyCode');
            const msgEl = verifyForm.querySelector('.msg');
            const token = tokenInput?.value?.trim();

            if (!token) return;

            try {
                const { ok, data } = await fetchApi('/api/totp/verify', {
                    method: 'POST',
                    body: JSON.stringify({ token })
                });

                if (ok && data.success) {
                    closeAllModals();
                    if (window.reloadAccountStatus) window.reloadAccountStatus();
                } else {
                    if (msgEl) {
                        msgEl.textContent = data?.message || (window.t && window.t('msg_invalid_totp')) || '验证码无效，请重试';
                        msgEl.className = 'msg msg-err';
                    }
                }
            } catch (err) {
                if (msgEl) {
                    msgEl.textContent = (window.t && window.t('msg_network_error')) || '网络错误，请重试';
                    msgEl.className = 'msg msg-err';
                }
            }
        };
    }

    if (disableBtn) {
        disableBtn.onclick = () => {
            const modal = document.getElementById('disableTotpModal');
            if (modal) modal.style.display = 'flex';

            enterSudoStep('disableTotpModal', async (currentPassword) => {
                const codeInput = document.getElementById('disableTotpCodeInput');
                const totpToken = codeInput?.value?.trim();

                const res = await fetchApi('/api/totp/disable', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword, totpToken })
                });

                if (res.ok && res.data?.success) {
                    if (window.reloadAccountStatus) window.reloadAccountStatus();
                }
                return res;
            });
        };
    }
}
