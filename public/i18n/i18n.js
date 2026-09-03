/**
 * Situla Auth 2.0 - Core Modular i18n Engine & DOM Localizer
 * Supports drop-in single-file language packs in /i18n/locales/*.js
 */
(function(global) {
    'use strict';

    const DEFAULT_LOCALE = 'zh-CN';
    const STORAGE_KEY = 'situla_lang';

    const registry = new Map();
    const aliasMap = new Map();
    let currentLang = DEFAULT_LOCALE;
    let initialized = false;

    // Register pre-loaded locales if any
    if (global.__SITULA_LOCALES__) {
        Object.keys(global.__SITULA_LOCALES__).forEach(code => {
            registerLocale(global.__SITULA_LOCALES__[code]);
        });
    }

    /**
     * Register a language pack into the engine
     * @param {Object} locale - { code, name, aliases, translations }
     */
    function registerLocale(locale) {
        if (!locale || !locale.code || !locale.translations) return;
        
        registry.set(locale.code, locale);
        aliasMap.set(locale.code.toLowerCase(), locale.code);

        if (Array.isArray(locale.aliases)) {
            locale.aliases.forEach(alias => {
                aliasMap.set(alias.toLowerCase(), locale.code);
            });
        }

        // If newly registered locale matches current selection or navigator language, re-apply
        if (initialized && resolveLocaleCode(currentLang) === locale.code) {
            applyTranslations();
        }
    }

    /**
     * Resolve any alias or BCP-47 tag to registered locale code
     */
    function resolveLocaleCode(input) {
        if (!input || typeof input !== 'string') return DEFAULT_LOCALE;
        const normalized = input.trim().toLowerCase();

        if (aliasMap.has(normalized)) {
            return aliasMap.get(normalized);
        }

        // Match prefix, e.g. "zh-TW" -> "zh-cn" if only "zh" alias registered, or "en-GB" -> "en-US"
        const prefix = normalized.split('-')[0].split('_')[0];
        if (aliasMap.has(prefix)) {
            return aliasMap.get(prefix);
        }

        return registry.has(DEFAULT_LOCALE) ? DEFAULT_LOCALE : (registry.keys().next().value || DEFAULT_LOCALE);
    }

    /**
     * Determine initial user language
     */
    function getInitialLanguage() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return resolveLocaleCode(saved);
        }

        const navLanguages = navigator.languages || [navigator.language || navigator.userLanguage || ''];
        for (const lang of navLanguages) {
            if (lang) {
                const resolved = resolveLocaleCode(lang);
                if (registry.has(resolved)) {
                    return resolved;
                }
            }
        }

        return DEFAULT_LOCALE;
    }

    /**
     * Set active language and re-localize DOM
     */
    function setLanguage(lang) {
        const resolved = resolveLocaleCode(lang);
        currentLang = resolved;
        try {
            localStorage.setItem(STORAGE_KEY, resolved);
        } catch (e) {}
        
        document.documentElement.lang = resolved.startsWith('zh') ? 'zh-CN' : resolved.split('-')[0];
        applyTranslations();

        // Dispatch custom event for reactive listeners
        try {
            window.dispatchEvent(new CustomEvent('situla:languagechange', { detail: { language: resolved } }));
        } catch (e) {}
    }

    /**
     * Get translation by key with parameter interpolation {0}, {1}
     */
    function t(key, ...args) {
        if (!key) return '';

        const activeDict = registry.get(currentLang)?.translations;
        const fallbackDict = registry.get(DEFAULT_LOCALE)?.translations || (registry.values().next().value?.translations);

        let str = (activeDict && typeof activeDict[key] === 'string')
            ? activeDict[key]
            : ((fallbackDict && typeof fallbackDict[key] === 'string') ? fallbackDict[key] : key);

        if (args.length > 0 && typeof str === 'string') {
            args.forEach((arg, i) => {
                str = str.replace(new RegExp(`\\{${i}\\}`, 'g'), String(arg !== undefined ? arg : ''));
            });
        }
        return str;
    }

    /**
     * Apply translations to the DOM
     */
    function applyTranslations(root = document) {
        if (!root) return;

        // 1. Text Content
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = t(key);
            if (translated && translated !== key) {
                el.textContent = translated;
            }
        });

        // 2. Input Placeholders
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translated = t(key);
            if (translated && translated !== key) {
                el.setAttribute('placeholder', translated);
            }
        });

        // 3. Tooltip / Title
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translated = t(key);
            if (translated && translated !== key) {
                el.setAttribute('title', translated);
            }
        });

        // 4. Accessibility / aria-label
        root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            const translated = t(key);
            if (translated && translated !== key) {
                el.setAttribute('aria-label', translated);
            }
        });

        // 5. Page Title
        const pageTitleEl = root.querySelector('[data-page-title-key]');
        if (pageTitleEl) {
            const key = pageTitleEl.getAttribute('data-page-title-key');
            const translated = t(key);
            if (translated && translated !== key) {
                document.title = translated;
            }
        }
    }

    /**
     * Get list of registered languages
     */
    function getAvailableLanguages() {
        return Array.from(registry.values()).map(l => ({
            code: l.code,
            name: l.name || l.code
        }));
    }

    // Initialize state
    currentLang = getInitialLanguage();
    document.documentElement.lang = currentLang.startsWith('zh') ? 'zh-CN' : currentLang.split('-')[0];
    initialized = true;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyTranslations());
    } else {
        applyTranslations();
    }

    const i18nEngine = {
        t,
        register: registerLocale,
        setLanguage,
        getLanguage: () => currentLang,
        getAvailableLanguages,
        applyTranslations,
        resolveLocaleCode
    };

    // Global exports
    global.t = t;
    global.setLanguage = setLanguage;
    global.getLanguage = () => currentLang;
    global.i18n = i18nEngine;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = i18nEngine;
    }
})(typeof window !== 'undefined' ? window : this);
