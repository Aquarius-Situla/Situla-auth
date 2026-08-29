/**
 * public/js/modules/logs.js
 * Security audit & login logs retrieval and display.
 */

import { fetchApi } from './api.js';

export async function loadLoginLogs() {
    const listEl = document.getElementById('loginLogsList');
    if (!listEl) return;

    try {
        const { ok, data } = await fetchApi('/api/login-logs');
        if (!ok || !Array.isArray(data)) {
            listEl.innerHTML = `<div style="text-align: center; color: #ff3b30; padding: 20px;">${window.t ? window.t('status_load_failed') : '加载失败，请重试'}</div>`;
            return;
        }

        if (data.length === 0) {
            listEl.innerHTML = `<div style="text-align: center; color: #86868b; padding: 20px;">${window.t ? window.t('status_no_logs') : '暂无日志'}</div>`;
            return;
        }

        listEl.innerHTML = data.map(log => `
            <div class="log-item">
                <div class="log-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div class="log-details">
                    <div class="log-title">${escapeHtml(log.device || '未知设备')} &bull; ${escapeHtml(log.location || '未知位置')}</div>
                    <div class="log-meta">IP: ${escapeHtml(log.ip || '')} &bull; ${log.created_at ? new Date(log.created_at).toLocaleString() : ''}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('[Logs] Load error:', e);
        listEl.innerHTML = `<div style="text-align: center; color: #ff3b30; padding: 20px;">${window.t ? window.t('status_load_failed') : '加载失败，请重试'}</div>`;
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
