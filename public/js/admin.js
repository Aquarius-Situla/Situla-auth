/**
 * public/js/admin.js
 * Situla Auth 2.0 Admin Dashboard - Modern ESM Controller (Pixel-Perfect Architecture)
 */

import { closeAllModals } from './modules/ui.js';
import { fetchApi } from './modules/api.js';
import { renderPasskeys, setupPasskeyEvents } from './modules/passkey.js';
import { set2faBadge, renderFido2Keys, setupFido2Events } from './modules/fido2.js';
import { openTotpSetup, setupTotpEvents } from './modules/totp.js';
import { updateRcCard, setupRecoveryEvents } from './modules/recovery.js';
import { loadOidcClients, setupOidcEvents } from './modules/oidc.js';
import { setupProfileEvents } from './modules/profile.js';
import { setupLogsEvents } from './modules/logs.js';

export async function loadStatus() {
    try {
        const { ok, data } = await fetchApi('/api/status');
        if (!ok || !data) throw new Error('Status fetch failed');

        if (data.username) {
            window.currentUsername = data.username;
        }
        if (data.elevated) {
            window.isElevated = true;
        }

        const userDisplay = document.getElementById('usernameDisplay');
        const emailDisplay = document.getElementById('emailDisplay');
        if (userDisplay && data.username) userDisplay.textContent = data.username;
        if (emailDisplay) emailDisplay.textContent = data.email || (window.t ? window.t('status_email_not_set') : '未绑定');

        set2faBadge(data.twoFaMethod, data.fido2Count || 0);
        renderPasskeys(data.passkeys);
        renderFido2Keys(data.fido2Keys || [], data.twoFaMethod);
        updateRcCard(!!data.twoFaMethod, data.recoveryCodesRemaining);
        loadOidcClients();
    } catch (err) {
        console.error('[Admin] loadStatus failed:', err);
        renderPasskeys([]);
        set2faBadge(null);
    } finally {
        const loader = document.getElementById('pageLoader');
        const content = document.getElementById('appContent');
        if (loader) loader.style.display = 'none';
        if (content) content.style.opacity = '1';
    }
}
window.reloadAccountStatus = loadStatus;

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

function initDashboard() {
    try { setupGlobalModalClosers(); } catch (e) { console.error('[Admin] setupGlobalModalClosers failed:', e); }
    try { setupProfileEvents(loadStatus); } catch (e) { console.error('[Admin] setupProfileEvents failed:', e); }
    try { setupPasskeyEvents(loadStatus); } catch (e) { console.error('[Admin] setupPasskeyEvents failed:', e); }
    try { setupFido2Events(loadStatus, openTotpSetup); } catch (e) { console.error('[Admin] setupFido2Events failed:', e); }
    try { setupTotpEvents(loadStatus); } catch (e) { console.error('[Admin] setupTotpEvents failed:', e); }
    try { setupRecoveryEvents(loadStatus); } catch (e) { console.error('[Admin] setupRecoveryEvents failed:', e); }
    try { setupOidcEvents(); } catch (e) { console.error('[Admin] setupOidcEvents failed:', e); }
    try { setupLogsEvents(); } catch (e) { console.error('[Admin] setupLogsEvents failed:', e); }

    loadStatus();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
