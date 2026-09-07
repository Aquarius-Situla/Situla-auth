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
    listEl.innerHTML = `<div style="text-align: center; color: #86868b; padding: 24px;">${t('loading')}</div>`;

    try {
        const { ok, data: logs } = await fetchApi('/api/login-logs');
        if (!ok || !Array.isArray(logs) || logs.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; color: #86868b; padding: 24px;">${t('status_no_logs')}</div>`;
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

            const div = document.createElement('div');
            div.className = 'log-item';
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

            div.innerHTML = `
                <div class="log-details">${escapeHTML(locStr)} · ${escapeHTML(devStr)}</div>
                <div class="log-ip">${escapeHTML(log.ip || '')}</div>
                <div class="log-time">${escapeHTML(localTime)}</div>
            `;
            listEl.appendChild(div);
        });
    } catch (e) {
        listEl.innerHTML = `<div style="text-align: center; color: #ff3b30; padding: 24px;">${t('status_load_failed')}</div>`;
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
