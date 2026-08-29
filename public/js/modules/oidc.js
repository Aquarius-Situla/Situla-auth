/**
 * public/js/modules/oidc.js
 * OIDC Client Applications Management.
 */

import { fetchApi, enterSudoStep } from './api.js';
import { copyToClipboard } from './ui.js';

export async function loadOidcClients() {
    const list = document.getElementById('oidcClientList');
    if (!list) return;

    try {
        const { ok, data } = await fetchApi('/api/oidc/clients');
        if (!ok || !Array.isArray(data)) return;

        if (data.length === 0) {
            list.innerHTML = `<div style="color: #86868b; font-size: 14px; padding: 10px 0;">${window.t ? window.t('status_no_oidc_clients') : '暂无接入的应用'}</div>`;
            return;
        }

        list.innerHTML = data.map(c => `
            <div class="key-item">
                <div class="key-info">
                    <div class="key-name">${escapeHtml(c.client_name || 'OIDC 应用')}</div>
                    <div class="key-meta">ID: ${escapeHtml(c.client_id)} &bull; ${escapeHtml((c.redirect_uris || []).join(', '))}</div>
                </div>
                <div class="key-actions">
                    <button class="btn-icon btn-danger" data-action="delete-oidc" data-id="${c.id}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        attachOidcEvents(list);
    } catch (e) {
        console.error('[OIDC] Load clients error:', e);
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attachOidcEvents(container) {
    container.querySelectorAll('button[data-action="delete-oidc"]').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm((window.t && window.t('msg_confirm_delete_oidc')) || '确定要删除此应用吗？')) return;
            const id = btn.dataset.id;
            const { ok } = await fetchApi(`/api/oidc/clients/${id}`, { method: 'DELETE' });
            if (ok) loadOidcClients();
        };
    });
}

export function setupOidcModal() {
    const addBtn = document.getElementById('addOidcBtn');
    const form = document.getElementById('oidcStep1Form');
    const copyIdBtn = document.getElementById('copyOidcIdBtn');
    const copySecretBtn = document.getElementById('copyOidcSecretBtn');

    if (addBtn) {
        addBtn.onclick = () => {
            const modal = document.getElementById('oidcModal');
            if (modal) modal.style.display = 'flex';
        };
    }

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('oidcNameInput');
            const urisInput = document.getElementById('oidcUrisInput');

            const client_name = (nameInput?.value || '').trim();
            const redirect_uris = (urisInput?.value || '').split('\n').map(u => u.trim()).filter(Boolean);

            if (!client_name || redirect_uris.length === 0) return;

            enterSudoStep('oidcModal', async (currentPassword) => {
                const res = await fetchApi('/api/oidc/clients', {
                    method: 'POST',
                    body: JSON.stringify({ client_name, redirect_uris, currentPassword })
                });

                if (res.ok && res.data?.client_id) {
                    loadOidcClients();
                }
                return res;
            });
        };
    }

    if (copyIdBtn) {
        copyIdBtn.onclick = () => {
            const val = document.getElementById('newOidcClientId')?.textContent;
            if (val) copyToClipboard(val, copyIdBtn);
        };
    }

    if (copySecretBtn) {
        copySecretBtn.onclick = () => {
            const val = document.getElementById('newOidcClientSecret')?.textContent;
            if (val) copyToClipboard(val, copySecretBtn);
        };
    }
}
