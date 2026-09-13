/* ============================================================================
 * Situla Auth 2.0 — Admin Dashboard Controller (admin.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import { closeAllModals, fmtDate, t } from './modules/ui.js?v=20260913c';
import { fetchApi } from './modules/api.js?v=20260913c';
import { renderPasskeys, setupPasskeyEvents } from './modules/passkey.js?v=20260913c';
import { set2faBadge, renderFido2Keys, setupFido2Events } from './modules/fido2.js?v=20260913c';
import { openTotpSetup, setupTotpEvents } from './modules/totp.js?v=20260913c';
import { updateRcCard, setupRecoveryEvents } from './modules/recovery.js?v=20260913c';
import { loadOidcClients, setupOidcEvents } from './modules/oidc.js?v=20260913c';
import { setupProfileEvents } from './modules/profile.js?v=20260913c';
import { setupLogsEvents } from './modules/logs.js?v=20260913c';
import { setupNpmGenerator } from './modules/npm-generator.js?v=20260913c';
import { initDeviceLayout, initOrientationGuard } from './modules/device-detect.js?v=20260913c';
import { initAdminNav, syncSidebarProfile } from './modules/admin-nav.js?v=20260913c';

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
        const heroUserDisplay = document.getElementById('accountUsername') || document.getElementById('overviewUsername');
        const emailDisplay = document.getElementById('emailDisplay');
        const heroEmailDisplay = document.getElementById('accountEmail') || document.getElementById('overviewEmail');
        const pwdDisplay = document.getElementById('passwordUpdatedDisplay');

        /* Display username across main settings and overview hero card */
        if (data.username) {
            if (userDisplay) userDisplay.textContent = data.username;
            if (heroUserDisplay) heroUserDisplay.textContent = data.username;
        }

        /* Email display: masked by default unless elevated */
        const emailText = (data.elevated && data.fullEmail) ? data.fullEmail : data.email;
        const finalEmail = emailText || t('status_email_not_set');
        window.currentUserEmail = finalEmail;
        if (emailDisplay) emailDisplay.textContent = finalEmail;
        if (heroEmailDisplay) heroEmailDisplay.textContent = finalEmail;

        /* Password last updated time */
        if (pwdDisplay) {
            if (data.passwordUpdatedAt) {
                pwdDisplay.textContent = t('status_pwd_last_updated', fmtDate(data.passwordUpdatedAt));
            } else {
                pwdDisplay.textContent = t('status_pwd_never_updated');
            }
        }

        /* Render security components */
        set2faBadge(data.twoFaMethod, data.fido2Count || 0);
        renderPasskeys(data.passkeys);
        renderFido2Keys(data.fido2Keys || [], data.twoFaMethod);
        updateRcCard(!!data.twoFaMethod, data.recoveryCodesRemaining);
        loadOidcClients();

        /* Update Overview tab health summary metrics */
        updateOverviewHealthSummary(data);

        /* Synchronize desktop sidebar and overview Identicon profile */
        syncSidebarProfile();
    } catch (err) {
        console.error('[Admin] loadStatus failed:', err);
        renderPasskeys([]);
        set2faBadge(null);
    } finally {
        const loader = document.getElementById('pageLoader');
        const content = document.getElementById('appContent');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.pointerEvents = 'none';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 260);
        }
        if (content) content.style.opacity = '1';
    }
}
window.reloadAccountStatus = loadStatus;

function updateOverviewHealthSummary(data) {
    const twoFaBadge = document.getElementById('summaryTwoFaBadge');
    if (twoFaBadge) {
        if (data.twoFaMethod) {
            twoFaBadge.className = 'badge badge-enabled';
            twoFaBadge.textContent = data.twoFaMethod === 'fido2' ? t('method_fido2_title') : t('method_totp_title');
        } else {
            twoFaBadge.className = 'badge badge-disabled';
            twoFaBadge.textContent = t('badge_disabled');
        }
    }

    const pkCount = document.getElementById('summaryPasskeyCount');
    if (pkCount) {
        const count = Array.isArray(data.passkeys) ? data.passkeys.length : 0;
        pkCount.textContent = count > 0 ? t('status_passkeys_count', count) : t('status_no_passkeys');
    }

    const rcCount = document.getElementById('summaryRcCount');
    if (rcCount) {
        if (!data.twoFaMethod) {
            rcCount.textContent = t('badge_disabled');
        } else if (data.recoveryCodesRemaining !== null && data.recoveryCodesRemaining !== undefined) {
            rcCount.textContent = t('status_rc_count', data.recoveryCodesRemaining);
        } else {
            rcCount.textContent = t('badge_not_gen');
        }
    }
}

function setupGlobalModalClosers() {
    document.querySelectorAll('.modal-close, .modal-btn-secondary:not([data-no-close="true"])').forEach(b => {
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

/* ============================================================================
 * SMTP Communication Preferences Mock Controller
 * ============================================================================ */
function setupSmtpEvents() {
    const testBtn = document.getElementById('testSmtpBtn');
    const saveBtn = document.getElementById('saveSmtpBtn');
    const msgEl = document.getElementById('smtpMsg');

    testBtn?.addEventListener('click', () => {
        if (msgEl) {
            msgEl.className = 'msg msg-info';
            msgEl.textContent = t('smtp_testing') || '正在测试 SMTP 连接...';
        }
        setTimeout(() => {
            if (msgEl) {
                msgEl.className = 'msg msg-ok';
                msgEl.textContent = t('smtp_test_success') || 'SMTP 连接测试成功！邮件通道畅通。';
            }
        }, 600);
    });

    saveBtn?.addEventListener('click', () => {
        if (msgEl) {
            msgEl.className = 'msg msg-ok';
            msgEl.textContent = t('smtp_save_success') || 'SMTP 配置已保存。';
        }
    });
}

/* ============================================================================
 * Settings Tab Preferences Controller (Language, Theme, Legal, & Logouts)
 * ============================================================================ */
function setupSettingsEvents() {
    /* 1. Language switcher & Subpage row selection */
    const langLabel = document.getElementById('currentLangLabel');
    const langRowZh = document.getElementById('langRowZh');
    const langRowEn = document.getElementById('langRowEn');

    function syncLanguageUI(lang) {
        const cur = lang || (window.i18n ? window.i18n.getLanguage() : 'zh-CN');
        if (langLabel) {
            langLabel.textContent = cur.startsWith('zh') ? '简体中文' : 'English';
        }
        if (langRowZh) {
            if (cur.startsWith('zh')) {
                langRowZh.classList.add('is-selected');
            } else {
                langRowZh.classList.remove('is-selected');
            }
        }
        if (langRowEn) {
            if (!cur.startsWith('zh')) {
                langRowEn.classList.add('is-selected');
            } else {
                langRowEn.classList.remove('is-selected');
            }
        }
    }
    syncLanguageUI();

    function selectLanguage(langCode) {
        if (window.i18n && typeof window.i18n.setLanguage === 'function') {
            window.i18n.setLanguage(langCode);
            syncLanguageUI(langCode);
            syncSidebarProfile();
        }
    }

    langRowZh?.addEventListener('click', () => selectLanguage('zh-CN'));
    langRowEn?.addEventListener('click', () => selectLanguage('en-US'));

    window.addEventListener('languagechange', () => {
        syncLanguageUI();
        syncSidebarProfile();
        const topTitle = document.getElementById('mobileNavTitle');
        if (topTitle && (!window.AquaKit || !window.AquaKit.isSubpageActive())) {
            topTitle.textContent = t('tab_' + (window.currentActiveTab || 'home'));
        }
    });

    /* 2. Appearance Theme switcher & Subpage row selection */
    const themeLabel = document.getElementById('currentThemeLabel');
    const themeRowAuto = document.getElementById('themeRowAuto');
    const themeRowDark = document.getElementById('themeRowDark');
    const themeRowLight = document.getElementById('themeRowLight');
    let currentTheme = localStorage.getItem('situla_theme') || 'auto';

    function applyTheme(theme) {
        currentTheme = theme;
        localStorage.setItem('situla_theme', theme);
        if (theme === 'auto') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        if (themeLabel) {
            themeLabel.textContent = theme === 'dark' ? t('theme_dark') : (theme === 'light' ? t('theme_light') : t('theme_auto'));
        }

        /* Synchronize checkmark state across subpage options */
        const themeRows = [themeRowAuto, themeRowDark, themeRowLight];
        themeRows.forEach(row => {
            if (!row) return;
            if (row.getAttribute('data-theme-choice') === theme) {
                row.classList.add('is-selected');
            } else {
                row.classList.remove('is-selected');
            }
        });
    }
    applyTheme(currentTheme);

    themeRowAuto?.addEventListener('click', () => applyTheme('auto'));
    themeRowDark?.addEventListener('click', () => applyTheme('dark'));
    themeRowLight?.addEventListener('click', () => applyTheme('light'));

    /* 3. Subpage and Link helpers */
    document.getElementById('editAvatarBtn')?.addEventListener('click', () => {
        document.getElementById('showUsernameFormBtn')?.click();
    });

    document.getElementById('learnDataBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert(`${t('subpage_personal_info')}\n\n${t('subpage_security_desc')}\n\n${t('settings_footer_note')}`);
    });

    document.getElementById('settingPrivacyRow')?.addEventListener('click', () => {
        alert(`${t('settings_privacy')}\n\n${t('settings_footer_note')}`);
    });

    /* 4. Settings Bottom Action Rows delegation */
    document.getElementById('logoutAllRow')?.addEventListener('click', (e) => {
        if (e.target.id !== 'logoutAllBtn') {
            document.getElementById('logoutAllBtn')?.click();
        }
    });

    document.getElementById('logoutRow')?.addEventListener('click', (e) => {
        if (e.target.id !== 'logoutBtn') {
            document.getElementById('logoutBtn')?.click();
        }
    });
}

function initDashboard() {
    /* Initialize device fingerprint routing and phone orientation blocker */
    try { initDeviceLayout(); } catch (e) { console.error('[Admin] initDeviceLayout failed:', e); }
    try { initOrientationGuard(); } catch (e) { console.error('[Admin] initOrientationGuard failed:', e); }
    try { initAdminNav(); } catch (e) { console.error('[Admin] initAdminNav failed:', e); }
    try { if (window.AquaKit && typeof window.AquaKit.initNavigationStack === 'function') window.AquaKit.initNavigationStack(); } catch (e) { console.error('[Admin] initNavigationStack failed:', e); }

    /* Initialize core dashboard module events */
    try { setupGlobalModalClosers(); } catch (e) { console.error('[Admin] setupGlobalModalClosers failed:', e); }
    try { setupProfileEvents(loadStatus); } catch (e) { console.error('[Admin] setupProfileEvents failed:', e); }
    try { setupPasskeyEvents(loadStatus); } catch (e) { console.error('[Admin] setupPasskeyEvents failed:', e); }
    try { setupFido2Events(loadStatus, openTotpSetup); } catch (e) { console.error('[Admin] setupFido2Events failed:', e); }
    try { setupTotpEvents(loadStatus); } catch (e) { console.error('[Admin] setupTotpEvents failed:', e); }
    try { setupRecoveryEvents(loadStatus); } catch (e) { console.error('[Admin] setupRecoveryEvents failed:', e); }
    try { setupOidcEvents(); } catch (e) { console.error('[Admin] setupOidcEvents failed:', e); }
    try { setupNpmGenerator(); } catch (e) { console.error('[Admin] setupNpmGenerator failed:', e); }
    try { setupLogsEvents(); } catch (e) { console.error('[Admin] setupLogsEvents failed:', e); }
    try { setupSmtpEvents(); } catch (e) { console.error('[Admin] setupSmtpEvents failed:', e); }
    try { setupSettingsEvents(); } catch (e) { console.error('[Admin] setupSettingsEvents failed:', e); }

    loadStatus();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
