/* ============================================================================
 * Situla Auth 2.0 — Recovery Key Module (recovery.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import { t, copyToClipboard, closeAllModals, openAppleSheet, closeAppleSheet, showAppleAlert } from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

let currentHas2FA = false;
let currentRemaining = 0;
let lastGeneratedCodes = [];

/**
 * Updates the Recovery Key status badges and action texts in the security subpage
 * and the dedicated recovery key subpage.
 * @param {boolean} has2FA - Whether two-factor authentication is active on the account.
 * @param {number} remaining - Number of unused recovery key pairs remaining.
 */
export function updateRecoveryUI(has2FA, remaining = 0) {
    currentHas2FA = !!has2FA;
    currentRemaining = Number(remaining) || 0;

    const recoveryGroup = document.getElementById('recoveryKeyGroup');
    const recoveryKeyBadge = document.getElementById('recoveryKeyBadge');
    const recoveryDetailBadge = document.getElementById('recoveryDetailBadge');
    const genRecoveryActionText = document.getElementById('genRecoveryActionText');
    const legacyRcCard = document.getElementById('rcCard');
    const legacyRcBadge = document.getElementById('rcBadge');

    /* If account does not have 2FA, hide recovery section */
    if (recoveryGroup) {
        recoveryGroup.style.display = currentHas2FA ? '' : 'none';
    }
    if (legacyRcCard) {
        legacyRcCard.style.display = currentHas2FA ? '' : 'none';
    }

    if (!currentHas2FA) return;

    let badgeText = '';
    let badgeClass = '';

    if (currentRemaining === 0) {
        badgeText = t('badge_not_gen') || '未生成';
        badgeClass = 'badge badge-disabled';
        if (genRecoveryActionText) {
            genRecoveryActionText.textContent = t('btn_gen_rc') || '设置恢复密钥';
            genRecoveryActionText.setAttribute('data-i18n', 'btn_gen_rc');
        }
        if (recoveryKeyBadge) {
            recoveryKeyBadge.setAttribute('data-i18n', 'badge_not_gen');
        }
        if (recoveryDetailBadge) {
            recoveryDetailBadge.setAttribute('data-i18n', 'badge_not_gen');
        }
    } else {
        badgeText = t('badge_rc_remaining', currentRemaining) || `剩余 ${currentRemaining} 组`;
        badgeClass = currentRemaining <= 2 ? 'badge badge-warn' : 'badge badge-count';
        if (genRecoveryActionText) {
            genRecoveryActionText.textContent = t('btn_regen_rc') || '重新生成恢复密钥';
            genRecoveryActionText.setAttribute('data-i18n', 'btn_regen_rc');
        }
        /* Crucial: remove static data-i18n so applyTranslations does not overwrite dynamic count */
        if (recoveryKeyBadge) {
            recoveryKeyBadge.removeAttribute('data-i18n');
        }
        if (recoveryDetailBadge) {
            recoveryDetailBadge.removeAttribute('data-i18n');
        }
    }

    if (recoveryKeyBadge) {
        recoveryKeyBadge.textContent = badgeText;
        recoveryKeyBadge.className = badgeClass;
    }
    if (recoveryDetailBadge) {
        recoveryDetailBadge.textContent = badgeText;
        recoveryDetailBadge.className = badgeClass;
    }
    if (legacyRcBadge) {
        legacyRcBadge.textContent = badgeText;
        legacyRcBadge.className = badgeClass;
    }
}

/* Synchronize dynamic recovery status whenever language pack changes */
window.addEventListener('i18n:localeChanged', () => {
    updateRecoveryUI(currentHas2FA, currentRemaining);
});
window.addEventListener('situla:languagechange', () => {
    updateRecoveryUI(currentHas2FA, currentRemaining);
});

/* Backward-compatible alias for existing callers */
export const updateRcCard = updateRecoveryUI;

/**
 * Renders an array of recovery code strings into an element as monospace chips.
 * @param {string} containerId - DOM ID of the container element.
 * @param {string[]} codes - Array of recovery key codes.
 */
function renderCodesGrid(containerId, codes) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    (codes || []).forEach(code => {
        const chip = document.createElement('div');
        chip.className = 'apple-code-chip';
        chip.textContent = code;
        container.appendChild(chip);
    });
}

/**
 * Attaches event listeners for recovery key generation, copy, and sheet modal interactions.
 * @param {Function} [onSuccessReload] - Callback triggered when keys are successfully generated.
 */
export function setupRecoveryEvents(onSuccessReload) {
    const triggerGenerateFlow = () => {
        const executeGeneration = () => {
            const actionFn = async (pwd) => {
                const { ok, data } = await fetchApi('/api/recovery-codes/generate', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword: pwd })
                });

                if (ok && data && data.success) {
                    const codes = data.codes || [];
                    lastGeneratedCodes = codes;
                    currentRemaining = codes.length;

                    /* Update UI state and badges across all subpages */
                    updateRecoveryUI(true, codes.length);

                    /* Populate the subpage inline preview grid */
                    const rcPanel = document.getElementById('recoveryCodesPanel');
                    if (rcPanel) {
                        rcPanel.style.display = 'block';
                    }
                    renderCodesGrid('recoveryCodesGrid', codes);

                    /* Populate and open the Apple HIG Form Sheet modal */
                    renderCodesGrid('sheetRecoveryGrid', codes);
                    openAppleSheet('stepRecoveryCodesDisplay');

                    if (typeof onSuccessReload === 'function') {
                        onSuccessReload();
                    }
                    return { success: true };
                }

                return {
                    success: false,
                    message: data?.message || t('msg_operation_failed') || '生成失败'
                };
            };

            enterSudoStep('sudoModal', actionFn);
        };

        /* If recovery keys are already generated, prompt warning alert first */
        if (currentRemaining > 0) {
            showAppleAlert({
                title: t('alert_regen_rc_title') || '重新生成恢复密钥？',
                desc: t('alert_regen_rc_msg') || '重新生成后，现有的恢复密钥将立即失效并无法再次使用。',
                confirmText: t('btn_regen') || '重新生成',
                cancelText: t('btn_cancel') || '取消',
                onConfirm: executeGeneration
            });
        } else {
            executeGeneration();
        }
    };

    /* Bind trigger buttons for generation (Modern Subpage row and legacy button) */
    document.getElementById('openGenRecoverySheetBtn')?.addEventListener('click', triggerGenerateFlow);
    document.getElementById('genRcBtn')?.addEventListener('click', triggerGenerateFlow);

    /* Cancel button in Sudo password modal */
    document.getElementById('cancelSudoBtn')?.addEventListener('click', closeAllModals);

    /* Subpage inline copy button */
    document.getElementById('copyRecoveryCodesBtn')?.addEventListener('click', () => {
        if (!lastGeneratedCodes.length) return;
        const textToCopy = lastGeneratedCodes.join('\n');
        const btnText = document.getElementById('copyRecoveryCodesBtnText');
        copyToClipboard(textToCopy, btnText, t('rc_copied_toast') || '已复制全部恢复密钥');
    });

    /* Legacy copy button fallback */
    document.getElementById('copyRcBtn')?.addEventListener('click', () => {
        const listText = document.getElementById('rcList')?.innerText?.replace(/\n/g, ' ') || lastGeneratedCodes.join(' ');
        const btn = document.getElementById('copyRcBtn');
        if (listText && btn) {
            copyToClipboard(listText, btn, t('btn_copied') || '已复制');
        }
    });

    /* Apple Sheet modal copy capsule button */
    document.getElementById('sheetCopyRecoveryCodesBtn')?.addEventListener('click', () => {
        if (!lastGeneratedCodes.length) return;
        const textToCopy = lastGeneratedCodes.join('\n');
        const btn = document.getElementById('sheetCopyRecoveryCodesBtn');
        copyToClipboard(textToCopy, btn, t('rc_copied_toast') || '已复制全部恢复密钥');
    });

    /* Apple Sheet modal Done button */
    document.getElementById('sheetRecoveryDoneBtn')?.addEventListener('click', () => {
        closeAppleSheet();
    });
}

