/**
 * public/js/modules/ui.js
 * UI helpers, loaders, modal controllers, formatters, and clipboard utilities.
 */

export function t(key, ...args) {
    if (typeof window.t === 'function') {
        return window.t(key, ...args);
    }
    return key;
}

export function escapeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function renderTransportBadges(transports = []) {
    if (!Array.isArray(transports) || transports.length === 0) return '';
    return transports.map(tr => {
        if (tr === 'usb') {
            return `<span class="transport-badge" title="${t('transport_usb') || 'USB'}" aria-label="USB"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="19" r="2"/><line x1="12" y1="17" x2="12" y2="4"/><polyline points="9 7 12 4 15 7"/><circle cx="6" cy="9" r="1.5"/><path d="M6 10.5v2.5a2 2 0 0 0 2 2h4"/><rect x="16.5" y="7.5" width="3" height="3"/><path d="M18 10.5v1.5a2 2 0 0 1-2 2h-4"/></svg></span>`;
        }
        if (tr === 'nfc') {
            return `<span class="transport-badge" title="${t('transport_nfc') || 'NFC'}" aria-label="NFC"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.5a8 8 0 0 1 0 7"/><path d="M10 6a12 12 0 0 1 0 12"/><path d="M14 3.5a16 16 0 0 1 0 17"/><path d="M18 1a20 20 0 0 1 0 22"/></svg></span>`;
        }
        if (tr === 'ble') {
            return `<span class="transport-badge" title="${t('transport_ble') || 'Bluetooth'}" aria-label="Bluetooth"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg></span>`;
        }
        if (tr === 'internal') {
            return `<span class="transport-badge" title="${t('transport_internal') || '内置生物识别'}" aria-label="内置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg></span>`;
        }
        return '';
    }).join('');
}

export function renderInlineLoader(textKey = 'status_updating') {
    const text = t(textKey) || '正在更新...';
    return `<div class="apple-inline-updating"><div class="apple-spinner apple-spinner-sm"><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div></div><span>${text}</span></div>`;
}

export function setModalActionsLoading(actionsContainer, isLoading, textKey = 'status_updating') {
    if (!actionsContainer) return;
    let loader = actionsContainer.querySelector('.apple-inline-updating');
    const buttons = actionsContainer.querySelectorAll('button');

    if (isLoading) {
        buttons.forEach(b => {
            b.style.display = 'none';
        });
        if (!loader) {
            loader = document.createElement('div');
            actionsContainer.appendChild(loader);
        }
        const text = t(textKey) || '正在更新...';
        loader.className = 'apple-inline-updating';
        loader.innerHTML = `<div class="apple-spinner apple-spinner-sm"><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div><div class="apple-spinner-blade"></div></div><span>${text}</span>`;
        loader.style.display = 'flex';
    } else {
        if (loader) {
            loader.style.display = 'none';
        }
        buttons.forEach(b => {
            b.style.display = '';
        });
    }
}

export function closeAllModals() {
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.style.display = 'none';
        const step1 = m.querySelector('[id$="Step1"]');
        const step2 = m.querySelector('[id$="Step2"]');
        const step3 = m.querySelector('[id$="Step3"]');
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        if (step3) step3.style.display = 'none';
    });
    document.querySelectorAll('input[type="password"]').forEach(inp => {
        inp.value = '';
    });
}

export function openModal(modalId, { step = 1, resetInputs = true } = {}) {
    closeAllModals();
    const modal = document.getElementById(modalId);
    if (!modal) return null;

    modal.style.display = 'flex';

    // Reset step views
    const step1 = modal.querySelector('[id$="Step1"]');
    const step2 = modal.querySelector('[id$="Step2"]');
    const step3 = modal.querySelector('[id$="Step3"]');
    if (step1) step1.style.display = step === 1 ? 'block' : 'none';
    if (step2) step2.style.display = step === 2 ? 'block' : 'none';
    if (step3) step3.style.display = step === 3 ? 'block' : 'none';

    // Clear alert and error messages
    modal.querySelectorAll('.msg').forEach(m => {
        m.textContent = '';
        m.className = 'msg';
    });

    // Reset inputs cleanly without triggering premature focus or blue halos
    if (resetInputs) {
        modal.querySelectorAll('input:not([type="hidden"]):not(.sudo-hidden-username), textarea').forEach(inp => {
            if (inp.id !== 'npmProtectedDomain') {
                inp.value = '';
            }
        });
    }

    // Ensure no lingering focus outline on trigger buttons or inputs
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    return modal;
}

export function copyToClipboard(text, triggerBtn, successText = '已复制') {
    navigator.clipboard.writeText(text).then(() => {
        if (triggerBtn) {
            const originalText = triggerBtn.textContent;
            triggerBtn.textContent = successText;
            setTimeout(() => triggerBtn.textContent = originalText, 2000);
        }
    });
}

export function formatError(err, fallbackKey = 'msg_operation_failed') {
    if (!err) return t(fallbackKey) || '操作失败';
    
    // Log full diagnostic technical error to F12 Console for developers
    console.error('[Situla-Auth Diagnostic Error]:', err);

    const name = err.name || '';
    const msg = String(err.message || err || '');

    if (name === 'NotAllowedError' || msg.includes('not allowed') || msg.includes('canceled') || msg.includes('cancelled') || msg.includes('aborted')) {
        return t('msg_operation_canceled') || '操作已取消';
    }
    if (name === 'InvalidStateError' || msg.includes('already registered') || msg.includes('InvalidStateError')) {
        return t('msg_key_already_registered') || '该密钥已注册';
    }
    if (name === 'NotSupportedError' || msg.includes('not supported') || msg.includes('NotSupportedError')) {
        return t('msg_not_supported') || '当前设备或浏览器不支持此功能';
    }
    if (name === 'TimeoutError' || msg.includes('timed out') || msg.includes('timeout')) {
        return t('msg_operation_timeout') || '操作超时，请重试';
    }
    if (msg.includes('NetworkError') || msg.includes('Failed to fetch') || msg.includes('network') || msg.includes('Network error')) {
        return t('msg_network_error') || '网络错误，请重试';
    }

    const translated = t(msg);
    if (translated && translated !== msg) {
        return translated;
    }

    if (!msg.includes('http') && !msg.includes('dom-pkcreator') && msg.length <= 40) {
        return msg;
    }

    return t(fallbackKey) || '操作失败，请重试';
}

/* ============================================================================
 * Apple HIG Formatters & Modal Helpers
 * ============================================================================ */

/**
 * Formats an ISO date string into Apple HIG format (e.g. 2026 年 09 月 12 日).
 * @param {string} iso
 * @returns {string}
 */
export function appleFormatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const currentLang = window.currentLang || 'zh-CN';
    if (currentLang === 'zh-CN') {
        return `${year} 年 ${month} 月 ${day} 日`;
    }
    return `${year}/${month}/${day}`;
}

/**
 * Opens the Apple Form Sheet modal at a specified step.
 * @param {string} stepId
 */
export function openAppleSheet(stepId) {
    closeAllModals();
    const sheetOverlay = document.getElementById('appleSheetModal');
    if (!sheetOverlay) return;

    sheetOverlay.style.display = 'flex';
    switchAppleSheetStep(stepId);
}

/**
 * Switches the active step inside the Apple Form Sheet.
 * @param {string} stepId
 */
export function switchAppleSheetStep(stepId) {
    const sheetOverlay = document.getElementById('appleSheetModal');
    if (!sheetOverlay) return;

    sheetOverlay.querySelectorAll('.sheet-step').forEach(step => {
        if (step.id === stepId) {
            step.style.display = 'block';
        } else {
            step.style.display = 'none';
        }
    });

    /* Clear any messages inside the sheet */
    sheetOverlay.querySelectorAll('.msg').forEach(m => {
        m.textContent = '';
        m.className = 'msg';
    });
}

/**
 * Closes the Apple Form Sheet modal.
 */
export function closeAppleSheet() {
    const sheetOverlay = document.getElementById('appleSheetModal');
    if (sheetOverlay) {
        sheetOverlay.style.display = 'none';
    }
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
}

/**
 * Displays a native Apple HIG centered alert dialog (IMG_0611.PNG).
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.desc
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @param {Function} [options.onConfirm]
 * @param {Function} [options.onCancel]
 */
export function showAppleAlert({ title, desc, confirmText, cancelText, onConfirm, onCancel }) {
    const overlay = document.getElementById('appleAlertModal');
    if (!overlay) return;

    const titleEl = document.getElementById('appleAlertTitle');
    const descEl = document.getElementById('appleAlertDesc');
    const cancelBtn = document.getElementById('appleAlertCancelBtn');
    const confirmBtn = document.getElementById('appleAlertConfirmBtn');

    if (titleEl) titleEl.textContent = title || '';
    if (descEl) descEl.textContent = desc || '';
    if (cancelBtn) cancelBtn.textContent = cancelText || t('btn_cancel') || '取消';
    if (confirmBtn) confirmBtn.textContent = confirmText || t('btn_remove') || '移除';

    overlay.style.display = 'flex';

    const handleCancel = () => {
        overlay.style.display = 'none';
        cleanup();
        if (typeof onCancel === 'function') onCancel();
    };

    const handleConfirm = () => {
        overlay.style.display = 'none';
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    };

    const cleanup = () => {
        cancelBtn?.removeEventListener('click', handleCancel);
        confirmBtn?.removeEventListener('click', handleConfirm);
    };

    cancelBtn?.addEventListener('click', handleCancel, { once: true });
    confirmBtn?.addEventListener('click', handleConfirm, { once: true });
}
