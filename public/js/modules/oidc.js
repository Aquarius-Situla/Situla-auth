/**
 * public/js/modules/oidc.js
 * OIDC Application Management (pixel-perfect list and Sudo modal).
 */

import { t, escapeHTML, closeAllModals, openModal } from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

export async function loadOidcClients() {
    const list = document.getElementById('oidcClientList');
    if (!list) return;

    try {
        const { ok, data } = await fetchApi('/api/oidc/clients');
        if (!ok || !data) return;

        list.innerHTML = '';
        if (!Array.isArray(data) || data.length === 0) {
            list.innerHTML = `<div style="color: #86868b; font-size: 14px; padding: 10px 0;">${t('status_no_oidc_clients') || '暂无接入的应用'}</div>`;
            return;
        }

        data.forEach(client => {
            const item = document.createElement('div');
            item.className = 'passkey-item';

            const info = document.createElement('div');
            info.className = 'passkey-info';

            const name = document.createElement('span');
            name.className = 'passkey-name';
            name.textContent = client.client_name;

            const meta = document.createElement('span');
            meta.className = 'passkey-date';
            meta.textContent = client.client_id;

            info.appendChild(name);
            info.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'passkey-actions';

            const delBtn = document.createElement('button');
            delBtn.className = 'pk-btn pk-delete';
            delBtn.setAttribute('title', '删除');
            delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>`;

            delBtn.onclick = async () => {
                delBtn.blur();
                if (document.activeElement) document.activeElement.blur();
                const confirmed = confirm(t('confirm_delete_oidc') || '确定删除该第三方应用？删除后它将无法通过本系统登录。');
                delBtn.blur();
                if (document.activeElement) document.activeElement.blur();
                if (!confirmed) return;
                const actionFn = async () => {
                    const r = await fetchApi('/api/oidc/clients/' + client.id, { method: 'DELETE' });
                    return r;
                };
                enterSudoStep('sudoModal', actionFn);
                setTimeout(loadOidcClients, 500);
            };

            actions.appendChild(delBtn);
            item.appendChild(info);
            item.appendChild(actions);
            list.appendChild(item);
        });
    } catch (e) {
        console.error('[OIDC] Error loading clients:', e);
    }
}

export function setupOidcEvents() {
    document.getElementById('addOidcBtn')?.addEventListener('click', () => {
        openModal('oidcModal');
    });

    document.getElementById('cancelOidcBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelOidcBtn2')?.addEventListener('click', closeAllModals);

    document.getElementById('continueOidcBtn')?.addEventListener('click', () => {
        const name = document.getElementById('oidcAppName')?.value?.trim() || '';
        let uris = document.getElementById('oidcRedirectUris')?.value?.trim() || '';
        const msg1 = document.getElementById('oidcMsg1');
        if (msg1) msg1.textContent = '';

        if (!name || !uris) {
            if (msg1) {
                msg1.textContent = t('msg_fill_all_fields') || '请填写所有必填字段';
                msg1.className = 'msg msg-err';
            }
            return;
        }

        const uriList = uris.split('\n').map(u => u.trim()).filter(Boolean);

        const actionFn = async (pwd) => {
            const res = await fetchApi('/api/oidc/clients', {
                method: 'POST',
                body: JSON.stringify({ client_name: name, redirect_uris: uriList, currentPassword: pwd })
            });

            if (res.ok && res.data?.client_id) {
                loadOidcClients();
            }
            return res;
        };

        enterSudoStep('oidcModal', actionFn);
    });

    document.getElementById('finishOidcSecretBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('oidcModal');
        if (modal) modal.style.display = 'none';
    });
}
