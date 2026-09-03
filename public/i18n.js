/**
 * public/i18n.js
 * Backward-compatibility entry point for Situla Auth i18n system.
 * Routes to modular engine in /i18n/i18n.js and language packs in /i18n/locales/*.js
 */
(function() {
    'use strict';

    // If i18n engine is not already loaded, inject the modular scripts synchronously
    if (typeof window !== 'undefined' && !window.i18n) {
        const scripts = [
            '/i18n/locales/zh-CN.js',
            '/i18n/locales/en-US.js',
            '/i18n/i18n.js'
        ];

        scripts.forEach(src => {
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            document.head.appendChild(s);
        });
    }
})();
