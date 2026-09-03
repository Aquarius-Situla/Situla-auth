        const { startAuthentication } = SimpleWebAuthnBrowser;
        let step = 1;

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const submitBtn = document.getElementById('submitBtn');
        const pwdGroup = document.getElementById('passwordGroup');
        const dividerWrap = document.getElementById('dividerWrap');
        const inputCard = document.getElementById('inputCard');
        const usernameGroup = document.getElementById('usernameGroup');
        const passwordGroup = document.getElementById('passwordGroup');
        const errMsg = document.getElementById('errorMessage');
        const togglePasswordBtn = document.getElementById('togglePasswordBtn');
        const eyeIcon = document.getElementById('eyeIcon');

        const EYE_OPEN_SVG = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
        const EYE_CLOSED_SVG = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;

        togglePasswordBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isCurrentlyPassword = passwordInput.type === 'password';
            passwordInput.type = isCurrentlyPassword ? 'text' : 'password';
            if (eyeIcon) {
                eyeIcon.innerHTML = isCurrentlyPassword ? EYE_CLOSED_SVG : EYE_OPEN_SVG;
            }
            const labelKey = isCurrentlyPassword ? 'btn_hide_password' : 'btn_show_password';
            const fallback = isCurrentlyPassword ? '隐藏密码' : '显示密码';
            const newLabel = (window.t ? window.t(labelKey) : (window.i18n?.t(labelKey) || fallback)) || fallback;
            togglePasswordBtn.setAttribute('aria-label', newLabel);
            togglePasswordBtn.setAttribute('title', newLabel);
        });

        let lastUserVal = usernameInput.value;
        let lastPwdVal = passwordInput.value;

        function triggerAutofillPulse(group) {
            if (!group) return;
            group.classList.remove('autofill-pulse');
            void group.offsetWidth;
            group.classList.add('autofill-pulse');
        }

        function checkAutofill() {
            const curUser = usernameInput.value;
            const curPwd = passwordInput.value;

            if (curUser && curUser !== lastUserVal && (curUser.length - lastUserVal.length > 1 || lastUserVal === '')) {
                triggerAutofillPulse(usernameGroup);
            }
            if (curPwd && curPwd !== lastPwdVal && (curPwd.length - lastPwdVal.length > 1 || lastPwdVal === '')) {
                triggerAutofillPulse(passwordGroup);
            }

            lastUserVal = curUser;
            lastPwdVal = curPwd;
            updateButtonState();
        }

        // Unified focus ring on the card (no scaling on click/focus)
        usernameInput.addEventListener('focus', () => inputCard.classList.add('focused'));
        usernameInput.addEventListener('blur', () => {
            if (document.activeElement !== passwordInput) inputCard.classList.remove('focused');
        });

        passwordInput.addEventListener('focus', () => inputCard.classList.add('focused'));
        passwordInput.addEventListener('blur', () => {
            if (document.activeElement !== usernameInput) inputCard.classList.remove('focused');
        });

        // Trigger Apple zoom pulse on autofill
        usernameInput.addEventListener('animationstart', (e) => {
            if (e.animationName === 'onAutoFillStart') {
                triggerAutofillPulse(usernameGroup);
                updateButtonState();
            }
        });
        passwordInput.addEventListener('animationstart', (e) => {
            if (e.animationName === 'onAutoFillStart') {
                triggerAutofillPulse(passwordGroup);
            }
        });

        // Blue button only when username has text
        function updateButtonState() {
            if (usernameInput.value.trim()) {
                submitBtn.classList.add('active');
            } else {
                submitBtn.classList.remove('active');
            }
        }

        ['input', 'change', 'paste', 'keyup'].forEach(evt => {
            usernameInput.addEventListener(evt, checkAutofill);
            passwordInput.addEventListener(evt, checkAutofill);
        });
        setInterval(checkAutofill, 200);

        /* ── Trusted-redirect resolution ── */
        // Cache the trusted roots fetched from the server
        let _trustedRootsPromise = null;
        function getTrustedRoots() {
            if (!_trustedRootsPromise) {
                _trustedRootsPromise = fetch('/api/trusted-domains')
                    .then(r => r.json())
                    .then(data => data.trustedRoots || [])
                    .catch(() => []);
            }
            return _trustedRootsPromise;
        }

        /**
         * Validate a redirect URL against the server-supplied trust list.
         * Trusts hostname === root  OR  hostname ends with "." + root.
         * Returns the original `rd` URL if trusted, otherwise returns null.
         */
        async function safeRedirectUrl(rd) {
            if (!rd || typeof rd !== 'string') return null;
            if (rd.startsWith('/') && !rd.startsWith('//') && !rd.startsWith('/\\')) {
                return rd;
            }
            try {
                const rdUrl = new URL(rd, window.location.origin);
                if (rdUrl.protocol !== 'https:' && rdUrl.protocol !== 'http:') return null;
                const hostname = rdUrl.hostname.toLowerCase();
                const roots = await getTrustedRoots();
                const trusted = roots.some(root =>
                    hostname === root || hostname.endsWith('.' + root)
                );
                return trusted ? rd : null;
            } catch (e) {
                return null;
            }
        }

        // Pre-fetch trust roots as soon as the page loads (avoids latency on login)
        getTrustedRoots();

        // Form submit handler
        async function handleFormSubmit() {
            const u = usernameInput.value.trim();
            const p = passwordInput.value;
            errMsg.textContent = '';

            /* Step 1: Reveal password field with animation */
            if (step === 1) {
                if (!u) {
                    usernameInput.focus();
                    return;
                }

                // Mark username input and group as "top" (flat/square bottom corners)
                usernameInput.classList.add('top-input');
                usernameGroup.classList.add('top-group');

                // Reveal divider + password with slide-down animation
                dividerWrap.classList.add('show');
                pwdGroup.getBoundingClientRect();
                pwdGroup.classList.add('show');

                step = 2;
                if (!p) {
                    return;
                }
            }

            /* Step 2: Attempt login */
            if (step === 2 && !p) {
                passwordInput.focus();
                return;
            }

            submitBtn.textContent = (window.t ? window.t('msg_verifying') : (window.i18n?.t('msg_verifying') || '验证中...')) || '验证中...';
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: u, password: p, totp: '' })
                });

                const data = await res.json();

                if (data.requireTotp) {
                    // Navigate to 2FA page
                    sessionStorage.setItem('tempToken', data.tempToken);
                    sessionStorage.setItem('twoFaMethod', data.twoFaMethod || 'totp');
                    const urlParams = new URLSearchParams(window.location.search);
                    const rd = urlParams.get('rd');
                    window.location.href = rd ? '/2fa.html?rd=' + encodeURIComponent(rd) : '/2fa.html';
                    return;
                }

                if (data.success) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const rd = urlParams.get('rd');
                    let target = '/admin';
                    if (rd) {
                        const safeTarget = await safeRedirectUrl(rd);
                        target = safeTarget || ('/warning.html?rd=' + encodeURIComponent(rd));
                    }
                    setTimeout(() => {
                        window.location.href = target;
                    }, 300);
                } else {
                    errMsg.textContent = data.message || t('msg_wrong_credentials');
                    submitBtn.textContent = t('btn_continue');
                    submitBtn.classList.remove('loading');
                    submitBtn.disabled = false;
                }
            } catch (err) {
                errMsg.textContent = t('msg_network_error');
                submitBtn.textContent = t('btn_continue');
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        }

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmit();
        });

        // Passkey button
        document.getElementById('passkeyBtn').addEventListener('click', async () => {
            errMsg.textContent = '';
            try {
                const resp = await fetch('/api/webauthn/login-options');
                if (!resp.ok) throw new Error(t('msg_no_passkey'));
                const options = await resp.json();

                const asseResp = await startAuthentication(options);

                const verificationResp = await fetch('/api/webauthn/login-verify', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(asseResp)
                });

                const verificationJSON = await verificationResp.json();
                if (verificationJSON && verificationJSON.verified) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const rd = urlParams.get('rd');
                    let target = '/admin';
                    if (rd) {
                        const safeTarget = await safeRedirectUrl(rd);
                        target = safeTarget || ('/warning.html?rd=' + encodeURIComponent(rd));
                    }
                    window.location.href = target;
                } else {
                    console.error('[Situla-Auth Passkey Login Verification Failed]:', verificationJSON);
                    errMsg.textContent = t('msg_passkey_failed');
                }
            } catch (error) {
                console.error('[Situla-Auth Passkey Login Exception]:', error);
                const name = error.name || '';
                const msg = String(error.message || '');
                if (name === 'NotAllowedError' || msg.includes('not allowed') || msg.includes('canceled') || msg.includes('cancelled') || msg.includes('aborted')) {
                    errMsg.textContent = t('msg_operation_canceled');
                } else if (msg === t('msg_no_passkey')) {
                    errMsg.textContent = t('msg_no_passkey');
                } else {
                    errMsg.textContent = t('msg_passkey_failed');
                }
            }
        });

        // Hide subtitle when used as forward auth (rd param present)
        if (new URLSearchParams(window.location.search).get('rd')) {
            const subtitle = document.getElementById('subtitle');
            if (subtitle) {
                subtitle.style.display = 'none';
            }
        }
