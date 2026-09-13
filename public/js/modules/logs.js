/* ============================================================================
 * Situla Auth 2.0 — Security Audit & Login Logs Module (logs.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import { t, escapeHTML, openModal } from './ui.js';
import { fetchApi } from './api.js';

/**
 * Fetches recent login logs from server and renders into specified container.
 * @param {HTMLElement} listEl
 */
export async function loadAndRenderLogs(listEl) {
    if (!listEl) return;
    listEl.innerHTML = `
        <div class="apple-inline-updating" style="padding: 36px 16px; justify-content: center; display: flex; align-items: center; gap: 10px;">
            <div class="apple-spinner apple-spinner-md">
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
            </div>
            <span style="font-size: 14px; color: var(--apple-text-secondary);">${t('loading')}</span>
        </div>
    `;

    try {
        const { ok, data: logs } = await fetchApi('/api/login-logs');
        if (!ok || !Array.isArray(logs) || logs.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; color: var(--apple-text-secondary); padding: 36px 16px; font-size: 14px;">${t('status_no_logs')}</div>`;
            return;
        }

        listEl.innerHTML = '';
        logs.forEach(log => {
            const isoString = (log.created_at || '').replace(' ', 'T') + 'Z';
            const date = new Date(isoString);
            let localTime = log.created_at;
            if (!isNaN(date.getTime())) {
                const locale = window.i18n?.getLanguage?.() || window.i18n?.currentLocale || 'zh-CN';
                localTime = date.toLocaleString(locale, {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
            }

            let locStr = log.location || t('status_loc_unknown');
            if (locStr === 'Unknown Location' || locStr === 'Unknown' || locStr === '未知位置') {
                locStr = t('status_loc_unknown');
            }
            if (locStr === 'Local Network' || locStr === '局域网') {
                locStr = t('status_loc_lan');
            }

            let devStr = log.device || t('status_dev_unknown');
            if (devStr === 'Unknown Device' || devStr === '未知设备') {
                devStr = t('status_dev_unknown');
            }

            /* Distinguish mobile device vs desktop device for icon presentation */
            const devLower = devStr.toLowerCase();
            const isPhone = devLower.includes('iphone') || devLower.includes('mobile') || devLower.includes('android');
            const iconSvg = isPhone ?
                `<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2"></rect><circle cx="12" cy="18" r="1" fill="currentColor"></circle></svg>` :
                `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"></rect><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"></line><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"></line></svg>`;

            const div = document.createElement('div');
            div.className = 'apple-row apple-list-row has-badge';
            div.style.minHeight = '56px';
            div.style.padding = '10px 14px';

            div.innerHTML = `
                <div class="apple-row-left" style="gap: 12px;">
                    <div class="apple-badge badge-blue" style="width: 28px; height: 28px; border-radius: 7px;">
                        ${iconSvg}
                    </div>
                    <div class="apple-row-title-wrap">
                        <span class="apple-row-label" style="font-weight: 500; font-size: 14px;">${escapeHTML(locStr)} · ${escapeHTML(devStr)}</span>
                        <span class="apple-row-sublabel" style="font-family: var(--font-mono, monospace); font-size: 12px; color: var(--apple-text-secondary);">${escapeHTML(log.ip || '')}</span>
                    </div>
                </div>
                <div class="apple-row-right" style="flex-direction: column; align-items: flex-end; gap: 2px;">
                    <span class="apple-row-value" style="font-size: 12.5px; color: var(--apple-text-secondary);">${escapeHTML(localTime)}</span>
                </div>
            `;
            listEl.appendChild(div);
        });
    } catch (e) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--apple-red, #ff3b30); padding: 36px 16px; font-size: 14px;">${t('status_load_failed')}</div>`;
    }
}

export function setupLogsEvents() {
    /* Register global live logs loader hook for Tab 4 */
    window.__loadLiveLogs = () => {
        const liveContainer = document.getElementById('liveLoginLogsList');
        if (liveContainer) loadAndRenderLogs(liveContainer);
    };

    /* Tab 4 refresh button */
    document.getElementById('refreshLogsBtn')?.addEventListener('click', () => {
        window.__loadLiveLogs();
    });

    /* Modal trigger button */
    document.getElementById('viewLoginLogsBtn')?.addEventListener('click', () => {
        openModal('loginLogsModal');
        const modalList = document.getElementById('loginLogsList');
        if (modalList) loadAndRenderLogs(modalList);
    });

    /* Modal close button */
    document.getElementById('closeLoginLogsBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('loginLogsModal');
        if (modal) modal.style.display = 'none';
    });
}
