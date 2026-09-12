/* ============================================================================
 * Situla Auth 2.0 — Apple HIG Passkey Management Coordinator (passkey.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import {
    t,
    escapeHTML,
    formatError,
    appleFormatDate,
    openAppleSheet,
    switchAppleSheetStep,
    closeAppleSheet,
    showAppleAlert
} from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

/* ============================================================================
 * Module State
 * ============================================================================ */
let cachedPasskeys = [];
let activePasskey = null;
let reloadAccountCallback = null;

/* ============================================================================
 * Passkey List Renderer (subpage-passkeys)
 * ============================================================================ */

/**
 * Renders the Apple HIG two-line passkey rows inside subpage-passkeys.
 * @param {Array} keys List of registered passkey records
 */
export function renderPasskeys(keys) {
    cachedPasskeys = Array.isArray(keys) ? keys : [];

    /* 1. Update Security subpage main row badge */
    const badge = document.getElementById('passkeyBadge');
    if (badge) {
        if (cachedPasskeys.length > 0) {
            badge.textContent = t('badge_pk_count', cachedPasskeys.length) || `${cachedPasskeys.length} 个`;
            badge.className = 'badge badge-count';
        } else {
            badge.textContent = t('badge_none') || '未添加';
            badge.className = 'badge badge-disabled';
        }
    }

    /* 2. Populate Passkeys subpage list */
    const list = document.getElementById('passkeyList');
    if (!list) return;

    if (cachedPasskeys.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = cachedPasskeys.map(k => {
        const passkeyName = escapeHTML(k.name || t('default_pk_name') || '通行密钥');
        const formattedDate = appleFormatDate(k.created_at);
        const subtitle = t('date_added_format', formattedDate) || `已于 ${formattedDate} 添加`;

        return `
            <div class="apple-two-line-row apple-clickable passkey-item" data-passkey-id="${k.id}">
                <div class="apple-two-line-content">
                    <span class="apple-two-line-title">${passkeyName}</span>
                    <span class="apple-two-line-subtitle">${subtitle}</span>
                </div>
                <div class="apple-row-right">
                    <svg class="apple-chevron apple-row-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>
        `;
    }).join('');
}

/* ============================================================================
 * Passkey Detail Subpage Actions (subpage-passkey-detail)
 * ============================================================================ */

/**
 * Prompts user to rename the currently active passkey.
 */
async function handleRenamePasskey() {
    if (!activePasskey) return;
    const currentName = activePasskey.name || t('default_pk_name') || '通行密钥';
    const newName = prompt(t('prompt_rename_pk') || '请输入新的名称：', currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    const trimmed = newName.trim();
    const { ok, data } = await fetchApi(`/api/passkeys/${activePasskey.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed })
    });

    if (ok && data?.success) {
        activePasskey.name = trimmed;
        const nameEl = document.getElementById('passkeyDetailNameText');
        if (nameEl) nameEl.textContent = trimmed;
        if (reloadAccountCallback) await reloadAccountCallback();
    } else {
        alert(data?.message || t('msg_change_failed') || '修改失败，请重试');
    }
}

/**
 * Displays an Apple HIG alert dialog to confirm and delete the active passkey.
 */
function handleDeletePasskey() {
    if (!activePasskey) return;

    showAppleAlert({
        title: t('alert_delete_pk') || '确定要删除此通行密钥吗？',
        desc: t('passkey_detail_desc') || '移除后你将无法再使用此通行密钥登录。',
        confirmText: t('btn_remove') || '移除',
        cancelText: t('btn_cancel') || '取消',
        onConfirm: async () => {
            const { ok, data } = await fetchApi(`/api/passkeys/${activePasskey.id}`, { method: 'DELETE' });
            if (ok && data?.success) {
                if (window.AquaKit && typeof window.AquaKit.popSubpage === 'function') {
                    window.AquaKit.popSubpage();
                }
                if (reloadAccountCallback) await reloadAccountCallback();
            } else {
                alert(data?.message || t('msg_delete_failed') || '删除失败，请重试');
            }
        }
    });
}

/* ============================================================================
 * Add Passkey Form Sheet Controller (stepPasskeyAdd -> stepPasskeySuccess)
 * ============================================================================ */

/**
 * Initiates WebAuthn registration for creating a new Passkey.
 */
async function submitAddPasskeyForm() {
    const input = document.getElementById('passkeyNameInput');
    const continueBtn = document.getElementById('passkeyContinueBtn');
    const msg = document.getElementById('passkeySheetMsg');

    const defaultLabel = t('default_pk_name') || '通行密钥';
    const passkeyName = (input?.value || '').trim() || defaultLabel;

    if (continueBtn) continueBtn.disabled = true;
    if (msg) {
        msg.textContent = t('status_updating') || '正在验证并创建...';
        msg.className = 'msg msg-info';
    }

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
            attResp.name = passkeyName;
            attResp.currentPassword = pwd;

            const { ok: verOk, data: verData } = await fetchApi('/api/webauthn/register-verify', {
                method: 'POST',
                body: JSON.stringify(attResp)
            });

            if (verOk && verData.verified) {
                switchAppleSheetStep('stepPasskeySuccess');
                return { success: true };
            } else {
                if (verData?.requireElevation) {
                    return { requireElevation: true, message: verData.message };
                }
                return { success: false, message: verData?.error || verData?.message || t('msg_passkey_failed') || '验证失败' };
            }
        } catch (e) {
            return { success: false, message: formatError(e, 'msg_passkey_failed') };
        }
    };

    const res = await actionFn('');

    if (res?.requireElevation) {
        if (continueBtn) continueBtn.disabled = false;
        enterSudoStep('sudoModal', async (pwd) => {
            const sudoRes = await actionFn(pwd);
            if (sudoRes.success) {
                return { success: true };
            }
            return { success: false, message: sudoRes.message || '验证失败' };
        });
        return;
    }

    if (continueBtn) continueBtn.disabled = false;

    if (!res?.success) {
        if (msg) {
            msg.textContent = res?.message || t('msg_passkey_failed') || '验证失败';
            msg.className = 'msg msg-err';
        }
    }
}

/* ============================================================================
 * Event Listener Initializer
 * ============================================================================ */

/**
 * Binds all interactive events for Passkeys subpage, detail subpage, and addition sheet.
 * @param {Function} onSuccessReload Status refresh callback
 */
export function setupPasskeyEvents(onSuccessReload) {
    reloadAccountCallback = onSuccessReload;

    /* 1. Delegate clicks on passkey list rows to open Detail Subpage */
    const list = document.getElementById('passkeyList');
    if (list) {
        list.addEventListener('click', (e) => {
            const row = e.target.closest('.passkey-item');
            if (!row) return;

            const passkeyId = row.getAttribute('data-passkey-id');
            const key = cachedPasskeys.find(k => String(k.id) === String(passkeyId));
            if (!key) return;

            activePasskey = key;

            /* Populate Detail subpage fields (IMG_0627.PNG layout) */
            const nameEl = document.getElementById('passkeyDetailNameText');
            const dateEl = document.getElementById('passkeyDetailDateText');
            if (nameEl) nameEl.textContent = key.name || t('default_pk_name') || '通行密钥';
            if (dateEl) dateEl.textContent = appleFormatDate(key.created_at);

            if (window.AquaKit && typeof window.AquaKit.pushSubpage === 'function') {
                window.AquaKit.pushSubpage('subpage-passkey-detail', {
                    title: t('passkey_detail_title') || '通行密钥',
                    parentTitle: t('section_pk_title') || '通行密钥'
                });
            }
        });
    }

    /* 2. Detail Subpage: Rename Passkey */
    document.getElementById('passkeyDetailNameRow')?.addEventListener('click', handleRenamePasskey);

    /* 3. Detail Subpage: Delete Passkey */
    document.getElementById('passkeyDetailDeleteBtn')?.addEventListener('click', handleDeletePasskey);

    /* 4. Passkeys Subpage: Open Add Passkey Sheet */
    document.getElementById('openAddPasskeySheetBtn')?.addEventListener('click', () => {
        const input = document.getElementById('passkeyNameInput');
        const msg = document.getElementById('passkeySheetMsg');
        const continueBtn = document.getElementById('passkeyContinueBtn');

        if (input) input.value = '';
        if (msg) {
            msg.textContent = '';
            msg.className = 'msg';
        }
        if (continueBtn) continueBtn.disabled = false;

        openAppleSheet('stepPasskeyAdd');

        if (input) {
            setTimeout(() => {
                input.focus();
            }, 120);
        }
    });

    /* 5. Add Passkey Sheet: Submit Form */
    document.getElementById('passkeyContinueBtn')?.addEventListener('click', submitAddPasskeyForm);
    document.getElementById('passkeyNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitAddPasskeyForm();
        }
    });

    /* 6. Success Step: Done button */
    document.getElementById('passkeySuccessDoneBtn')?.addEventListener('click', async () => {
        closeAppleSheet();
        if (reloadAccountCallback) await reloadAccountCallback();
    });
}
