/**
 * public/js/modules/logs.js
 * Security Audit & Login Logs modal (pixel-perfect list rendering).
 */

import { t, escapeHTML } from './ui.js';
import { fetchApi } from './api.js';

export function setupLogsEvents() {
    document.getElementById('viewLoginLogsBtn')?.addEventListener('click', async () => {
        const modal = document.getElementById('loginLogsModal');
        const listEl = document.getElementById('loginLogsList');
        if (modal) modal.style.display = 'flex';
        if (listEl) listEl.innerHTML = `<div style="text-align: center; color: #86868b; padding: 20px;">${t('loading') || '加载中...'}</div>`;

        try {
            const { ok, data: logs } = await fetchApi('/api/login-logs');
            if (!ok || !Array.isArray(logs) || logs.length === 0) {
                if (listEl) listEl.innerHTML = `<div style="text-align: center; color: #86868b; padding: 20px;">${t('status_no_logs') || '暂无日志'}</div>`;
                return;
            }

            if (listEl) {
                listEl.innerHTML = '';
                logs.forEach(log => {
                    const isoString = (log.created_at || '').replace(' ', 'T') + 'Z';
                    const date = new Date(isoString);
                    let localTime = log.created_at;
                    if (!isNaN(date.getTime())) {
                        const locale = (window.i18n && window.i18n.currentLocale) ? window.i18n.currentLocale : 'zh-CN';
                        localTime = date.toLocaleString(locale, {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                        });
                    }

                    const div = document.createElement('div');
                    div.className = 'log-item';
                    let locStr = log.location || t('status_loc_unknown') || '未知位置';
                    if (locStr === 'Unknown Location' || locStr === 'Unknown' || locStr === '未知位置') {
                        locStr = t('status_loc_unknown') || '未知位置';
                    }
                    if (locStr === 'Local Network' || locStr === '局域网') {
                        locStr = t('status_loc_lan') || '局域网';
                    }

                    let devStr = log.device || t('status_dev_unknown') || '未知设备';
                    if (devStr === 'Unknown Device' || devStr === '未知设备') {
                        devStr = t('status_dev_unknown') || '未知设备';
                    }

                    div.innerHTML = `
                        <div class="log-details">${escapeHTML(locStr)} · ${escapeHTML(devStr)}</div>
                        <div class="log-ip">${escapeHTML(log.ip || '')}</div>
                        <div class="log-time">${escapeHTML(localTime)}</div>
                    `;
                    listEl.appendChild(div);
                });
            }
        } catch (e) {
            if (listEl) listEl.innerHTML = `<div style="text-align: center; color: #ff3b30; padding: 20px;">${t('status_load_failed') || '加载失败，请重试'}</div>`;
        }
    });

    document.getElementById('closeLoginLogsBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('loginLogsModal');
        if (modal) modal.style.display = 'none';
    });
}
