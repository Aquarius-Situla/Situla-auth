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

export function renderInlineLoader(textKey = 'status_updating') {
    const text = t(textKey) || '正在更新...';
    return `<div class="apple-inline-updating"><div class="apple-spinner-sm"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div><span>${text}</span></div>`;
}

export function setModalActionsLoading(actionsContainer, isLoading, textKey = 'status_updating') {
    if (!actionsContainer) return;
    if (isLoading) {
        actionsContainer.dataset.originalHtml = actionsContainer.innerHTML;
        actionsContainer.innerHTML = renderInlineLoader(textKey);
    } else if (actionsContainer.dataset.originalHtml) {
        actionsContainer.innerHTML = actionsContainer.dataset.originalHtml;
        delete actionsContainer.dataset.originalHtml;
        actionsContainer.querySelectorAll('.modal-btn-secondary, [id^="cancel"]').forEach(b => {
            b.addEventListener('click', closeAllModals);
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

export function copyToClipboard(text, triggerBtn, successText = '已复制') {
    navigator.clipboard.writeText(text).then(() => {
        if (triggerBtn) {
            const originalText = triggerBtn.textContent;
            triggerBtn.textContent = successText;
            setTimeout(() => triggerBtn.textContent = originalText, 2000);
        }
    });
}
