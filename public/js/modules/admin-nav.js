/* ============================================================================
 * Situla Auth 2.0 — Admin Navigation & Split View Controller (admin-nav.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import { t } from './ui.js';
import { generateIdenticonSvg } from './identicon.js';
import { isMobileLayout } from './device-detect.js';

/* ============================================================================
 * Tab Definitions & Mapping
 * ============================================================================ */
export const VALID_TABS = ['overview', 'credentials', 'integrations', 'logs'];

let currentActiveTab = 'overview';

/* Search index for the desktop sidebar search box */
const ADMIN_SEARCH_INDEX = [
    { id: 'profile', tab: 'overview', cardId: 'accountInfoCard', titleKey: 'section_username_title', keywords: ['username', 'email', 'password', '用户名', '邮箱', '密码', '修改'] },
    { id: 'health', tab: 'overview', cardId: 'securityHealthCard', titleKey: 'status_security_summary', keywords: ['health', 'score', 'status', '安全概览', '双重认证', '通行密钥'] },
    { id: 'passkeys', tab: 'credentials', cardId: 'passkeySection', titleKey: 'section_pk_title', keywords: ['passkey', 'webauthn', 'biometrics', '通行密钥', '面容', '指纹'] },
    { id: 'twofa', tab: 'credentials', cardId: 'twoFaSection', titleKey: 'section_2fa_title', keywords: ['2fa', 'totp', 'fido2', 'yubikey', '双重认证', '身份验证器', '安全密钥'] },
    { id: 'recovery', tab: 'credentials', cardId: 'rcCard', titleKey: 'section_rc_title', keywords: ['recovery', 'codes', 'backup', '恢复码', '应急', '备用码'] },
    { id: 'oidc', tab: 'integrations', cardId: 'oidcSection', titleKey: 'oidc_title', keywords: ['oidc', 'oauth', 'sso', 'client', '授权应用', '单点登录'] },
    { id: 'npm', tab: 'integrations', cardId: 'npmSection', titleKey: 'npm_section_title', keywords: ['npm', 'nginx', 'forward-auth', 'proxy', '反向代理', '防护配置'] },
    { id: 'logs', tab: 'logs', cardId: 'loginLogsCard', titleKey: 'logs_title', keywords: ['logs', 'audit', 'login', 'history', 'ip', '近期登录', '日志', '活动', '审计'] },
    { id: 'logout', tab: 'overview', cardId: 'sessionActionsCard', titleKey: 'btn_logout', keywords: ['logout', 'signout', 'session', '退出登录', '所有设备'] }
];

/* ============================================================================
 * Tab Switching Engine
 * ============================================================================ */

/**
 * Switches the active tab across both Desktop Sidebar and Mobile Tab Bar.
 * @param {string} tabId One of 'overview', 'credentials', 'integrations', 'logs'
 * @param {boolean} updateHash Whether to update window.location.hash
 */
export function switchTab(tabId, updateHash = true) {
    if (!VALID_TABS.includes(tabId)) {
        tabId = 'overview';
    }

    currentActiveTab = tabId;
    window.switchTab = switchTab;

    /* 1. Update tab-pane active class with smooth fade */
    const stage = document.getElementById('desktop-stage');
    if (stage) {
        stage.classList.add('stage-fading');
    }

    setTimeout(() => {
        document.querySelectorAll('.tab-pane').forEach(pane => {
            if (pane.id === `tab-pane-${tabId}`) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        if (stage) {
            stage.classList.remove('stage-fading');
        }

        /* If switching to logs tab, notify logs module to load */
        if (tabId === 'logs' && window.__loadLiveLogs) {
            window.__loadLiveLogs();
        }
    }, 90);

    /* 2. Synchronize desktop sidebar navigation active items */
    const sidebar = document.getElementById('desktop-sidebar');
    if (sidebar) {
        sidebar.querySelectorAll('.desktop-nav-item').forEach(item => {
            if (item.getAttribute('data-tab-id') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        /* Trigger fluid sliding indicator glide */
        glideNavIndicator(tabId);
    }

    /* 3. Synchronize mobile bottom tab bar active items */
    const tabBar = document.getElementById('apple-tab-bar');
    if (tabBar) {
        tabBar.querySelectorAll('.tab-item').forEach(item => {
            if (item.getAttribute('data-tab-id') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /* 4. Synchronize mobile top nav bar title */
    const topTitle = document.getElementById('mobileNavTitle');
    if (topTitle) {
        topTitle.textContent = t(`tab_${tabId}`);
    }

    /* 5. Update URL hash */
    if (updateHash && window.location.hash !== `#${tabId}`) {
        window.history.replaceState(null, '', `#${tabId}`);
    }
}

/* ============================================================================
 * Desktop Sliding Capsule Indicator
 * ============================================================================ */
export function glideNavIndicator(tabId) {
    const sidebar = document.getElementById('desktop-sidebar');
    if (!sidebar) return;

    const indicator = sidebar.querySelector('.desktop-nav-indicator');
    const activeItem = sidebar.querySelector(`.desktop-nav-item[data-tab-id="${tabId}"]`);
    if (!indicator || !activeItem) return;

    const itemTop = activeItem.offsetTop;
    const itemHeight = activeItem.offsetHeight;

    indicator.style.top = `${itemTop + (itemHeight - 16) / 2}px`;
    indicator.style.opacity = '1';
}

/* ============================================================================
 * Apple Music Style Compact Profile Synchronizer
 * ============================================================================ */
export function syncSidebarProfile() {
    const username = window.currentUsername || 'Administrator';

    /* Generate and inject 16x16 Identicon avatar */
    const avatarContainer = document.getElementById('desktopProfileAvatar');
    if (avatarContainer) {
        avatarContainer.innerHTML = generateIdenticonSvg(username, 16);
    }

    /* Also inject into Overview profile header avatar */
    const overviewAvatar = document.getElementById('overviewUserAvatar');
    if (overviewAvatar) {
        overviewAvatar.innerHTML = generateIdenticonSvg(username, 48);
    }

    /* Set username with native browser tooltip */
    const usernameEl = document.getElementById('desktopProfileUsername');
    if (usernameEl) {
        usernameEl.textContent = username;
        usernameEl.setAttribute('title', username);
    }

    const card = document.getElementById('desktopProfileCard');
    if (card) {
        card.setAttribute('title', username);
        setupProfileCopyHandler(card, usernameEl, username);
    }
}

function setupProfileCopyHandler(card, textEl, username) {
    if (!card || card.dataset.copyBound === 'true') return;
    card.dataset.copyBound = 'true';

    let resetTimer = null;

    card.addEventListener('click', async (e) => {
        e.stopPropagation();

        let copied = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(username);
                copied = true;
            }
        } catch (err) {
            /* Fallback to execCommand */
        }

        if (!copied) {
            try {
                const ta = document.createElement('textarea');
                ta.value = username;
                ta.style.position = 'fixed';
                ta.style.top = '-9999px';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                copied = true;
            } catch (err) {
                /* Ignore */
            }
        }

        if (textEl) {
            if (resetTimer) clearTimeout(resetTimer);
            const originalColor = textEl.style.color;
            textEl.textContent = `✓ ${t('user_profile_copied')}`;
            textEl.style.color = '#30d158';

            resetTimer = setTimeout(() => {
                textEl.textContent = username;
                textEl.style.color = originalColor;
            }, 1500);
        }
    });
}

/* ============================================================================
 * Search Interaction Engine
 * ============================================================================ */
function setupDesktopSearch() {
    const searchInput = document.getElementById('desktopSearchInput');
    const searchDropdown = document.getElementById('desktopSearchDropdown');
    if (!searchInput || !searchDropdown) return;

    function renderSearchResults(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            searchDropdown.classList.remove('active');
            searchDropdown.innerHTML = '';
            return;
        }

        const matched = ADMIN_SEARCH_INDEX.filter(item => {
            const title = t(item.titleKey).toLowerCase();
            const kw = item.keywords.join(' ').toLowerCase();
            return title.includes(q) || kw.includes(q);
        });

        if (matched.length === 0) {
            searchDropdown.innerHTML = `<div class="desktop-search-empty">${t('search_no_results')}</div>`;
            searchDropdown.classList.add('active');
            return;
        }

        searchDropdown.innerHTML = matched.slice(0, 6).map(item => {
            const title = t(item.titleKey);
            const tabName = t(`tab_${item.tab}`);
            return `
                <div class="desktop-search-item" data-target-tab="${item.tab}" data-target-card="${item.cardId}">
                    <span class="desktop-search-item-title">${title}</span>
                    <span class="desktop-search-item-badge">${tabName}</span>
                </div>
            `;
        }).join('');

        searchDropdown.classList.add('active');

        searchDropdown.querySelectorAll('.desktop-search-item').forEach(el => {
            el.addEventListener('click', () => {
                const targetTab = el.getAttribute('data-target-tab');
                const targetCard = el.getAttribute('data-target-card');

                searchDropdown.classList.remove('active');
                searchInput.value = '';

                switchTab(targetTab);

                setTimeout(() => {
                    const cardEl = document.getElementById(targetCard);
                    if (cardEl) {
                        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        cardEl.classList.add('card-highlight');
                        setTimeout(() => cardEl.classList.remove('card-highlight'), 1800);
                    }
                }, 150);
            });
        });
    }

    searchInput.addEventListener('input', (e) => {
        renderSearchResults(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchDropdown.classList.remove('active');
            searchInput.blur();
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.desktop-search-box')) {
            searchDropdown.classList.remove('active');
        }
    });
}

/* ============================================================================
 * iOS Standalone WebApp Viewport & Tab Bar Synchronizer
 * ============================================================================ */
export function syncStandaloneTabBar() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const isIOSStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
    const isPWAStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

    if (!isIOSStandalone && !isPWAStandalone) {
        return;
    }

    document.documentElement.classList.add('is-standalone');

    const tabBar = document.getElementById('apple-tab-bar');
    if (!tabBar) {
        requestAnimationFrame(syncStandaloneTabBar);
        return;
    }

    tabBar.style.removeProperty('bottom');
}

/* ============================================================================
 * Initializer & Event Binder
 * ============================================================================ */
export function initAdminNav() {
    /* 1. Bind tab click events for desktop sidebar */
    document.querySelectorAll('.desktop-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab-id');
            if (tabId) switchTab(tabId);
        });
    });

    /* 2. Bind tab click events for mobile bottom tab bar */
    document.querySelectorAll('.apple-tab-bar .tab-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab-id');
            if (tabId) switchTab(tabId);
        });
    });

    /* 3. Setup desktop search box */
    setupDesktopSearch();

    /* 4. Restore initial tab from URL hash if valid */
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (VALID_TABS.includes(hash)) {
        switchTab(hash, false);
    } else {
        switchTab('overview', false);
    }

    /* 5. Standalone WebApp lifecycle synchronization */
    syncStandaloneTabBar();
    window.addEventListener('resize', syncStandaloneTabBar);
    window.addEventListener('orientationchange', syncStandaloneTabBar);
    window.addEventListener('pageshow', syncStandaloneTabBar);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncStandaloneTabBar);
        window.visualViewport.addEventListener('scroll', syncStandaloneTabBar);
    }

    /* 6. Re-align desktop indicator on window resize */
    window.addEventListener('resize', () => {
        if (!isMobileLayout()) {
            glideNavIndicator(currentActiveTab);
        }
    });

    /* 7. Initial indicator alignment */
    setTimeout(() => {
        glideNavIndicator(currentActiveTab);
        syncSidebarProfile();
    }, 150);
}
