/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Production Bundle
 * ============================================================================ */
(function(window, document) {
'use strict';

/* --- device-detect.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Device Fingerprint & Layout Engine (device-detect.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

/* ============================================================================
 * Device Fingerprint Analysis
 * ============================================================================
 * Accurate identification of iPad, iPhone, Android, and Desktop environments.
 * iPadOS 13+ defaults to desktop Safari UA ('MacIntel') but exposes maxTouchPoints > 1.
 * ============================================================================ */

/* Detect iPad across legacy and modern iPadOS versions */
function isIPadDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isLegacyIPad = /iPad/i.test(ua) || /iPad/i.test(platform);
    const isModernIPad = (platform === 'MacIntel' || ua.includes('Macintosh')) && navigator.maxTouchPoints > 1;
    return Boolean(isLegacyIPad || isModernIPad);
}

/* Detect iPhone and iPod Touch */
function isIPhoneDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    return /iPhone|iPod/i.test(ua) || platform === 'iPhone' || platform === 'iPod';
}

/* Detect Android Phone (contains Mobile token) */
function isAndroidPhoneDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android.*Mobile/i.test(ua);
}

/* Detect Android Tablet (contains Android without Mobile token) */
function isAndroidTabletDevice() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android(?!.*Mobile)/i.test(ua);
}

/* Comprehensive Smartphone detection (iPhone or Android phone or small touch screen) */
function isPhoneDevice() {
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
function isTabletDevice() {
    return isIPadDevice() || isAndroidTabletDevice();
}

/* General Mobile Device (Phone or Tablet) */
function isMobileDevice() {
    return isPhoneDevice() || isTabletDevice();
}

/* True Desktop/Laptop (Non-touch PC/Mac) */
function isDesktopDevice() {
    return !isMobileDevice();
}

/* ============================================================================
 * Layout Mode Determination (Device Fingerprint Primary, Screen Size Secondary)
 * ============================================================================
 * 1. Mobile devices (including all iPads) ALWAYS use the Mobile Layout.
 * 2. Desktop/laptops use Desktop Layout if window.innerWidth > 768px.
 * ============================================================================ */
function isMobileLayout() {
    if (isMobileDevice()) {
        return true;
    }
    if (typeof window !== 'undefined') {
        return window.innerWidth <= 768;
    }
    return false;
}

function isDesktopLayout() {
    return !isMobileLayout();
}

/* ============================================================================
 * HTML Root & Body Device Classes Initializer
 * ============================================================================ */
function initDeviceLayout() {
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

    /* Inject dynamic orientation classes (portrait vs landscape) */
    function syncOrientation() {
        if (typeof window === 'undefined') return;
        const isPortrait = window.innerHeight >= window.innerWidth;
        if (isPortrait) {
            docEl.classList.add('orientation-portrait');
            docEl.classList.remove('orientation-landscape');
            if (document.body) {
                document.body.classList.add('orientation-portrait');
                document.body.classList.remove('orientation-landscape');
            }
        } else {
            docEl.classList.add('orientation-landscape');
            docEl.classList.remove('orientation-portrait');
            if (document.body) {
                document.body.classList.add('orientation-landscape');
                document.body.classList.remove('orientation-portrait');
            }
        }
    }
    syncOrientation();

    /* Synchronize layout and orientation classes upon window resize */
    if (!window.__aquaLayoutResizeBound) {
        window.__aquaLayoutResizeBound = true;
        const handleViewportChange = () => {
            syncOrientation();
            const currentMobile = isMobileLayout();
            if (currentMobile) {
                docEl.classList.add('device-mobile');
                docEl.classList.remove('device-desktop');
                if (document.body) {
                    document.body.classList.add('device-mobile');
                    document.body.classList.remove('device-desktop');
                }
            } else {
                docEl.classList.add('device-desktop');
                docEl.classList.remove('device-mobile');
                if (document.body) {
                    document.body.classList.add('device-desktop');
                    document.body.classList.remove('device-mobile');
                }
            }
        };

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', handleViewportChange);
    }
}

/* ============================================================================
 * Smartphone Landscape Orientation Guard (Strict Portrait Enforcer)
 * ============================================================================ */
const ORIENTATION_TEXTS = {
    tc: {
        title: '請將裝置旋轉至直向',
        subtitle: '為提供最佳的瀏覽體驗，本應用手機版僅支援直向模式。'
    },
    sc: {
        title: '请将设备旋转至竖屏',
        subtitle: '为提供最佳的浏览体验，本应用手机版仅支持竖屏模式。'
    },
    en: {
        title: 'Please Rotate to Portrait',
        subtitle: 'For optimal experience, this application only supports portrait mode on mobile phones.'
    }
};

let orientationGuardEl = null;

function initOrientationGuard(options = {}) {
    if (typeof document === 'undefined') return;

    /* iPad and Desktop devices are explicitly exempt from landscape blocking */
    if (!isPhoneDevice()) return;

    const lang = options.lang || 'sc';
    const texts = ORIENTATION_TEXTS[lang] || ORIENTATION_TEXTS.sc;

    if (!orientationGuardEl) {
        orientationGuardEl = document.getElementById('apple-orientation-guard');
        if (!orientationGuardEl) {
            orientationGuardEl = document.createElement('div');
            orientationGuardEl.id = 'apple-orientation-guard';
            orientationGuardEl.innerHTML = `
                <div class="apple-orient-icon-box">
                    <svg class="apple-orient-phone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="3" ry="3"></rect>
                        <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                </div>
                <div class="apple-orient-title">${texts.title}</div>
                <div class="apple-orient-subtitle">${texts.subtitle}</div>
            `;
            document.body.appendChild(orientationGuardEl);
        }
    }

    const checkOrientation = () => {
        if (!isPhoneDevice()) {
            orientationGuardEl.classList.remove('active');
            document.documentElement.classList.remove('is-landscape');
            return;
        }

        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape) {
            orientationGuardEl.classList.add('active');
            document.documentElement.classList.add('is-landscape');
        } else {
            orientationGuardEl.classList.remove('active');
            document.documentElement.classList.remove('is-landscape');
        }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
}

/* ============================================================================
 * Zero-FOUC Head Tag Injection Helper
 * ============================================================================ */
function getEarlyFingerprintSnippet() {
    return `<script>(function(){var u=navigator.userAgent||"",p=navigator.platform||"",i=/iPad/i.test(u)||/iPad/i.test(p)||((p==="MacIntel"||u.indexOf("Macintosh")!==-1)&&navigator.maxTouchPoints>1),ph=/iPhone|iPod/i.test(u)||p==="iPhone"||p==="iPod"||/Android.*Mobile/i.test(u),t=i||/Android(?!.*Mobile)/i.test(u),m=ph||t||window.innerWidth<=768,d=document.documentElement;if(m){d.classList.add("device-mobile");if(t)d.classList.add("device-tablet");if(ph)d.classList.add("device-phone");if(i)d.classList.add("device-ipad");}else{d.classList.add("device-desktop");}})();<\/script>`;
}


/* --- standalone-sync.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — PWA Standalone Chin-Gap Synchronizer (standalone-sync.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

/* ============================================================================
 * iOS Standalone WebApp Viewport & Tab Bar Synchronizer
 * Fixes WebKit "chin gap" / status bar offset bug where WebKit pulls bottom: 0
 * upward by the status bar height (~59px-64px) on standalone PWA launch.
 * ============================================================================ */
/* Detect whether the application is running in iOS/PWA standalone full-screen mode */
function isStandalonePWA() {
    if (typeof window === 'undefined') return false;
    const isIOSStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
    const isPWAStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    return Boolean(isIOSStandalone || isPWAStandalone);
}

function syncStandaloneTabBar() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (!isStandalonePWA()) {
        return;
    }

    document.documentElement.classList.add('is-standalone');

    const tabBar = document.querySelector('.apple-tab-bar');
    if (!tabBar) return;

    /* Ensure tab bar is anchored strictly to bottom: 0 without negative offset clipping */
    document.documentElement.style.setProperty('--tab-bar-standalone-bottom', '0px');
    tabBar.style.removeProperty('bottom');
}

/* ============================================================================
 * Standalone Lifecycle Multi-Point Initialization
 * ============================================================================ */
function initStandaloneSync() {
    if (typeof window === 'undefined') return;

    const isIOSStandalone = ('standalone' in window.navigator) && window.navigator.standalone;
    const isPWAStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

    if (isIOSStandalone || isPWAStandalone) {
        syncStandaloneTabBar();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', syncStandaloneTabBar);
        }
        window.addEventListener('load', syncStandaloneTabBar);
        window.addEventListener('resize', syncStandaloneTabBar);
        window.addEventListener('orientationchange', syncStandaloneTabBar);
        window.addEventListener('pageshow', syncStandaloneTabBar);
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                syncStandaloneTabBar();
            }
        });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncStandaloneTabBar);
            window.visualViewport.addEventListener('scroll', syncStandaloneTabBar);
        }

        /* Staggered verification checkpoints */
        [50, 150, 300, 600, 1200].forEach(ms => {
            setTimeout(syncStandaloneTabBar, ms);
        });

        /* Prevent internal links from kicking user out of PWA into Safari */
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:') || anchor.target === '_blank') return;
            if (anchor.origin === window.location.origin) {
                e.preventDefault();
                window.location.href = href;
            }
        }, { capture: true });
    }
}


/* --- navigation-stack.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Navigation Stack & Subpage Transitions (navigation-stack.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

/* ============================================================================
 * Navigation Stack State & History Manager
 * ============================================================================ */
const navHistory = [];
let isTransitioning = false;

/* Resolve element helper */
function resolveElement(target) {
    if (!target) return null;
    if (typeof target === 'string') {
        return document.getElementById(target.replace(/^#/, '')) || document.querySelector(target);
    }
    return target;
}

/* ============================================================================
 * Subpage Push Transition Controller
 * ============================================================================ */
function pushSubpage(targetSubpage, options = {}) {
    if (typeof document === 'undefined') return null;
    if (isTransitioning) return null;

    const subpageEl = resolveElement(targetSubpage);
    if (!subpageEl) return null;

    isTransitioning = true;

    /* Determine current active parent view */
    const parentView = resolveElement(options.fromView) || 
                       document.querySelector('.tab-pane.active:not(.apple-subpage)') ||
                       document.querySelector('.view-content.active:not(.apple-subpage)') || 
                       document.querySelector('.apple-nav-view.active') ||
                       document.querySelector('.apple-desktop-stage');

    const title = options.title || subpageEl.getAttribute('data-title') || '';
    const parentTitle = options.parentTitle || (parentView ? parentView.getAttribute('data-title') : '') || '返回';

    /* 1. Mark parent view as pushed backward */
    if (parentView) {
        parentView.classList.add('is-pushed');
    }

    /* 2. Update Subpage Header Title and Back Button */
    const subpageTitleEl = subpageEl.querySelector('.apple-subpage-title');
    if (subpageTitleEl && title) {
        subpageTitleEl.textContent = title;
    }

    const backBtn = subpageEl.querySelector('.apple-nav-back-btn, .apple-subpage-back-btn');
    if (backBtn) {
        const backLabel = backBtn.querySelector('.apple-back-label, span');
        if (backLabel && parentTitle) {
            backLabel.textContent = parentTitle;
        }
    }

    /* 3. Update Mobile Top Nav if present */
    const mobileTopNav = document.querySelector('.apple-top-nav');
    if (mobileTopNav) {
        mobileTopNav.classList.add('has-back');
        const mobileTitle = mobileTopNav.querySelector('.nav-title');
        if (mobileTitle && title) {
            mobileTitle.setAttribute('data-prev-title', mobileTitle.textContent);
            mobileTitle.textContent = title;
        }
        const mobileBackBtn = mobileTopNav.querySelector('.apple-back-btn');
        if (mobileBackBtn) {
            const mobileBackText = mobileBackBtn.querySelector('span:not(svg)');
            if (mobileBackText) mobileBackText.textContent = parentTitle;
        }
    }

    /* 4. Prepare subpage for sliding entry */
    subpageEl.style.display = 'block';
    subpageEl.style.position = 'absolute';
    subpageEl.style.top = '0';
    subpageEl.style.left = '0';
    subpageEl.style.width = '100%';
    subpageEl.classList.remove('is-exiting');

    /* Force reflow before adding active class to trigger CSS transition */
    void subpageEl.offsetWidth;
    subpageEl.classList.add('active');

    /* Record entry in navigation stack */
    const prevScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    let historyPushed = false;
    if (typeof window !== 'undefined' && window.history && window.history.pushState && !options.skipHistory) {
        try {
            const subId = subpageEl.id || 'subpage';
            window.history.pushState({ aquaSubpage: subId }, '', '#' + subId);
            historyPushed = true;
        } catch (ignored) {}
    }

    /* Mark body as having an active subpage to update tab bar visibility */
    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('is-subpage');
    }

    navHistory.push({
        subpage: subpageEl,
        parentView: parentView,
        title: title,
        parentTitle: parentTitle,
        scrollY: prevScrollY,
        historyPushed: historyPushed
    });

    setTimeout(() => {
        /* Once transition completes, make subpage in-flow and hide pushed parent view if separate */
        if (parentView && !parentView.contains(subpageEl)) {
            parentView.style.display = 'none';
        }
        subpageEl.style.position = 'relative';
        subpageEl.style.top = '';
        subpageEl.style.left = '';
        subpageEl.style.width = '';
        isTransitioning = false;
        if (typeof options.onPush === 'function') {
            options.onPush(subpageEl);
        }
    }, 320);

    return subpageEl;
}

/* ============================================================================
 * Subpage Pop (Return) Transition Controller
 * ============================================================================ */
function popSubpage(options = {}) {
    if (typeof document === 'undefined') return null;
    if (isTransitioning) return null;
    if (navHistory.length === 0) return null;

    isTransitioning = true;
    const currentEntry = navHistory.pop();
    const { subpage, parentView, scrollY, historyPushed } = currentEntry;

    /* Revert browser history state if pushed by AquaKit */
    if (!options.fromHistory && historyPushed && typeof window !== 'undefined' && window.history) {
        if (window.location.hash) {
            try {
                window.history.back();
            } catch (ignored) {}
        }
    }

    /* 1. Restore parent view to display before triggering transition */
    if (parentView) {
        parentView.style.display = '';
        parentView.classList.add('is-pushed');
    }

    /* 2. Anchor subpage absolutely so parent view can slide back in place */
    if (subpage) {
        subpage.style.position = 'absolute';
        subpage.style.top = '0';
        subpage.style.left = '0';
        subpage.style.width = '100%';
    }

    /* Force reflow */
    if (parentView) void parentView.offsetWidth;

    /* 3. Play Exit Slide Animation & Restore Parent */
    if (subpage) {
        subpage.classList.add('is-exiting');
    }
    if (parentView) {
        parentView.classList.remove('is-pushed');
    }

    /* 4. Restore Mobile Top Nav & Tab Bar State */
    if (navHistory.length === 0 && typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('is-subpage');
    }
    const mobileTopNav = document.querySelector('.apple-top-nav');
    if (mobileTopNav) {
        if (navHistory.length === 0) {
            mobileTopNav.classList.remove('has-back');
            const mobileTitle = mobileTopNav.querySelector('.nav-title');
            if (mobileTitle && mobileTitle.getAttribute('data-prev-title')) {
                mobileTitle.textContent = mobileTitle.getAttribute('data-prev-title');
                mobileTitle.removeAttribute('data-prev-title');
            }
        } else {
            /* Update to previous stack entry */
            const prevEntry = navHistory[navHistory.length - 1];
            const mobileTitle = mobileTopNav.querySelector('.nav-title');
            if (mobileTitle && prevEntry.title) {
                mobileTitle.textContent = prevEntry.title;
            }
        }
    }

    setTimeout(() => {
        if (subpage) {
            subpage.classList.remove('active');
            subpage.classList.remove('is-exiting');
            subpage.style.display = 'none';
            subpage.style.position = '';
            subpage.style.top = '';
            subpage.style.left = '';
            subpage.style.width = '';
        }
        if (typeof scrollY === 'number' && typeof window !== 'undefined') {
            window.scrollTo({ top: scrollY, behavior: 'instant' });
        }
        isTransitioning = false;
        if (typeof options.onPop === 'function') {
            options.onPop(subpage);
        }
    }, 280);

    return subpage;
}

/* Check if subpages are currently opened */
function isSubpageActive() {
    return navHistory.length > 0;
}

/* ============================================================================
 * Automatic Navigation Stack Event Delegator & Apple Edge-Swipe Gesture
 * ============================================================================ */
function initNavigationStack(options = {}) {
    if (typeof document === 'undefined') return;

    /* Bind push openers */
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-open-subpage]');
        if (trigger) {
            e.preventDefault();
            const targetId = trigger.getAttribute('data-open-subpage');
            const title = trigger.getAttribute('data-subpage-title');
            const parentTitle = trigger.getAttribute('data-parent-title');
            pushSubpage(targetId, { title, parentTitle });
            return;
        }

        /* Bind pop closers (Back buttons) */
        const backTrigger = e.target.closest('[data-close-subpage], .apple-nav-back-btn, .apple-subpage-back-btn, .apple-top-nav .apple-back-btn');
        if (backTrigger) {
            e.preventDefault();
            popSubpage();
        }
    });

    /* Keyboard Escape Key Dismiss */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isSubpageActive()) {
            popSubpage();
        }
    });

    /* Browser Popstate Sync (Safari Back / Android Back / Swipe Back) */
    window.addEventListener('popstate', () => {
        if (isSubpageActive()) {
            popSubpage({ fromHistory: true });
        }
    });

    /* ========================================================================
     * Apple Native Interactive Edge-Swipe-to-Pop Gesture (iOS 18 Physics)
     * Disables Safari native swipe navigation conflict via non-passive cancel
     * ======================================================================== */
    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwiping = false;
    let activeSubpage = null;
    let activeParent = null;

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || !isSubpageActive() || isTransitioning) return;
        const touch = e.touches[0];
        /* Only initiate if touch begins within 32px of the left physical bezel */
        if (touch.clientX > 32) return;

        const currentEntry = navHistory[navHistory.length - 1];
        if (!currentEntry || !currentEntry.subpage) return;

        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isEdgeSwiping = true;
        activeSubpage = currentEntry.subpage;
        activeParent = currentEntry.parentView;

        if (activeParent) {
            activeParent.style.display = '';
            activeParent.classList.add('is-pushed');
            activeParent.style.transition = 'none';
        }
        if (activeSubpage) {
            activeSubpage.style.position = 'absolute';
            activeSubpage.style.top = '0';
            activeSubpage.style.left = '0';
            activeSubpage.style.width = '100%';
            activeSubpage.style.transition = 'none';
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isEdgeSwiping || !activeSubpage) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = Math.abs(touch.clientY - touchStartY);

        /* If vertical scroll is detected early, cancel horizontal swipe */
        if (deltaX <= 0) return;
        if (deltaY > deltaX && deltaX < 24) {
            isEdgeSwiping = false;
            if (activeSubpage) activeSubpage.style.transition = '';
            if (activeParent) activeParent.style.transition = '';
            return;
        }

        /* Crucial: Prevent Safari from triggering its native back-swipe gesture */
        if (e.cancelable) {
            e.preventDefault();
        }

        const screenW = window.innerWidth || 390;
        const progress = Math.min(Math.max(deltaX / screenW, 0), 1);

        activeSubpage.style.transform = `translate3d(${deltaX}px, 0, 0)`;
        if (activeParent) {
            const parentShift = -28 + progress * 28;
            const parentBrightness = 0.72 + progress * 0.28;
            activeParent.style.transform = `translate3d(${parentShift}%, 0, 0)`;
            activeParent.style.filter = `brightness(${parentBrightness})`;
        }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
        if (!isEdgeSwiping || !activeSubpage) return;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const screenW = window.innerWidth || 390;
        const progress = deltaX / screenW;

        if (progress > 0.30) {
            /* Velocity threshold met: finish pop */
            isEdgeSwiping = false;
            if (activeSubpage) activeSubpage.style.transition = '';
            if (activeParent) activeParent.style.transition = '';
            activeSubpage = null;
            activeParent = null;
            popSubpage();
        } else {
            /* Cancel swipe: spring back to open position */
            activeSubpage.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)';
            activeSubpage.style.transform = 'translate3d(0, 0, 0)';
            if (activeParent) {
                activeParent.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), filter 0.25s';
                activeParent.style.transform = 'translate3d(-28%, 0, 0)';
                activeParent.style.filter = 'brightness(0.72)';
            }
            setTimeout(() => {
                if (activeSubpage) {
                    activeSubpage.style.transition = '';
                    activeSubpage.style.position = 'relative';
                }
                if (activeParent) {
                    activeParent.style.transition = '';
                    activeParent.style.display = 'none';
                }
                isEdgeSwiping = false;
                activeSubpage = null;
                activeParent = null;
            }, 260);
        }
    }, { passive: true });
}


/* --- desktop-shell.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Desktop Shell Controller (desktop-shell.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */



/* ============================================================================
 * Apple Fluid Animated Red Indicator Physics Engine
 * ============================================================================ */
function setupAnimatedNavIndicator(sidebarEl, activeId = null) {
    const navContainer = sidebarEl.querySelector('.apple-sidebar-nav');
    if (!navContainer) return null;

    let indicator = navContainer.querySelector('.apple-nav-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'apple-nav-indicator';
        navContainer.appendChild(indicator);
    }

    document.body.classList.add('has-animated-indicator');

    function getItemPosition(itemEl) {
        if (!itemEl || !navContainer) return null;
        let top = 0;
        let curr = itemEl;
        let found = false;
        while (curr && curr !== navContainer) {
            top += curr.offsetTop;
            curr = curr.offsetParent;
            if (curr === navContainer) {
                found = true;
                break;
            }
        }
        if (!found) {
            const itemRect = itemEl.getBoundingClientRect();
            const parentRect = navContainer.getBoundingClientRect();
            top = (itemRect.top - parentRect.top) + navContainer.scrollTop;
        }
        const height = itemEl.offsetHeight || 32;
        const left = itemEl.offsetLeft + 2;
        return {
            top: top + (height - 16) / 2,
            left: left
        };
    }

    let currentY = null;

    function moveIndicator(fromY, toY, leftX, onFinish) {
        if (typeof leftX === 'number') {
            indicator.style.left = `${leftX}px`;
        }

        if (typeof fromY !== 'number' || typeof toY !== 'number') {
            if (typeof toY === 'number') {
                indicator.style.top = `${toY}px`;
                indicator.style.height = '16px';
                indicator.style.opacity = '1';
                currentY = toY;
            }
            if (onFinish) onFinish();
            return;
        }

        indicator.style.opacity = '1';

        if (Math.abs(toY - fromY) < 1) {
            indicator.style.top = `${toY}px`;
            indicator.style.height = '16px';
            currentY = toY;
            if (onFinish) onFinish();
            return;
        }

        const isDown = toY > fromY;
        const keyframes = isDown ? [
            /* 0%: Full length at origin */
            { top: `${fromY}px`, height: '16px', easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
            /* 26%: In place, shorten towards bottom */
            { top: `${fromY + 12}px`, height: '4px', easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
            /* 66%: Move to destination top while compressed */
            { top: `${toY}px`, height: '4px', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            /* 88%: Slight elastic overshoot elongation */
            { top: `${toY}px`, height: '17.5px', easing: 'ease-out' },
            /* 100%: Settle at target 16px */
            { top: `${toY}px`, height: '16px' }
        ] : [
            /* 0%: Full length at origin */
            { top: `${fromY}px`, height: '16px', easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
            /* 26%: In place, shorten towards top */
            { top: `${fromY}px`, height: '4px', easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
            /* 66%: Move to destination bottom while compressed */
            { top: `${toY + 12}px`, height: '4px', easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            /* 88%: Slight elastic overshoot elongation */
            { top: `${toY - 1.5}px`, height: '17.5px', easing: 'ease-out' },
            /* 100%: Settle at target 16px */
            { top: `${toY}px`, height: '16px' }
        ];

        try {
            const anim = indicator.animate(keyframes, {
                duration: 280,
                fill: 'forwards',
                easing: 'linear'
            });

            anim.onfinish = () => {
                indicator.style.top = `${toY}px`;
                indicator.style.height = '16px';
                currentY = toY;
                if (onFinish) onFinish();
            };
        } catch (e) {
            indicator.style.top = `${toY}px`;
            indicator.style.height = '16px';
            currentY = toY;
            if (onFinish) onFinish();
        }
    }

    function syncPosition(smooth = false) {
        const activeItem = navContainer.querySelector('.apple-nav-item.active');
        if (!activeItem) {
            indicator.style.opacity = '0';
            return;
        }

        const targetPos = getItemPosition(activeItem);
        if (targetPos === null) return;

        indicator.style.left = `${targetPos.left}px`;

        if (smooth && currentY !== null) {
            moveIndicator(currentY, targetPos.top, targetPos.left);
        } else {
            indicator.style.top = `${targetPos.top}px`;
            indicator.style.height = '16px';
            indicator.style.opacity = '1';
            currentY = targetPos.top;
        }
    }

    /* Bind item clicks to trigger fluid animation */
    const navItems = navContainer.querySelectorAll('.apple-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const activeItem = navContainer.querySelector('.apple-nav-item.active');
            const fromPos = activeItem ? getItemPosition(activeItem) : null;
            const fromY = fromPos ? fromPos.top : currentY;
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const toPos = getItemPosition(item);
            if (toPos !== null) {
                moveIndicator(fromY, toPos.top, toPos.left);
            } else {
                syncPosition(false);
            }
        });
    });

    /* Initial and resize synchronization */
    requestAnimationFrame(() => syncPosition(false));
    setTimeout(() => syncPosition(false), 50);
    setTimeout(() => syncPosition(false), 200);

    window.addEventListener('resize', () => syncPosition(false));
    navContainer.addEventListener('scroll', () => syncPosition(false));

    const controller = {
        sync: syncPosition,
        moveTo: (itemEl) => {
            const toPos = getItemPosition(itemEl);
            if (toPos !== null) moveIndicator(currentY || toPos.top, toPos.top, toPos.left);
        }
    };
    navContainer.__navIndicatorController = controller;
    return controller;
}

/* ============================================================================
 * Desktop Sidebar Navigation & Profile Controller
 * ============================================================================ */
function initDesktopShell(options = {}) {
    if (typeof document === 'undefined') return;

    /* Discard desktop sidebar processing on mobile devices (including all iPads) */
    if (isMobileLayout()) return;

    const {
        activeId = null,
        onSearch = null,
        profileText = null,
        copySuccessText = '✓ 已複製！',
        enableIndicator = true
    } = options;

    const sidebar = document.querySelector('.apple-desktop-sidebar');
    if (!sidebar) return;

    /* 1. Setup Navigation Items Active State */
    const navItems = sidebar.querySelectorAll('.apple-nav-item');
    if (activeId) {
        navItems.forEach(item => {
            const itemId = item.getAttribute('data-id') || item.getAttribute('href');
            if (itemId === activeId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /* 2. Setup Apple Fluid Sliding Red Indicator */
    if (enableIndicator) {
        setupAnimatedNavIndicator(sidebar, activeId);
    }

    /* 3. Setup Instant Sidebar Search Filter */
    const searchInput = sidebar.querySelector('.apple-sidebar-search input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (typeof onSearch === 'function') {
                onSearch(query);
                return;
            }

            navItems.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });

            /* Hide empty section headers */
            const sections = sidebar.querySelectorAll('.apple-nav-header');
            sections.forEach(header => {
                let nextEl = header.nextElementSibling;
                let hasVisible = false;
                while (nextEl && !nextEl.classList.contains('apple-nav-header')) {
                    if (nextEl.classList.contains('apple-nav-item') && nextEl.style.display !== 'none') {
                        hasVisible = true;
                        break;
                    }
                    nextEl = nextEl.nextElementSibling;
                }
                header.style.display = hasVisible || !query ? 'block' : 'none';
            });
        });
    }

    /* 4. Setup Apple Music 24px Profile Card with Inline Copy Feedback */
    const profileCard = sidebar.querySelector('.apple-profile-card');
    if (profileCard) {
        const labelEl = profileCard.querySelector('.apple-profile-label');
        const rawText = profileText || (labelEl ? labelEl.textContent.trim() : '');

        /* Guarantee native browser tooltip */
        profileCard.setAttribute('title', rawText);
        if (labelEl) labelEl.setAttribute('title', rawText);

        profileCard.addEventListener('click', async () => {
            if (!rawText) return;

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(rawText);
                } else {
                    const temp = document.createElement('textarea');
                    temp.value = rawText;
                    document.body.appendChild(temp);
                    temp.select();
                    document.execCommand('copy');
                    document.body.removeChild(temp);
                }

                if (labelEl) {
                    const originalContent = labelEl.textContent;
                    profileCard.classList.add('copied');
                    labelEl.textContent = copySuccessText;

                    setTimeout(() => {
                        labelEl.textContent = originalContent;
                        profileCard.classList.remove('copied');
                    }, 1500);
                }
            } catch (err) {
                console.error('Failed to copy text: ', err);
            }
        });
    }
}


/* --- tab-bar.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Mobile Tab Bar Controller (tab-bar.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */




/* ============================================================================
 * Mobile Tab Bar Controller
 * ============================================================================ */
function initTabBar(options = {}) {
    if (typeof document === 'undefined') return null;

    const {
        activeId = null,
        onTabChange = null
    } = options;

    const tabBar = document.querySelector('.apple-tab-bar');
    if (!tabBar) return null;

    const tabItems = tabBar.querySelectorAll('.apple-tab-item');

    /* Sync active tab class */
    if (activeId) {
        tabItems.forEach(item => {
            const id = item.getAttribute('data-id') || item.getAttribute('href');
            if (id === activeId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /* Tab selection event listeners */
    tabItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const id = item.getAttribute('data-id') || item.getAttribute('href');
            if (typeof onTabChange === 'function') {
                const proceed = onTabChange(id, item, e);
                if (proceed === false) {
                    e.preventDefault();
                    return;
                }
            }

            tabItems.forEach(t => t.classList.remove('active'));
            item.classList.add('active');

            /* Trigger gentle device haptics if supported */
            if (navigator.vibrate) {
                try {
                    navigator.vibrate(10);
                } catch (ignored) {}
            }
        });
    });

    /* Synchronize standalone viewport positioning */
    syncStandaloneTabBar();

    return tabBar;
}


/* --- components.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Interactive Components (components.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */

/* ============================================================================
 * Apple Segmented Control Controller
 * ============================================================================ */
function initSegmentedControls(options = {}) {
    if (typeof document === 'undefined') return;

    const { onSegmentChange = null } = options;
    const controls = document.querySelectorAll('.apple-segmented-control');

    controls.forEach(control => {
        const buttons = control.querySelectorAll('.apple-segment-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const value = btn.getAttribute('data-value') || btn.textContent.trim();
                if (typeof onSegmentChange === 'function') {
                    onSegmentChange(value, btn, control);
                }

                /* Dispatch standard DOM event */
                control.dispatchEvent(new CustomEvent('change', {
                    detail: { value, button: btn },
                    bubbles: true
                }));
            });
        });
    });
}

/* ============================================================================
 * Apple Bottom Sheet & Modal Helper
 * ============================================================================ */
function openModal(modalEl) {
    const el = typeof modalEl === 'string' ? document.querySelector(modalEl) : modalEl;
    if (!el) return;
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalEl) {
    const el = typeof modalEl === 'string' ? document.querySelector(modalEl) : modalEl;
    if (!el) return;
    el.classList.remove('active');
    document.body.style.removeProperty('overflow');
}





/* ============================================================================
 * Apple Loading Indicator Helpers
 * ============================================================================ */
function showLoading(targetEl, text = '') {
    if (typeof document === 'undefined') return null;
    const el = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl;
    if (!el) return null;
    let overlay = el.querySelector(':scope > .apple-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'apple-loading-overlay';
        overlay.innerHTML = `
            <div class="apple-spinner apple-spinner-md">
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
                <div class="apple-spinner-blade"></div>
            </div>
            ${text ? `<div class="apple-loading-text">${text}</div>` : ''}
        `;
        el.style.position = 'relative';
        el.appendChild(overlay);
    }
    overlay.classList.add('active');
    return overlay;
}

function hideLoading(targetEl) {
    if (typeof document === 'undefined') return;
    const el = typeof targetEl === 'string' ? document.querySelector(targetEl) : targetEl;
    if (!el) return;
    const overlay = el.querySelector(':scope > .apple-loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
    }
}

/* ============================================================================
 * Automatic Component Hydration
 * ============================================================================ */
function initAquaComponents() {
    initSegmentedControls();
    initNavigationStack();
}


/* --- uikit.js --- */
/* ============================================================================
 * AquaKit (Apple HIG Web UIKit) — Unified Master Entrypoint (uikit.js)
 * ============================================================================
 * COMMENTING STANDARDS
 * 1. Block comments only. Inline comments are strictly prohibited.
 * 2. Section dividers use the === banner format.
 * 3. All prose is written in English.
 * ============================================================================ */




















var Device = {
    isIPadDevice,
    isIPhoneDevice,
    isAndroidPhoneDevice,
    isAndroidTabletDevice,
    isPhoneDevice,
    isMobileLayout,
    initDeviceLayout,
    initOrientationGuard
};

var Standalone = {
    isStandalonePWA,
    initStandaloneSync,
    syncStandaloneTabBar
};

var Desktop = {
    setupAnimatedNavIndicator,
    initDesktopShell
};

var Mobile = {
    initTabBar
};

var Components = {
    initSegmentedControls,
    openModal,
    closeModal,
    showLoading,
    hideLoading,
    pushSubpage,
    popSubpage,
    isSubpageActive,
    initNavigationStack,
    initAquaComponents
};

/* ============================================================================
 * Unified Initialization Orchestrator
 * ============================================================================ */
function initAquaKit(options = {}) {
    /* 1. Root & Device Class Injection */
    initDeviceLayout();

    /* 2. Phone Landscape Orientation Guard */
    initOrientationGuard({
        lang: options.lang || 'sc'
    });

    /* 3. iOS WebApp Standalone Chin-Gap Synchronizer */
    initStandaloneSync();

    /* 4. Navigation Stack & Subpage Transitions */
    initNavigationStack();

    /* 5. Interactive Components (Segmented Controls, Modals) */
    initAquaComponents();

    /* 6. Desktop Shell Controller (if applicable) */
    if (options.desktopShell !== false) {
        initDesktopShell(options.desktopShell || {});
    }

    /* 7. Mobile Tab Bar Controller (if applicable) */
    if (options.tabBar !== false) {
        initTabBar(options.tabBar || {});
    }
}

/* ============================================================================
 * Browser Global Window Attachment
 * ============================================================================ */
if (typeof window !== 'undefined') {
    window.AquaKit = {
        init: initAquaKit,
        Device,
        Standalone,
        Desktop,
        Mobile,
        Components,
        pushSubpage,
        popSubpage,
        isSubpageActive,
        initNavigationStack,
        showLoading,
        hideLoading
    };
    window.AquaUI = window.AquaKit;

    /* Auto-initialize device classes as soon as DOM is interactive */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initDeviceLayout();
            initStandaloneSync();
            initNavigationStack();
        });
    } else {
        initDeviceLayout();
        initStandaloneSync();
        initNavigationStack();
    }
}



})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : null);
