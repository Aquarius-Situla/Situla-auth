/**
 * public/js/modules/ui.js
 * UI helpers, loaders, modal controllers, and clipboard utilities.
 */

export function renderInlineLoader(textKey = 'status_updating') {
    const text = (window.t && window.t(textKey)) || '正在更新...';
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
        actionsContainer.querySelectorAll('.modal-btn-secondary').forEach(b => b.addEventListener('click', closeAllModals));
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

export function copyToClipboard(text, triggerBtn) {
    navigator.clipboard.writeText(text).then(() => {
        if (triggerBtn) {
            const originalText = triggerBtn.textContent;
            triggerBtn.textContent = (window.t && window.t('status_copied')) || '已复制';
            setTimeout(() => triggerBtn.textContent = originalText, 2000);
        }
    });
}

export function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
