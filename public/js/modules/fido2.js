/**
 * public/js/modules/fido2.js
 * FIDO2 Hardware Key Management and 2FA Multi-State UI Coordinator.
 */

import { t, escapeHTML, fmtDate, renderInlineLoader, closeAllModals } from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

export function set2faBadge(method, fido2Count = 0) {
    const badge = document.getElementById('twoFaBadge');
    const desc = document.getElementById('twoFaDesc');

    const twoFaDisabledUI = document.getElementById('twoFaDisabledUI');
    const twoFaMethodSelector = document.getElementById('twoFaMethodSelector');
    const totpEnabledUI = document.getElementById('totpEnabledUI');
    const fido2EnabledUI = document.getElementById('fido2EnabledUI');
    const totpSetup = document.getElementById('totpSetup');

    if (twoFaDisabledUI) twoFaDisabledUI.style.display = 'none';
    if (twoFaMethodSelector) twoFaMethodSelector.style.display = 'none';
    if (totpEnabledUI) totpEnabledUI.style.display = 'none';
    if (fido2EnabledUI) fido2EnabledUI.style.display = 'none';
    if (totpSetup) totpSetup.style.display = 'none';

    if (method === 'totp') {
        if (badge) {
            badge.className = 'badge badge-enabled';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${t('badge_2fa_totp') || 'TOTP 已启用'}`;
        }
        if (desc) desc.textContent = t('section_2fa_desc_totp') || '使用身份验证器 App 生成的动态验证码进行验证。';
        if (totpEnabledUI) totpEnabledUI.style.display = 'flex';

        if (fido2Count > 0) {
            if (fido2EnabledUI) fido2EnabledUI.style.display = 'block';
            const addBtnRow = document.getElementById('fido2AddBtnRow');
            const enableBtn = document.getElementById('enableFido2Btn');
            const disableBtn = document.getElementById('disableFido2Btn');
            if (addBtnRow) addBtnRow.style.display = 'flex';
            if (enableBtn) {
                enableBtn.style.display = fido2Count >= 2 ? 'block' : 'none';
                enableBtn.textContent = t('btn_switch_to_fido2') || '切换为 FIDO2 2FA';
            }
            if (disableBtn) disableBtn.style.display = 'none';
        }
    } else if (method === 'fido2') {
        if (badge) {
            badge.className = 'badge badge-enabled';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${t('badge_2fa_fido2') || 'FIDO2 已启用'}`;
        }
        if (desc) desc.textContent = t('section_2fa_desc_fido2') || '使用物理安全密钥（如 YubiKey）进行两步验证。';
        if (fido2EnabledUI) fido2EnabledUI.style.display = 'block';
        const addBtnRow = document.getElementById('fido2AddBtnRow');
        const enableBtn = document.getElementById('enableFido2Btn');
        const disableBtn = document.getElementById('disableFido2Btn');
        if (addBtnRow) addBtnRow.style.display = fido2Count >= 10 ? 'none' : 'flex';
        if (enableBtn) enableBtn.style.display = 'none';
        if (disableBtn) disableBtn.style.display = 'block';
    } else if (!method && fido2Count > 0) {
        if (badge) {
            badge.className = 'badge badge-error';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${t('badge_downgraded') || '已降级'}`;
        }
        if (desc) desc.textContent = t('section_fido2_downgraded_desc') || '安全密钥不足 2 把，已降级，请补充安全密钥后再启用。';
        if (fido2EnabledUI) fido2EnabledUI.style.display = 'block';
        const addBtnRow = document.getElementById('fido2AddBtnRow');
        const enableBtn = document.getElementById('enableFido2Btn');
        const disableBtn = document.getElementById('disableFido2Btn');
        if (addBtnRow) addBtnRow.style.display = 'flex';
        if (enableBtn) enableBtn.style.display = 'block';
        if (disableBtn) disableBtn.style.display = 'none';
    } else {
        if (badge) {
            badge.className = 'badge badge-disabled';
            badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${t('badge_disabled') || '未启用'}`;
        }
        if (desc) desc.textContent = t('section_2fa_desc') || '添加第二道防护。可选身份验证器（TOTP 动态码）或 FIDO2 安全密钥（YubiKey 等）。';
        if (twoFaDisabledUI) twoFaDisabledUI.style.display = 'flex';
    }
}

export function renderFido2Keys(keys) {
    const list = document.getElementById('fido2KeyList');
    if (!list) return;

    if (!keys || keys.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = keys.map(k => {
        const transports = k.transports || [];
        const badges = transports.map(tr => {
            if (tr === 'usb') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_usb') || 'USB'}</span>`;
            if (tr === 'nfc') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_nfc') || 'NFC'}</span>`;
            if (tr === 'ble') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_ble') || 'BLE'}</span>`;
            if (tr === 'internal') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_internal') || '内置'}</span>`;
            return '';
        }).join('');

        return `
        <div class="passkey-item" id="fido2-${k.id}">
            <div class="passkey-icon">
                <img src="/assets/icons/fido.svg" style="width:22px;height:22px;object-fit:contain;" class="icon-adaptive" alt="FIDO2">
            </div>
            <div class="passkey-info">
                <span class="passkey-name" id="fido2-name-${k.id}">${escapeHTML(k.name || t('default_fido2_key_name') || '安全密钥')}${badges}</span>
                <span class="passkey-date">${fmtDate(k.created_at)}</span>
            </div>
            <div class="passkey-actions">
                <button class="pk-btn pk-rename fido2-rename" data-action="rename" data-id="${k.id}" title="重命名">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="pk-btn pk-delete fido2-delete" data-action="delete" data-id="${k.id}" title="删除">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');
}

export function setupFido2Events(onSuccessReload, openTotpSetupFn) {
    const list = document.getElementById('fido2KeyList');
    if (list) {
        list.addEventListener('click', async (e) => {
            const btn = e.target.closest('.pk-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');

            if (action === 'rename') {
                const currentEl = document.getElementById(`fido2-name-${id}`);
                const current = currentEl ? currentEl.childNodes[0].nodeValue.trim() : (t('default_fido2_key_name') || '安全密钥');
                const newName = prompt(t('prompt_rename_pk') || '请输入新名称：', current);
                if (!newName || newName.trim() === current) return;
                const { ok, data } = await fetchApi(`/api/fido2/keys/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: newName.trim() })
                });
                if (ok && data?.success && currentEl) {
                    currentEl.childNodes[0].nodeValue = newName.trim();
                }
            } else if (action === 'delete') {
                if (!confirm(t('alert_delete_fido2_key') || '确定要删除此安全密钥吗？')) return;
                const { ok, data } = await fetchApi(`/api/fido2/keys/${id}`, { method: 'DELETE' });
                if (ok && data?.success) {
                    document.getElementById(`fido2-${id}`)?.remove();
                    if (data.autoDisabled) {
                        alert(t('fido2_min_warning') || '安全密钥不足 2 把，FIDO2 2FA 已自动降级停用。');
                    }
                    if (onSuccessReload) onSuccessReload();
                } else {
                    alert(data?.message || t('msg_delete_failed') || '删除失败');
                }
            }
        });
    }

    // 2FA Setup trigger
    document.getElementById('setup2faBtn')?.addEventListener('click', () => {
        const twoFaDisabledUI = document.getElementById('twoFaDisabledUI');
        const twoFaMethodSelector = document.getElementById('twoFaMethodSelector');
        if (twoFaDisabledUI) twoFaDisabledUI.style.display = 'none';
        if (twoFaMethodSelector) twoFaMethodSelector.style.display = 'block';
    });

    document.getElementById('cancelMethodSelectorBtn')?.addEventListener('click', async () => {
        if (onSuccessReload) await onSuccessReload();
    });

    document.getElementById('chooseTotpBtn')?.addEventListener('click', () => {
        const twoFaMethodSelector = document.getElementById('twoFaMethodSelector');
        if (twoFaMethodSelector) twoFaMethodSelector.style.display = 'none';
        if (openTotpSetupFn) openTotpSetupFn();
    });

    document.getElementById('chooseFido2Btn')?.addEventListener('click', () => {
        const twoFaMethodSelector = document.getElementById('twoFaMethodSelector');
        const fido2EnabledUI = document.getElementById('fido2EnabledUI');
        const fido2AddBtnRow = document.getElementById('fido2AddBtnRow');
        const enableFido2Btn = document.getElementById('enableFido2Btn');
        const disableFido2Btn = document.getElementById('disableFido2Btn');

        if (twoFaMethodSelector) twoFaMethodSelector.style.display = 'none';
        if (fido2EnabledUI) fido2EnabledUI.style.display = 'block';
        if (fido2AddBtnRow) fido2AddBtnRow.style.display = 'flex';
        if (enableFido2Btn) enableFido2Btn.style.display = 'block';
        if (disableFido2Btn) disableFido2Btn.style.display = 'none';
    });

    // Add FIDO2 modal
    document.getElementById('addFido2KeyBtn')?.addEventListener('click', () => {
        closeAllModals();
        const modal = document.getElementById('fido2Modal');
        if (modal) modal.style.display = 'flex';
        const step1 = document.getElementById('fido2Step1');
        const step2 = document.getElementById('fido2Step2');
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        const nameInp = document.getElementById('fido2DeviceName');
        if (nameInp) nameInp.value = '';
        const msg1 = document.getElementById('fido2Msg1');
        if (msg1) {
            msg1.textContent = '';
            msg1.className = 'msg';
        }
        const actions1 = step1 ? step1.querySelector('.modal-actions') : null;
        if (actions1) setModalActionsLoading(actions1, false);
    });

    document.getElementById('cancelFido2Btn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelFido2Btn2')?.addEventListener('click', closeAllModals);

    document.getElementById('continueFido2Btn')?.addEventListener('click', () => {
        const keyName = document.getElementById('fido2DeviceName')?.value?.trim() || t('default_fido2_key_name') || '安全密钥';
        const msg1 = document.getElementById('fido2Msg1');
        if (msg1) msg1.textContent = '';

        const actionFn = async (pwd) => {
            const { ok: optOk, data: options } = await fetchApi('/api/fido2/register-options');
            if (!optOk) {
                return { success: false, message: options?.error || options?.message || '获取配置失败' };
            }

            try {
                const { startRegistration } = window.SimpleWebAuthnBrowser || {};
                if (!startRegistration) throw new Error('WebAuthn library not loaded');

                const attResp = await startRegistration(options);
                attResp._keyName = keyName;
                attResp._fido2KeyName = keyName;
                attResp.name = keyName;
                attResp.currentPassword = pwd;

                const { ok: verOk, data: verData } = await fetchApi('/api/fido2/register-verify', {
                    method: 'POST',
                    body: JSON.stringify(attResp)
                });

                if (verOk && verData.verified) {
                    if (onSuccessReload) await onSuccessReload();
                    return { success: true };
                } else {
                    if (verData?.requireElevation) {
                        return { requireElevation: true, message: verData.message };
                    }
                    return { success: false, message: verData?.message || verData?.error || t('fido2_verify_failed') || '验证失败' };
                }
            } catch (e) {
                return { success: false, message: (t('fido2_canceled') || '已取消') + ': ' + (e.message || '') };
            }
        };

        enterSudoStep('fido2Modal', actionFn);
    });

    // Enable FIDO2
    document.getElementById('enableFido2Btn')?.addEventListener('click', async () => {
        const msg = document.getElementById('fido2Msg');
        if (msg) msg.textContent = '';

        const actionFn = async (pwd) => {
            const { ok, data } = await fetchApi('/api/2fa/enable', {
                method: 'POST',
                body: JSON.stringify({ method: 'fido2', currentPassword: pwd })
            });

            if (ok && data.success) {
                if (msg) {
                    msg.textContent = t('msg_2fa_enabled') || '双重认证已启用';
                    msg.className = 'msg msg-ok';
                }
                setTimeout(() => {
                    set2faBadge('fido2');
                    if (onSuccessReload) onSuccessReload();
                    if (msg) msg.textContent = '';
                }, 1000);
                return { success: true };
            } else {
                if (msg) {
                    msg.textContent = data.message || '启用失败';
                    msg.className = 'msg msg-err';
                }
                return { success: false, message: data.message };
            }
        };

        enterSudoStep('sudoModal', actionFn);
    });
}
