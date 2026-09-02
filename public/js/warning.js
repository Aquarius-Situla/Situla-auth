/**
 * public/js/warning.js
 * Untrusted redirect warning page controller.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // Ensure viewport starts at the top
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
    window.scrollTo(0, 0);

    const urlParams = new URLSearchParams(window.location.search);
    const rawRd = urlParams.get('rd');

    const envSnippetText = document.getElementById('envSnippetText');
    const targetUrlDisplay = document.getElementById('targetUrlDisplay');
    const copySnippetBtn = document.getElementById('copySnippetBtn');
    const copySnippetBtnText = document.getElementById('copySnippetBtnText');
    const copyUrlCardBtn = document.getElementById('copyUrlCardBtn');
    const copyUrlCardBtnText = document.getElementById('copyUrlCardBtnText');
    const copyMainActionBtn = document.getElementById('copyMainActionBtn');
    const copyMainActionBtnText = document.getElementById('copyMainActionBtnText');

    let cleanTargetUrl = '';
    let targetHostname = '';

    if (rawRd && typeof rawRd === 'string') {
        cleanTargetUrl = rawRd.trim();
        try {
            const parsed = new URL(cleanTargetUrl, window.location.origin);
            targetHostname = parsed.hostname.toLowerCase();
        } catch {
            targetHostname = cleanTargetUrl.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
        }
    }

    // Derive suggested root domain for .env (strip leading www. if present for cleaner rule)
    function deriveSuggestedRule(hostname) {
        if (!hostname) return 'example.com,*.example.com';
        const clean = hostname.replace(/^www\./i, '');
        if (clean === 'localhost' || !clean.includes('.')) {
            return clean;
        }
        return `${clean},*.${clean}`;
    }

    // Populate Target URL Box & Env Snippet
    if (cleanTargetUrl) {
        if (targetUrlDisplay) targetUrlDisplay.textContent = cleanTargetUrl;
        if (envSnippetText && targetHostname) {
            const rule = deriveSuggestedRule(targetHostname);
            envSnippetText.textContent = `TRUSTED_DOMAINS=${rule}`;
        }
    } else {
        const noUrlMsg = typeof t === 'function' ? t('warning_no_url') : '未指定重定向目标网址';
        if (targetUrlDisplay) targetUrlDisplay.textContent = noUrlMsg;
        if (envSnippetText) envSnippetText.textContent = 'TRUSTED_DOMAINS=example.com,*.example.com';
        if (copyUrlCardBtn) copyUrlCardBtn.disabled = true;
        if (copyMainActionBtn) copyMainActionBtn.disabled = true;
    }

    // Copy helper with visual feedback
    function copyToClipboard(text, btnElement, textElement) {
        if (!text) return;
        const copiedText = typeof t === 'function' ? t('btn_copied') : '已复制';
        const originalText = textElement ? textElement.textContent : '';

        function feedback() {
            if (btnElement) btnElement.classList.add('copied');
            if (textElement) textElement.textContent = copiedText;
            setTimeout(() => {
                if (btnElement) btnElement.classList.remove('copied');
                if (textElement) textElement.textContent = originalText;
            }, 2000);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(feedback).catch(() => {
                fallbackCopy(text, feedback);
            });
        } else {
            fallbackCopy(text, feedback);
        }
    }

    function fallbackCopy(text, cb) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            document.execCommand('copy');
            if (cb) cb();
        } catch {}
        document.body.removeChild(ta);
    }

    // Event listeners
    if (copySnippetBtn) {
        copySnippetBtn.addEventListener('click', () => {
            const snippet = envSnippetText ? envSnippetText.textContent : '';
            copyToClipboard(snippet, copySnippetBtn, copySnippetBtnText);
        });
    }

    if (copyUrlCardBtn) {
        copyUrlCardBtn.addEventListener('click', () => {
            copyToClipboard(cleanTargetUrl, copyUrlCardBtn, copyUrlCardBtnText);
        });
    }

    if (copyMainActionBtn) {
        copyMainActionBtn.addEventListener('click', () => {
            copyToClipboard(cleanTargetUrl, copyMainActionBtn, copyMainActionBtnText);
        });
    }
});
