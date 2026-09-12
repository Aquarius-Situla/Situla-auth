/* ============================================================================
 * Situla Auth 2.0 — Apple HIG FIDO2 Hardware Key Management & 2FA Coordinator
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import {
    t,
    escapeHTML,
    closeAllModals,
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
let cachedFido2Keys = [];
let activeFido2Key = null;
let currentTwoFaMethod = null;
let reloadAccountCallback = null;

let wizardState = {
    mode: 'two-keys',
    keyIndex: 1,
    pendingAttResp: null
};

/* ============================================================================
 * 2FA Status & Badge Synchronization
 * ============================================================================ */

/**
 * Updates 2FA status badges and action cards across Security and TwoFA subpages.
 * @param {string|null} method Active 2FA method ('totp' | 'fido2' | null)
 * @param {number} fido2Count Number of configured FIDO2 security keys
 */
export function set2faBadge(method, fido2Count = 0) {
    currentTwoFaMethod = method;

    /* 1. Update Security subpage main row badge */
    const badge = document.getElementById('twoFaBadge');
    if (badge) {
        if (method === 'fido2') {
            badge.className = 'badge badge-enabled';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${t('badge_2fa_fido2') || 'FIDO2 已启用'}`;
        } else if (method === 'totp') {
            badge.className = 'badge badge-enabled';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${t('badge_2fa_totp') || 'TOTP 已启用'}`;
        } else if (!method && fido2Count > 0) {
            badge.className = 'badge badge-error';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${t('badge_downgraded') || '已降级'}`;
        } else {
            badge.className = 'badge badge-disabled';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${t('badge_disabled') || '未启用'}`;
        }
    }

    /* 2. Update Two-Factor Authentication subpage elements */
    const totpBadge = document.getElementById('twoFaTotpBadge');
    if (totpBadge) {
        if (method === 'totp') {
            totpBadge.className = 'badge badge-enabled';
            totpBadge.textContent = t('badge_enabled') || '已启用';
        } else {
            totpBadge.className = 'badge badge-disabled';
            totpBadge.textContent = t('badge_disabled') || '未启用';
        }
    }

    /* 3. Toggle Remove All Keys standalone danger card */
    const removeAllCard = document.getElementById('removeAllKeysGroup');
    const removeAllNote = document.getElementById('removeAllKeysFootnote');
    if (removeAllCard) {
        removeAllCard.style.display = fido2Count > 0 ? 'block' : 'none';
    }
    if (removeAllNote) {
        removeAllNote.style.display = fido2Count > 0 ? 'block' : 'none';
    }

    /* 4. Update TOTP action button label */
    const totpActionText = document.getElementById('setupTotpInTwoFaText');
    if (totpActionText) {
        totpActionText.textContent = method === 'totp' ? (t('totp_reconfigure_title') || '重新配置身份验证器') : (t('totp_setup_title') || '设置身份验证器');
    }
}

/* ============================================================================
 * Key List Renderer (subpage-twofa)
 * ============================================================================ */

/**
 * Renders the Apple HIG two-line security key rows inside subpage-twofa.
 * @param {Array} keys List of registered FIDO2 security key records
 * @param {string} [method] Current active 2FA method
 */
export function renderFido2Keys(keys, method) {
    cachedFido2Keys = Array.isArray(keys) ? keys : [];
    if (method !== undefined) currentTwoFaMethod = method;

    const list = document.getElementById('fido2KeyList');
    if (!list) return;

    if (cachedFido2Keys.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = cachedFido2Keys.map(k => {
        const keyName = escapeHTML(k.name || t('default_fido2_key_name') || '安全密钥');
        const formattedDate = appleFormatDate(k.created_at);
        const subtitle = t('date_added_format', formattedDate) || `已于 ${formattedDate} 添加`;

        return `
            <div class="apple-two-line-row apple-clickable fido2-key-item" data-key-id="${k.id}">
                <div class="apple-two-line-content">
                    <span class="apple-two-line-title">${keyName}</span>
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
 * FIDO2 Registration Sheet Wizard Controller (IMG_0603 to IMG_0607)
 * ============================================================================ */

/**
 * Starts the WebAuthn challenge/registration prompt inside stepFido2Prompt.
 */
async function startFido2WebAuthnPrompt() {
    const promptTitle = document.getElementById('fido2PromptTitle');
    const promptDesc = document.getElementById('fido2PromptDesc');
    const spinner = document.getElementById('fido2PromptSpinner');
    const actions = document.getElementById('fido2PromptActions');
    const msg = document.getElementById('fido2PromptMsg');

    /* Configure step text according to wizard state */
    if (wizardState.mode === 'two-keys') {
        if (wizardState.keyIndex === 1) {
            if (promptTitle) promptTitle.textContent = t('fido2_add_first_title') || '添加第一个安全密钥';
            if (promptDesc) promptDesc.textContent = t('fido2_add_first_desc') || '将第一个安全密钥插入或靠近此设备，然后按照屏幕指示操作。';
        } else {
            if (promptTitle) promptTitle.textContent = t('fido2_add_second_title') || '添加第二个安全密钥';
            if (promptDesc) promptDesc.textContent = t('fido2_add_second_desc') || '将第二个安全密钥插入或靠近此设备，然后按照屏幕指示操作。';
        }
    } else {
        if (promptTitle) promptTitle.textContent = t('fido2_add_title') || '添加安全密钥';
        if (promptDesc) promptDesc.textContent = t('fido2_add_desc') || '将安全密钥插入或靠近此设备，然后按照屏幕指示操作。';
    }

    if (spinner) spinner.style.display = 'flex';
    if (actions) actions.style.display = 'none';
    if (msg) {
        msg.textContent = '';
        msg.className = 'msg';
    }

    try {
        const { ok, data: options } = await fetchApi('/api/fido2/register-options');
        if (!ok || !options) {
            throw new Error(options?.error || options?.message || '获取注册选项失败');
        }

        const { startRegistration } = window.SimpleWebAuthnBrowser || {};
        if (!startRegistration) {
            throw new Error('WebAuthn library not loaded');
        }

        /* Trigger device WebAuthn / NFC touch */
        const attResp = await startRegistration(options);
        wizardState.pendingAttResp = attResp;

        /* Hardware touch completed, transition to key naming step */
        advanceToFido2NamingStep();
    } catch (err) {
        if (spinner) spinner.style.display = 'none';
        if (actions) actions.style.display = 'flex';
        if (msg) {
            msg.textContent = formatError(err, 'fido2_verify_failed');
            msg.className = 'msg msg-err';
        }
    }
}

/**
 * Transitions the wizard to the key naming step (stepFido2Name).
 */
function advanceToFido2NamingStep() {
    switchAppleSheetStep('stepFido2Name');

    const nameTitle = document.getElementById('fido2NameTitle');
    const input = document.getElementById('fido2KeyNameInput');
    const nextBtn = document.getElementById('fido2NameNextBtn');
    const navNextBtn = document.getElementById('sheetNavNextBtn');
    const msg = document.getElementById('fido2NameMsg');

    if (nextBtn) nextBtn.disabled = false;
    if (navNextBtn) navNextBtn.style.display = 'block';
    if (msg) {
        msg.textContent = '';
        msg.className = 'msg';
    }

    const defaultKeyLabel = t('default_fido2_key_name') || '安全密钥';

    if (wizardState.mode === 'two-keys') {
        if (wizardState.keyIndex === 1) {
            if (nameTitle) nameTitle.textContent = t('fido2_name_first_title') || '命名第一个安全密钥';
            if (input) input.value = `${defaultKeyLabel} 1`;
        } else {
            if (nameTitle) nameTitle.textContent = t('fido2_name_second_title') || '命名第二个安全密钥';
            if (input) input.value = `${defaultKeyLabel} 2`;
        }
    } else {
        if (nameTitle) nameTitle.textContent = t('fido2_name_title') || '命名安全密钥';
        if (input) input.value = defaultKeyLabel;
    }

    if (input) {
        setTimeout(() => {
            input.focus();
            input.select();
        }, 120);
    }
}

/**
 * Submits the named security key to the backend for cryptographic verification and persistence.
 */
async function submitFido2NamingStep() {
    if (!wizardState.pendingAttResp) return;

    const input = document.getElementById('fido2KeyNameInput');
    const nextBtn = document.getElementById('fido2NameNextBtn');
    const navNextBtn = document.getElementById('sheetNavNextBtn');
    const nameMsg = document.getElementById('fido2NameMsg');

    const defaultLabel = t('default_fido2_key_name') || '安全密钥';
    const keyName = (input?.value || '').trim() || defaultLabel;

    wizardState.pendingAttResp.name = keyName;
    wizardState.pendingAttResp._keyName = keyName;
    wizardState.pendingAttResp._fido2KeyName = keyName;

    if (nextBtn) nextBtn.disabled = true;
    if (navNextBtn) navNextBtn.disabled = true;
    if (nameMsg) {
        nameMsg.textContent = t('status_updating') || '正在验证并保存...';
        nameMsg.className = 'msg msg-info';
    }

    const verifyKey = async (pwd) => {
        wizardState.pendingAttResp.currentPassword = pwd;
        return await fetchApi('/api/fido2/register-verify', {
            method: 'POST',
            body: JSON.stringify(wizardState.pendingAttResp)
        });
    };

    const res = await verifyKey('');

    if (res.data?.requireElevation) {
        if (nextBtn) nextBtn.disabled = false;
        if (navNextBtn) navNextBtn.disabled = false;
        enterSudoStep('sudoModal', async (pwd) => {
            const sudoRes = await verifyKey(pwd);
            if (sudoRes.ok && sudoRes.data?.verified) {
                await handleKeyVerifiedSuccess();
                return { success: true };
            }
            return { success: false, message: sudoRes.data?.message || t('fido2_verify_failed') || '验证失败' };
        });
        return;
    }

    if (res.ok && res.data?.verified) {
        await handleKeyVerifiedSuccess();
    } else {
        if (nextBtn) nextBtn.disabled = false;
        if (navNextBtn) navNextBtn.disabled = false;
        if (nameMsg) {
            nameMsg.textContent = res.data?.error || res.data?.message || t('fido2_verify_failed') || '验证失败';
            nameMsg.className = 'msg msg-err';
        }
    }
}

/**
 * Handles post-verification logic: either advances to Key 2 or shows success screen.
 */
async function handleKeyVerifiedSuccess() {
    const navNextBtn = document.getElementById('sheetNavNextBtn');
    if (navNextBtn) navNextBtn.style.display = 'none';

    if (wizardState.mode === 'two-keys' && wizardState.keyIndex === 1) {
        /* Advance to the second key of initial setup */
        wizardState.keyIndex = 2;
        wizardState.pendingAttResp = null;
        switchAppleSheetStep('stepFido2Prompt');
        await startFido2WebAuthnPrompt();
    } else {
        /* Finished second key or single key addition */
        if (wizardState.mode === 'two-keys' && currentTwoFaMethod !== 'fido2') {
            await fetchApi('/api/2fa/enable', {
                method: 'POST',
                body: JSON.stringify({ method: 'fido2' })
            });
        }

        switchAppleSheetStep('stepFido2Success');
    }
}

/* ============================================================================
 * Event Listener Initializer
 * ============================================================================ */

/**
 * Binds all interactive events for FIDO2 and Two-Factor subpages.
 * @param {Function} onSuccessReload Status refresh callback
 * @param {Function} openTotpSetupFn Handler to trigger TOTP inline setup
 */
export function setupFido2Events(onSuccessReload, openTotpSetupFn) {
    reloadAccountCallback = onSuccessReload;

    /* 1. Delegate clicks on security key rows to open Detail Subpage */
    const list = document.getElementById('fido2KeyList');
    if (list) {
        list.addEventListener('click', (e) => {
            const row = e.target.closest('.fido2-key-item');
            if (!row) return;

            const keyId = row.getAttribute('data-key-id');
            const key = cachedFido2Keys.find(k => String(k.id) === String(keyId));
            if (!key) return;

            activeFido2Key = key;

            /* Populate Detail subpage fields (IMG_0627.PNG) */
            const nameEl = document.getElementById('fido2DetailNameText');
            const dateEl = document.getElementById('fido2DetailDateText');
            if (nameEl) nameEl.textContent = key.name || t('default_fido2_key_name') || '安全密钥';
            if (dateEl) dateEl.textContent = appleFormatDate(key.created_at);

            if (window.AquaKit && typeof window.AquaKit.pushSubpage === 'function') {
                window.AquaKit.pushSubpage('subpage-fido2-detail', {
                    title: t('fido2_detail_title') || '安全密钥',
                    parentTitle: t('row_two_factor') || '双重认证'
                });
            }
        });
    }

    /* 2. Detail Subpage: Rename Security Key */
    document.getElementById('fido2DetailNameRow')?.addEventListener('click', async () => {
        if (!activeFido2Key) return;
        const currentName = activeFido2Key.name || t('default_fido2_key_name') || '安全密钥';
        const newName = prompt(t('prompt_rename_fido2') || t('prompt_rename_pk') || '请输入新的名称：', currentName);
        if (!newName || !newName.trim() || newName.trim() === currentName) return;

        const trimmed = newName.trim();
        const { ok, data } = await fetchApi(`/api/fido2/keys/${activeFido2Key.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: trimmed })
        });

        if (ok && data?.success) {
            activeFido2Key.name = trimmed;
            const nameEl = document.getElementById('fido2DetailNameText');
            if (nameEl) nameEl.textContent = trimmed;
            if (reloadAccountCallback) await reloadAccountCallback();
        } else {
            alert(data?.message || t('msg_change_failed') || '修改失败，请重试');
        }
    });

    /* 3. Detail Subpage: Remove Single Security Key */
    document.getElementById('fido2DetailDeleteBtn')?.addEventListener('click', () => {
        if (!activeFido2Key) return;

        if (currentTwoFaMethod === 'fido2' && cachedFido2Keys.length <= 2) {
            showAppleAlert({
                title: t('fido2_detail_title') || '安全密钥',
                desc: t('fido2_min_warning') || '至少需要 2 把安全密钥才能维持双重认证。如需停用，请移除所有安全密钥。',
                confirmText: t('btn_done') || '好',
                cancelText: t('btn_cancel') || '取消'
            });
            return;
        }

        showAppleAlert({
            title: t('alert_delete_fido2_key') || '确定要删除此安全密钥吗？',
            desc: t('fido2_detail_desc') || '移除后你将无法再使用此安全密钥进行验证。',
            confirmText: t('btn_remove') || '移除',
            cancelText: t('btn_cancel') || '取消',
            onConfirm: async () => {
                const { ok, data } = await fetchApi(`/api/fido2/keys/${activeFido2Key.id}`, { method: 'DELETE' });
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
    });

    /* 4. Two-Factor Subpage: Remove All Keys Standalone Button */
    document.getElementById('removeAllFido2Btn')?.addEventListener('click', () => {
        showAppleAlert({
            title: t('alert_remove_all_title') || '是否移除所有安全密钥？',
            desc: t('alert_remove_all_desc') || '你无法再使用安全密钥登录，而将使用其他验证方式进行双重认证。',
            confirmText: t('btn_remove') || '移除',
            cancelText: t('btn_cancel') || '取消',
            onConfirm: async () => {
                if (currentTwoFaMethod === 'fido2') {
                    const actionFn = async (pwd) => {
                        const { ok, data } = await fetchApi('/api/totp/disable', {
                            method: 'POST',
                            body: JSON.stringify({ currentPassword: pwd })
                        });
                        if (!ok || !data?.success) {
                            return { success: false, message: data?.message || '停用双重认证失败' };
                        }
                        for (const k of cachedFido2Keys) {
                            await fetchApi(`/api/fido2/keys/${k.id}`, { method: 'DELETE' });
                        }
                        if (reloadAccountCallback) await reloadAccountCallback();
                        return { success: true };
                    };

                    if (window.isElevated) {
                        const res = await actionFn('');
                        if (res.success) return;
                    }
                    enterSudoStep('sudoModal', actionFn);
                    return;
                }

                for (const k of cachedFido2Keys) {
                    await fetchApi(`/api/fido2/keys/${k.id}`, { method: 'DELETE' });
                }
                if (reloadAccountCallback) await reloadAccountCallback();
            }
        });
    });

    /* 5. Two-Factor Subpage: Open Add Security Key Sheet */
    document.getElementById('openAddFido2SheetBtn')?.addEventListener('click', () => {
        if (cachedFido2Keys.length < 2) {
            wizardState.mode = 'two-keys';
            wizardState.keyIndex = 1;
            wizardState.pendingAttResp = null;
            openAppleSheet('stepFido2Intro');
        } else {
            wizardState.mode = 'single-key';
            wizardState.keyIndex = 1;
            wizardState.pendingAttResp = null;
            openAppleSheet('stepFido2Prompt');
            startFido2WebAuthnPrompt();
        }
    });

    /* 6. Wizard Step 1: Intro Continue & Cancel */
    document.getElementById('fido2IntroContinueBtn')?.addEventListener('click', () => {
        switchAppleSheetStep('stepFido2Prompt');
        startFido2WebAuthnPrompt();
    });

    document.getElementById('fido2IntroCancelBtn')?.addEventListener('click', closeAppleSheet);

    /* 7. Wizard Step 2: Prompt Retry */
    document.getElementById('fido2PromptRetryBtn')?.addEventListener('click', startFido2WebAuthnPrompt);

    /* 8. Wizard Step 3: Naming Next Button & Input Enter */
    document.getElementById('fido2NameNextBtn')?.addEventListener('click', submitFido2NamingStep);
    document.getElementById('sheetNavNextBtn')?.addEventListener('click', submitFido2NamingStep);
    document.getElementById('fido2KeyNameInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitFido2NamingStep();
        }
    });

    /* 9. Wizard Step 4: Success Done */
    document.getElementById('fido2SuccessDoneBtn')?.addEventListener('click', async () => {
        closeAppleSheet();
        if (reloadAccountCallback) await reloadAccountCallback();
    });

    /* 10. Sheet Global Closers (X button & Cancel button) */
    document.getElementById('sheetCloseBtn')?.addEventListener('click', closeAppleSheet);
    document.getElementById('sheetNavCancelBtn')?.addEventListener('click', closeAppleSheet);

    /* 11. TOTP Setup Action inside Two-Factor subpage */
    document.getElementById('setupTotpInTwoFaBtn')?.addEventListener('click', () => {
        if (typeof openTotpSetupFn === 'function') {
            openTotpSetupFn();
        }
    });
}
