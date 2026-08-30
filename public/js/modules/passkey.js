/**
 * public/js/modules/passkey.js
 * Passkey WebAuthn registration and list management (pixel-perfect DOM and CSS).
 */

import { t, escapeHTML, fmtDate, closeAllModals, setModalActionsLoading } from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

export function renderPasskeys(keys) {
    const list = document.getElementById('passkeyList');
    const badge = document.getElementById('passkeyBadge');
    if (!list) return;

    if (!keys || keys.length === 0) {
        list.innerHTML = '';
        if (badge) {
            badge.textContent = t('badge_none') || '未添加';
            badge.className = 'badge badge-disabled';
        }
        return;
    }

    if (badge) {
        badge.textContent = t('badge_pk_count', keys.length) || `${keys.length} 个`;
        badge.className = 'badge badge-count';
    }

    list.innerHTML = keys.map(k => `
        <div class="passkey-item" id="pk-${k.id}">
            <div class="passkey-icon">
                <svg viewBox="0 0 825 825" width="22" height="22" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(0,825) scale(0.1,-0.1)" fill="currentColor" stroke="none">
                        <path d="M3396 7389 c-509 -44 -957 -406 -1146 -927 -72 -196 -100 -364 -100 -587 0 -474 192 -934 521 -1250 142 -137 255 -215 410 -282 89 -38 104 -43 244 -75 260 -59 579 6 817 166 29 20 56 36 60 36 15 0 308 279 308 293 0 2 25 41 56 87 69 104 175 319 209 425 37 119 74 287 86 400 16 139 6 384 -21 518 -36 186 -115 393 -202 532 -101 159 -256 334 -370 415 -27 18 -48 38 -48 43 0 6 -2 8 -6 5 -3 -3 -42 15 -87 41 -148 85 -328 144 -472 156 -140 11 -172 12 -259 4z"/>
                        <path d="M6305 4921 c-211 -50 -378 -153 -542 -334 -139 -152 -235 -331 -278 -517 -23 -99 -31 -302 -16 -413 35 -263 164 -517 351 -690 69 -64 181 -145 233 -168 l27 -12 0 -837 0 -836 110 -110 c61 -61 110 -108 110 -106 0 2 12 -6 27 -18 25 -19 38 -21 214 -20 l187 2 88 91 c122 126 207 218 287 309 54 63 67 84 67 111 0 41 -12 58 -185 246 -77 84 -141 156 -143 160 -2 7 179 210 340 379 78 82 79 84 77 130 -3 46 -6 50 -169 215 -91 93 -169 175 -173 183 -13 24 -57 64 -70 65 -13 0 27 18 52 22 74 13 257 134 358 236 197 200 298 440 310 737 12 308 -60 537 -248 785 -137 181 -346 322 -559 379 -120 32 -342 37 -455 11z m336 -578 c65 -29 111 -73 145 -140 25 -50 29 -69 29 -138 -1 -110 -16 -154 -76 -219 -68 -75 -137 -108 -227 -108 -71 -1 -142 16 -142 33 0 6 -4 8 -9 5 -5 -3 -29 10 -55 29 -47 37 -90 99 -107 157 -14 50 -13 148 4 196 18 52 58 112 74 112 6 0 15 5 19 12 5 7 3 8 -6 3 -9 -5 -11 -4 -6 3 4 7 13 12 21 12 7 0 16 7 19 16 3 8 10 13 15 10 5 -4 11 -1 13 4 14 42 205 51 289 13z"/>
                        <path d="M3210 3630 c-36 -5 -87 -11 -115 -14 -27 -2 -61 -6 -75 -9 -14 -4 -84 -18 -156 -32 -135 -26 -321 -76 -459 -122 -44 -15 -82 -28 -85 -28 -5 -2 -13 -5 -120 -50 -222 -94 -519 -273 -700 -424 -93 -77 -251 -234 -325 -321 -303 -361 -495 -809 -495 -1154 0 -185 46 -302 157 -406 35 -33 83 -70 106 -81 23 -12 44 -24 47 -28 3 -3 12 -8 20 -10 8 -2 44 -13 80 -25 l65 -21 2262 -3 c2154 -2 2262 -1 2265 15 3 10 -1 30 -9 45 -7 15 -15 35 -16 45 -2 10 -10 32 -18 48 -11 25 -14 159 -17 737 l-3 706 -89 81 c-83 76 -200 211 -183 211 5 0 3 4 -3 8 -40 27 -139 225 -165 330 -15 60 -17 62 -179 142 -58 29 -108 58 -112 64 -4 6 -8 8 -8 4 0 -3 -42 12 -92 34 -268 116 -561 199 -863 244 -128 18 -612 28 -715 14z"/>
                    </g>
                </svg>
            </div>
            <div class="passkey-info">
                <span class="passkey-name" id="pk-name-${k.id}">${escapeHTML(k.name || t('default_pk_name') || '通行密钥')}</span>
                <span class="passkey-date">${fmtDate(k.created_at)}</span>
            </div>
            <div class="passkey-actions">
                <button class="pk-btn pk-rename" data-action="rename" data-id="${k.id}" title="重命名" aria-label="重命名">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="pk-btn pk-delete" data-action="delete" data-id="${k.id}" title="删除" aria-label="删除">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

export async function deletePasskey(id) {
    if (!confirm(t('alert_delete_pk') || '确定要删除此通行密钥吗？')) return;
    const { ok, data } = await fetchApi(`/api/passkeys/${id}`, { method: 'DELETE' });
    if (ok && data?.success) {
        document.getElementById(`pk-${id}`)?.remove();
        const remaining = document.querySelectorAll('#passkeyList .passkey-item').length;
        const badge = document.getElementById('passkeyBadge');
        if (badge) {
            badge.textContent = remaining > 0 ? (t('badge_pk_count', remaining) || `${remaining} 个`) : (t('badge_none') || '未添加');
            badge.className = remaining > 0 ? 'badge badge-count' : 'badge badge-disabled';
        }
    }
}

export async function renamePasskey(id) {
    const current = document.getElementById(`pk-name-${id}`)?.textContent || t('default_pk_name') || '通行密钥';
    const newName = prompt(t('prompt_rename_pk') || '请输入新名称：', current);
    if (!newName || newName.trim() === current) return;
    const { ok, data } = await fetchApi(`/api/passkeys/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName.trim() })
    });
    if (ok && data?.success) {
        const el = document.getElementById(`pk-name-${id}`);
        if (el) el.textContent = newName.trim();
    }
}

export function setupPasskeyEvents(onSuccessReload) {
    const list = document.getElementById('passkeyList');
    if (list) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.pk-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'rename') renamePasskey(id);
            if (action === 'delete') deletePasskey(id);
        });
    }

    const regBtn = document.getElementById('regPasskeyBtn');
    if (regBtn) {
        regBtn.addEventListener('click', () => {
            closeAllModals();
            const modal = document.getElementById('passkeyModal');
            if (modal) modal.style.display = 'flex';
            const step1 = document.getElementById('passkeyStep1');
            const step2 = document.getElementById('passkeyStep2');
            if (step1) step1.style.display = 'block';
            if (step2) step2.style.display = 'none';
            const nameInput = document.getElementById('passkeyDeviceName');
            if (nameInput) nameInput.value = '';
            const msg1 = document.getElementById('passkeyMsg1');
            if (msg1) {
                msg1.textContent = '';
                msg1.className = 'msg';
            }
            const actions1 = step1 ? step1.querySelector('.modal-actions') : null;
            if (actions1) setModalActionsLoading(actions1, false);
        });
    }

    document.getElementById('cancelPasskeyBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelPasskeyBtn2')?.addEventListener('click', closeAllModals);

    const continueBtn = document.getElementById('continuePasskeyBtn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            const passkeyName = document.getElementById('passkeyDeviceName')?.value?.trim() || t('default_pk_name') || '通行密钥';
            const msg1 = document.getElementById('passkeyMsg1');
            if (msg1) msg1.textContent = '';

            const actionFn = async (pwd) => {
                const { ok: optOk, data: options } = await fetchApi('/api/webauthn/register-options');
                if (!optOk) {
                    return { success: false, message: options?.error || options?.message || '获取配置失败' };
                }

                try {
                    const { startRegistration } = window.SimpleWebAuthnBrowser || {};
                    if (!startRegistration) throw new Error('WebAuthn library not loaded');

                    const attResp = await startRegistration(options);
                    attResp._passkeyName = passkeyName;
                    attResp.currentPassword = pwd;

                    const { ok: verOk, data: verData } = await fetchApi('/api/webauthn/register-verify', {
                        method: 'POST',
                        body: JSON.stringify(attResp)
                    });

                    if (verOk && verData.verified) {
                        if (onSuccessReload) onSuccessReload();
                        return { success: true };
                    } else {
                        return { success: false, message: verData.error || verData.message || t('msg_passkey_failed') || '验证失败' };
                    }
                } catch (e) {
                    return { success: false, message: (t('msg_passkey_canceled') || '已取消') + ': ' + (e.message || '') };
                }
            };

            enterSudoStep('passkeyModal', actionFn);
        });
    }
}
