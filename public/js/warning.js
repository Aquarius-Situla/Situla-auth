/**
 * public/js/warning.js
 * Untrusted redirect warning page controller.
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
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
    const navDashboardBtn = document.getElementById('navDashboardBtn');

    let cleanTargetUrl = '';
    let targetHostname = '';

    if (rawRd && typeof rawRd === 'string') {
        cleanTargetUrl = rawRd.trim();
        try {
            const parsed = new URL(cleanTargetUrl, window.location.origin);
            targetHostname = parsed.hostname.toLowerCase();
        } catch {
            targetHostname = cleanTargetUrl;
        }
    }

    // Populate Target URL Box
    if (cleanTargetUrl) {
        if (targetUrlDisplay) targetUrlDisplay.textContent = cleanTargetUrl;
        if (envSnippetText && targetHostname) {
            envSnippetText.textContent = `TRUSTED_DOMAINS=${targetHostname},*.${targetHostname}`;
        }
    } else {
        const noUrlMsg = typeof t === 'function' ? t('warning_no_url') : '未指定重定向目标网址';
        if (targetUrlDisplay) targetUrlDisplay.textContent = noUrlMsg;
        if (envSnippetText) envSnippetText.textContent = 'TRUSTED_DOMAINS=example.com,*.example.com';
        if (copyUrlCardBtn) copyUrlCardBtn.disabled = true;
        if (copyMainActionBtn) copyMainActionBtn.disabled = true;
    }

    // Determine login status for navigation button
    fetch('/api/status')
        .then(r => r.json())
        .then(data => {
            if (!data || !data.user) {
                if (navDashboardBtn) {
                    navDashboardBtn.href = '/';
                    const loginText = typeof t === 'function' ? t('warning_btn_go_login') : '返回登录页';
                    navDashboardBtn.textContent = loginText;
                }
            }
        })
        .catch(() => {
            if (navDashboardBtn) {
                navDashboardBtn.href = '/';
                const loginText = typeof t === 'function' ? t('warning_btn_go_login') : '返回登录页';
                navDashboardBtn.textContent = loginText;
            }
        });

    // Copy helper
    function copyToClipboard(text, btnElement, textElement) {
        if (!text) return;
        const copiedText = typeof t === 'function' ? t('btn_copied') : '已复制';
        const originalText = textElement ? textElement.textContent : '';

        function feedback() {
            if (btnElement) btnElement.classList.add('copied');
            if (textElement) textElement.textContent = `✓ ${copiedText}`;
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
