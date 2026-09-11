/* ============================================================================
 * Situla Auth 2.0 — Device Detection & Layout Routing (device-detect.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

import { t } from './ui.js';

/* ============================================================================
 * Device Fingerprint Analysis
 * ============================================================================
 * Accurate identification of iPad, iPhone, Android, and Desktop environments.
 * iPadOS 13+ defaults to desktop Safari UA ('MacIntel') but exposes maxTouchPoints > 1.
 * ============================================================================ */

/* Detect iPad across legacy and modern iPadOS versions */
export function isIPadDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isLegacyIPad = /iPad/i.test(ua) || /iPad/i.test(platform);
    const isModernIPad = (platform === 'MacIntel' || ua.includes('Macintosh')) && navigator.maxTouchPoints > 1;
    return Boolean(isLegacyIPad || isModernIPad);
}

/* Detect iPhone and iPod Touch */
export function isIPhoneDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    return /iPhone|iPod/i.test(ua) || platform === 'iPhone' || platform === 'iPod';
}

/* Detect Android Phone (contains Mobile token) */
export function isAndroidPhoneDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android.*Mobile/i.test(ua);
}

/* Detect Android Tablet (contains Android without Mobile token) */
export function isAndroidTabletDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android(?!.*Mobile)/i.test(ua);
}

/* Comprehensive Smartphone detection (iPhone, Android phone, or small touch screen) */
export function isPhoneDevice() {
    if (isIPhoneDevice() || isAndroidPhoneDevice()) return true;
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
        if (hasTouch && !isIPadDevice() && !isAndroidTabletDevice()) {
            const minDim = Math.min(window.screen.width, window.screen.height);
            if (minDim > 0 && minDim <= 480) {
                return true;
            }
        }
    }
    return false;
}

/* Comprehensive Tablet detection (iPad or Android tablet) */
export function isTabletDevice() {
    return isIPadDevice() || isAndroidTabletDevice();
}

/* General Mobile Device (Phone or Tablet) */
export function isMobileDevice() {
    return isPhoneDevice() || isTabletDevice();
}

/* True Desktop/Laptop (Non-touch PC/Mac or touch desktop with large mouse pointer) */
export function isDesktopDevice() {
    return !isMobileDevice();
}

/* ============================================================================
 * Layout Mode Determination (Device Fingerprint Primary, Screen Size Secondary)
 * ============================================================================
 * 1. Mobile devices (including all iPads) ALWAYS use the Mobile Layout.
 * 2. Desktop/laptops use Desktop Layout if window.innerWidth > 768px.
 * ============================================================================ */
export function isMobileLayout() {
    if (isMobileDevice()) {
        return true;
    }
    if (typeof window !== 'undefined') {
        return window.innerWidth <= 768;
    }
    return false;
}

export function isDesktopLayout() {
    return !isMobileLayout();
}

/* ============================================================================
 * HTML Root & Body Device Classes Initializer
 * ============================================================================
 * Injects classes into <html> and <body> for CSS isolation and layout targeting.
 * ============================================================================ */
export function initDeviceLayout() {
    if (typeof document === 'undefined') return;

    const docEl = document.documentElement;
    const isMobile = isMobileLayout();
    const isPhone = isPhoneDevice();
    const isTablet = isTabletDevice();
    const isIPad = isIPadDevice();
    const isIPhone = isIPhoneDevice();

    if (isMobile) {
        docEl.classList.add('device-mobile');
        docEl.classList.remove('device-desktop');
        if (document.body) {
            document.body.classList.add('device-mobile');
            document.body.classList.remove('device-desktop');
            document.body.classList.remove('has-desktop-sidebar');
        }
    } else {
        docEl.classList.add('device-desktop');
        docEl.classList.remove('device-mobile');
        if (document.body) {
            document.body.classList.add('device-desktop');
            document.body.classList.remove('device-mobile');
        }
    }

    if (isPhone) {
        docEl.classList.add('device-phone');
        if (document.body) document.body.classList.add('device-phone');
    }
    if (isTablet) {
        docEl.classList.add('device-tablet');
        if (document.body) document.body.classList.add('device-tablet');
    }
    if (isIPad) {
        docEl.classList.add('device-ipad');
        if (document.body) document.body.classList.add('device-ipad');
    }
    if (isIPhone) {
        docEl.classList.add('device-iphone');
        if (document.body) document.body.classList.add('device-iphone');
    }

    /* Synchronize layout class upon desktop resize */
    if (!window.__deviceLayoutResizeBound) {
        window.__deviceLayoutResizeBound = true;
        window.addEventListener('resize', () => {
            const currentMobile = isMobileLayout();
            if (currentMobile) {
                docEl.classList.add('device-mobile');
                docEl.classList.remove('device-desktop');
                if (document.body) {
                    document.body.classList.add('device-mobile');
                    document.body.classList.remove('device-desktop');
                    document.body.classList.remove('has-desktop-sidebar');
                }
            } else {
                docEl.classList.add('device-desktop');
                docEl.classList.remove('device-mobile');
                if (document.body) {
                    document.body.classList.add('device-desktop');
                    document.body.classList.remove('device-mobile');
                }
            }
        });
    }
}

/* ============================================================================
 * Smartphone Landscape Orientation Guard (Strict Portrait Enforcer)
 * ============================================================================
 * For phones (iPhone/Android), blocks landscape view with an Apple frosted
 * glass rotation prompt. iPads and Desktop PCs are exempt from this blocker.
 * ============================================================================ */

let orientationGuardEl = null;

function updateOrientationGuardText() {
    if (!orientationGuardEl) return;
    const titleEl = orientationGuardEl.querySelector('.guard-title');
    const descEl = orientationGuardEl.querySelector('.guard-desc');
    if (titleEl) titleEl.textContent = t('guard_rotate_title');
    if (descEl) descEl.textContent = t('guard_rotate_desc');
}

function createOrientationGuard() {
    if (document.getElementById('sys-orientation-guard')) {
        orientationGuardEl = document.getElementById('sys-orientation-guard');
        return orientationGuardEl;
    }

    const guard = document.createElement('div');
    guard.id = 'sys-orientation-guard';
    guard.className = 'sys-orientation-guard';
    guard.setAttribute('aria-hidden', 'true');

    /* Apple SF Symbols-grade phone rotation vector graphic & outer orbit arc */
    guard.innerHTML = `
        <div class="guard-card">
            <div class="guard-icon-box">
                <svg class="guard-phone-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path class="guidance-arrow" d="M8 40 C8 22.33 22.33 8 40 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 3.5"/>
                    <path class="guidance-arrow" d="M35 3 L42 8 L35 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <g class="phone-device-group">
                        <rect x="27" y="16" width="26" height="48" rx="6" stroke="currentColor" stroke-width="2.5" fill="rgba(255, 69, 58, 0.08)"/>
                        <rect x="29" y="18" width="22" height="44" rx="4.5" stroke="currentColor" stroke-width="0.75" opacity="0.3" fill="none"/>
                        <rect x="36" y="20.5" width="8" height="2.5" rx="1.25" fill="currentColor"/>
                        <line x1="35" y1="58" x2="45" y2="58" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </g>
                </svg>
            </div>
            <h3 class="guard-title">${t('guard_rotate_title')}</h3>
            <p class="guard-desc">${t('guard_rotate_desc')}</p>
        </div>
    `;

    document.body.appendChild(guard);
    orientationGuardEl = guard;
    return guard;
}

export function checkOrientationState() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    /* Only smartphones are restricted to portrait */
    if (!isPhoneDevice()) {
        if (orientationGuardEl) {
            orientationGuardEl.classList.remove('is-active');
            document.documentElement.classList.remove('is-orientation-blocked');
            if (document.body) document.body.classList.remove('is-orientation-blocked');
        }
        return;
    }

    const isLandscape = window.innerWidth > window.innerHeight;

    if (isLandscape) {
        if (!orientationGuardEl) {
            createOrientationGuard();
        }
        orientationGuardEl.classList.add('is-active');
        orientationGuardEl.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('is-orientation-blocked');
        if (document.body) document.body.classList.add('is-orientation-blocked');
    } else {
        if (orientationGuardEl) {
            orientationGuardEl.classList.remove('is-active');
            orientationGuardEl.setAttribute('aria-hidden', 'true');
        }
        document.documentElement.classList.remove('is-orientation-blocked');
        if (document.body) document.body.classList.remove('is-orientation-blocked');
    }
}

export function initOrientationGuard() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    /* Initial state check */
    checkOrientationState();

    /* Listen to viewport resize and device orientation changes */
    window.addEventListener('resize', checkOrientationState, { passive: true });
    window.addEventListener('orientationchange', () => {
        setTimeout(checkOrientationState, 100);
    }, { passive: true });

    /* Update texts on language switch */
    window.addEventListener('situla-lang-change', () => {
        updateOrientationGuardText();
    });
    window.addEventListener('situla:languagechange', () => {
        updateOrientationGuardText();
    });
}

