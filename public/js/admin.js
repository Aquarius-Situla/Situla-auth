/**
 * public/js/admin.js
 * Situla Auth 2.0 Admin Dashboard - Modern ESM Controller
 */

import { closeAllModals } from './modules/ui.js';
import { fetchApi, enterSudoStep } from './modules/api.js';
import { loadPasskeys, setupPasskeyModal } from './modules/passkey.js';
import { loadFido2Keys, setupFido2Modal } from './modules/fido2.js';
import { setupTotpModals } from './modules/totp.js';
import { loadRecoveryStatus, setupRecoveryModal } from './modules/recovery.js';
import { loadOidcClients, setupOidcModal } from './modules/oidc.js';
import { loadLoginLogs } from './modules/logs.js';

let accountState = {
    username: '',
    email: '',
    hasTOTP: false,
    twoFaMethod: null,
    fido2Count: 0,
    elevated: false
};

export async function reloadAccountStatus() {
    try {
        const { ok, data } = await fetchApi('/api/status');
        if (!ok || !data) return;

        accountState = data;
        window.isElevated = data.elevated;

        const userDisplay = document.getElementById('usernameDisplay');
        const emailDisplay = document.getElementById('emailDisplay');
        if (userDisplay) userDisplay.textContent = data.username;
        if (emailDisplay) emailDisplay.textContent = data.email || (window.t ? window.t('status_email_not_set') : '未绑定');

        // Update 2FA Method Badge
        updateTwoFaUI(data);

        // Refresh Sub-modules
        loadPasskeys();
        loadFido2Keys();
        loadRecoveryStatus();
        loadOidcClients();
        loadLoginLogs();
    } catch (e) {
        console.error('[Admin] Reload account status error:', e);
    } finally {
        hidePageLoader();
    }
}
window.reloadAccountStatus = reloadAccountStatus;

function hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    const content = document.getElementById('appContent');
    if (loader) loader.style.display = 'none';
    if (content) content.style.opacity = '1';
}

function updateTwoFaUI(data) {
    const badge = document.getElementById('twoFaBadge');
    if (!badge) return;

    if (data.twoFaMethod === 'totp') {
        badge.className = 'badge badge-success';
        badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${window.t ? window.t('badge_2fa_totp') : 'TOTP 已启用'}`;
    } else if (data.twoFaMethod === 'fido2') {
        badge.className = 'badge badge-success';
        badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${window.t ? window.t('badge_2fa_fido2') : 'FIDO2 已启用'}`;
    } else {
        badge.className = 'badge badge-warning';
        badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${window.t ? window.t('badge_disabled') : '未启用'}`;
    }
}

function setupProfileModals() {
    // Change Username
    const userBtn = document.getElementById('editUsernameBtn');
    if (userBtn) {
        userBtn.onclick = () => {
            const modal = document.getElementById('usernameModal');
            if (modal) modal.style.display = 'flex';

            enterSudoStep('usernameModal', async (currentPassword) => {
                const input = document.getElementById('newUsernameInput');
                const newUsername = input?.value?.trim();

                const res = await fetchApi('/api/change-username', {
                    method: 'POST',
                    body: JSON.stringify({ newUsername, currentPassword })
                });

                if (res.ok && res.data?.success) {
                    reloadAccountStatus();
                }
                return res;
            });
        };
    }

    // Change Password
    const pwdBtn = document.getElementById('editPasswordBtn');
    if (pwdBtn) {
        pwdBtn.onclick = () => {
            const modal = document.getElementById('passwordModal');
            if (modal) modal.style.display = 'flex';

            enterSudoStep('passwordModal', async (currentPassword) => {
                const input = document.getElementById('newPasswordInput');
                const newPassword = input?.value;

                const res = await fetchApi('/api/change-password', {
                    method: 'POST',
                    body: JSON.stringify({ newPassword, currentPassword })
                });
                return res;
            });
        };
    }

    // Change Email
    const emailBtn = document.getElementById('editEmailBtn');
    if (emailBtn) {
        emailBtn.onclick = () => {
            const modal = document.getElementById('emailModal');
            if (modal) modal.style.display = 'flex';

            enterSudoStep('emailModal', async (currentPassword) => {
                const input = document.getElementById('newEmailInput');
                const newEmail = input?.value?.trim();

                const res = await fetchApi('/api/change-email', {
                    method: 'POST',
                    body: JSON.stringify({ newEmail, currentPassword })
                });

                if (res.ok && res.data?.success) {
                    reloadAccountStatus();
                }
                return res;
            });
        };
    }

    // 2FA Method Selector
    const changeTwoFaBtn = document.getElementById('changeTwoFaMethodBtn');
    if (changeTwoFaBtn) {
        changeTwoFaBtn.onclick = () => {
            const modal = document.getElementById('twoFaMethodModal');
            if (modal) modal.style.display = 'flex';
        };
    }

    const selectTotpBtn = document.getElementById('selectTotpOptionBtn');
    if (selectTotpBtn) {
        selectTotpBtn.onclick = () => {
            enterSudoStep('twoFaMethodModal', async (currentPassword) => {
                const res = await fetchApi('/api/2fa/enable', {
                    method: 'POST',
                    body: JSON.stringify({ method: 'totp', currentPassword })
                });
                if (res.ok && res.data?.success) {
                    reloadAccountStatus();
                }
                return res;
            });
        };
    }

    const selectFidoBtn = document.getElementById('selectFidoOptionBtn');
    if (selectFidoBtn) {
        selectFidoBtn.onclick = () => {
            enterSudoStep('twoFaMethodModal', async (currentPassword) => {
                const res = await fetchApi('/api/2fa/enable', {
                    method: 'POST',
                    body: JSON.stringify({ method: 'fido2', currentPassword })
                });
                if (res.ok && res.data?.success) {
                    reloadAccountStatus();
                }
                return res;
            });
        };
    }

    // Logout Actions
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await fetchApi('/api/logout', { method: 'POST' });
            window.location.href = '/';
        };
    }

    const logoutAllBtn = document.getElementById('logoutAllBtn');
    if (logoutAllBtn) {
        logoutAllBtn.onclick = async () => {
            if (!confirm((window.t && window.t('msg_confirm_logout_all')) || '确定要在所有设备上退出登录吗？')) return;
            await fetchApi('/api/logout-all', { method: 'POST' });
            window.location.href = '/';
        };
    }
}

function setupGlobalModalClosers() {
    document.querySelectorAll('.modal-close, .modal-btn-secondary').forEach(b => {
        b.onclick = () => closeAllModals();
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.onclick = (e) => {
            if (e.target === overlay) closeAllModals();
        };
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });
}

// ── Application Bootstrap ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupGlobalModalClosers();
    setupProfileModals();
    setupPasskeyModal();
    setupFido2Modal();
    setupTotpModals();
    setupRecoveryModal();
    setupOidcModal();

    reloadAccountStatus();
});
