/**
 * public/js/modules/passkey.js
 * Passkey management and WebAuthn registration.
 */

import { fetchApi, enterSudoStep } from './api.js';
import { closeAllModals } from './ui.js';

export async function loadPasskeys() {
    const list = document.getElementById('passkeyList');
    if (!list) return;

    try {
        const { ok, data } = await fetchApi('/api/passkeys');
        if (!ok || !Array.isArray(data)) return;

        if (data.length === 0) {
            list.innerHTML = `<div style="color: #86868b; font-size: 14px; padding: 10px 0;">${window.t ? window.t('status_no_passkeys') : '暂无通行密钥'}</div>`;
            return;
        }

        list.innerHTML = data.map(k => `
            <div class="key-item">
                <div class="key-info">
                    <div class="key-name">${escapeHtml(k.name || '通行密钥')}</div>
                    <div class="key-meta">${k.created_at ? new Date(k.created_at).toLocaleDateString() : ''}</div>
                </div>
                <div class="key-actions">
                    <button class="btn-icon" data-action="rename" data-id="${k.id}" data-name="${escapeHtml(k.name || '')}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button class="btn-icon btn-danger" data-action="delete" data-id="${k.id}">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        attachItemEvents(list);
    } catch (e) {
        console.error('[Passkey] Load error:', e);
    }
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attachItemEvents(container) {
    container.querySelectorAll('button[data-action="delete"]').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm((window.t && window.t('msg_confirm_delete_passkey')) || '确定要删除此通行密钥吗？')) return;
            const id = btn.dataset.id;
            const { ok } = await fetchApi(`/api/passkeys/${id}`, { method: 'DELETE' });
            if (ok) loadPasskeys();
        };
    });

    container.querySelectorAll('button[data-action="rename"]').forEach(btn => {
        btn.onclick = async () => {
            const currentName = btn.dataset.name;
            const newName = prompt((window.t && window.t('msg_enter_new_key_name')) || '请输入新名称：', currentName);
            if (!newName || newName.trim() === currentName) return;
            const id = btn.dataset.id;
            const { ok } = await fetchApi(`/api/passkeys/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: newName.trim() })
            });
            if (ok) loadPasskeys();
        };
    });
}

export function setupPasskeyModal() {
    const addBtn = document.getElementById('addPasskeyBtn');
    const form = document.getElementById('passkeyStep1Form');
    if (!addBtn) return;

    addBtn.onclick = () => {
        const modal = document.getElementById('passkeyModal');
        if (modal) modal.style.display = 'flex';
    };

    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('passkeyNameInput');
            const keyName = (nameInput?.value || '通行密钥').trim();

            enterSudoStep('passkeyModal', async (currentPassword) => {
                const optRes = await fetchApi('/api/webauthn/register-options');
                if (!optRes.ok) throw new Error(optRes.data?.error || 'Failed to get options');

                const { startRegistration } = window.SimpleWebAuthnBrowser || {};
                if (!startRegistration) throw new Error('WebAuthn library not loaded');

                const attResp = await startRegistration(optRes.data);
                attResp._passkeyName = keyName;
                attResp.currentPassword = currentPassword;

                const verifyRes = await fetchApi('/api/webauthn/register-verify', {
                    method: 'POST',
                    body: JSON.stringify(attResp)
                });

                if (verifyRes.ok && verifyRes.data.verified) {
                    loadPasskeys();
                }
                return verifyRes;
            });
        };
    }
}
