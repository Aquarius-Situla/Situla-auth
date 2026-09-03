/**
 * public/js/modules/fido2.js
 * FIDO2 Hardware Key Management and 2FA Multi-State UI Coordinator.
 */

import { t, escapeHTML, fmtDate, renderInlineLoader, closeAllModals, openModal, renderTransportBadges, formatError } from './ui.js';
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
        const badges = renderTransportBadges(k.transports || []);

        return `
        <div class="passkey-item" id="fido2-${k.id}">
            <div class="passkey-icon">
                <svg viewBox="0 0 2340 2340" width="22" height="22" preserveAspectRatio="xMidYMid meet">
                    <g transform="translate(0,2340) scale(0.1,-0.1)" fill="currentColor" stroke="none">
                        <path d="M4983 21898 c-11 -24 -50 -82 -86 -130 -171 -229 -176 -271 -177 -1433 0 -908 3 -947 76 -1034 70 -84 163 -95 469 -57 458 57 1031 76 1709 57 460 -12 522 -17 856 -58 357 -43 447 -12 495 172 18 72 23 1805 5 1955 -20 167 -59 262 -164 405 -37 50 -74 107 -84 127 -29 63 -3068 59 -3099 -4z m2617 -425 c227 -78 312 -245 297 -592 -12 -285 -94 -413 -310 -479 -75 -23 -1922 -31 -2051 -9 -261 45 -366 200 -366 537 0 343 98 499 350 555 125 27 1996 16 2080 -12z"/>
                        <path d="M5913 18410 c-1834 -103 -2481 -529 -2640 -1740 -21 -162 -34 -9161 -14 -9680 50 -1262 590 -1791 2009 -1965 612 -75 1665 -89 2262 -30 1576 156 2120 578 2271 1765 17 128 26 9310 10 9650 -41 875 -312 1364 -916 1660 -365 178 -772 263 -1585 331 -168 14 -1191 20 -1397 9z m897 -4844 c1310 -176 2034 -1676 1370 -2837 -745 -1302 -2711 -1219 -3359 141 -645 1357 490 2897 1989 2696z"/>
                        <path d="M6327 13204 c-1487 -231 -1815 -2232 -473 -2884 1146 -557 2415 400 2182 1645 -152 815 -908 1364 -1709 1239z"/>
                        <path d="M16325 15783 c-1832 -107 -2479 -570 -2565 -1832 -21 -298 -8 -7291 13 -7430 182 -1187 877 -1604 2755 -1651 2703 -69 3549 390 3613 1960 19 478 6 7118 -14 7269 -157 1153 -798 1584 -2496 1681 -160 9 -1167 12 -1306 3z m748 -1398 c427 -90 614 -623 335 -951 -328 -385 -941 -229 -1044 266 -83 397 304 771 709 685z m38 -3015 c1390 -138 2130 -1712 1350 -2871 -772 -1147 -2551 -1034 -3182 203 -655 1285 393 2810 1832 2668z"/>
                        <path d="M16735 11014 c-823 -123 -1380 -843 -1286 -1664 117 -1023 1245 -1600 2191 -1123 949 479 1048 1858 181 2508 -265 200 -762 327 -1086 279z m625 -501 c40 -28 66 -63 103 -138 231 -467 238 -1151 16 -1642 -121 -269 -296 -233 -183 37 217 520 226 984 28 1482 -89 225 -74 338 36 261z m-439 -341 c229 -260 190 -1171 -54 -1298 -94 -50 -113 53 -47 261 96 302 95 515 -4 830 -46 145 -51 178 -36 216 25 59 85 55 141 -9z m-496 -324 c137 -161 99 -631 -54 -671 -69 -18 -97 54 -76 193 18 121 19 214 3 341 -22 177 37 241 127 137z"/>
                        <path d="M4915 4171 c-111 -27 -166 -103 -185 -254 -13 -107 -13 -1628 0 -1803 17 -224 54 -331 167 -482 36 -48 75 -106 86 -129 31 -64 3070 -68 3099 -5 10 20 47 77 84 127 103 140 135 215 159 375 23 146 22 1899 0 1985 -48 185 -133 214 -492 172 -352 -43 -399 -46 -859 -58 -675 -19 -1253 0 -1708 56 -200 25 -295 29 -351 16z"/>
                        <path d="M15380 4091 c-187 -57 -190 -74 -190 -1126 0 -1095 4 -1125 165 -1340 29 -38 63 -91 76 -117 23 -48 23 -48 1520 -48 1497 0 1497 0 1509 31 7 17 48 80 91 141 159 224 154 175 154 1303 0 1034 2 1002 -67 1081 -78 89 -143 96 -503 55 -390 -44 -554 -51 -1180 -51 -653 0 -818 8 -1252 60 -166 21 -279 24 -323 11z"/>
                    </g>
                </svg>
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
            btn.blur();
            if (document.activeElement) document.activeElement.blur();
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');

            if (action === 'rename') {
                const currentEl = document.getElementById(`fido2-name-${id}`);
                const current = currentEl ? currentEl.childNodes[0].nodeValue.trim() : (t('default_fido2_key_name') || '安全密钥');
                const newName = prompt(t('prompt_rename_pk') || '请输入新名称：', current);
                btn.blur();
                if (document.activeElement) document.activeElement.blur();
                if (!newName || newName.trim() === current) return;
                const { ok, data } = await fetchApi(`/api/fido2/keys/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ name: newName.trim() })
                });
                if (ok && data?.success && currentEl) {
                    currentEl.childNodes[0].nodeValue = newName.trim();
                }
            } else if (action === 'delete') {
                const confirmed = confirm(t('alert_delete_fido2_key') || '确定要删除此安全密钥吗？');
                btn.blur();
                if (document.activeElement) document.activeElement.blur();
                if (!confirmed) return;
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
        const modal = openModal('fido2Modal');
        const actions1 = modal?.querySelector('#fido2Step1 .modal-actions');
        if (actions1) setModalActionsLoading(actions1, false);
    });

    document.getElementById('cancelFido2Btn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelFido2Btn2')?.addEventListener('click', closeAllModals);

    function handleFido2Step1Submit(e) {
        if (e) e.preventDefault();
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
                return { success: false, message: formatError(e, 'fido2_verify_failed') };
            }
        };

        enterSudoStep('fido2Modal', actionFn);
    }

    document.getElementById('fido2Step1Form')?.addEventListener('submit', handleFido2Step1Submit);
    document.getElementById('continueFido2Btn')?.addEventListener('click', handleFido2Step1Submit);

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
