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
            if (!rd) return null;
            try {
                const rdUrl = new URL(rd, window.location.origin);
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

                // Mark username input as "top" (square bottom corners)
                usernameInput.classList.add('top-input');

                // Reveal divider + password with slide-down animation
                dividerWrap.classList.add('show');
                pwdGroup.getBoundingClientRect();
                pwdGroup.classList.add('show');

                step = 2;
                if (!p) {
                    setTimeout(() => passwordInput.focus(), 350);
                    return;
                }
            }

            /* Step 2: Attempt login */
            if (step === 2 && !p) {
                passwordInput.focus();
                return;
            }

            submitBtn.textContent = t('msg_verifying');
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
                    const target = (await safeRedirectUrl(rd)) || '/admin';
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
                    const target = (await safeRedirectUrl(rd)) || '/admin';
                    window.location.href = target;
                } else {
                    errMsg.textContent = t('msg_passkey_failed');
                }
            } catch (error) {
                errMsg.textContent = error.message || t('msg_passkey_canceled');
            }
        });

        // Hide subtitle when used as forward auth (rd param present)
        if (new URLSearchParams(window.location.search).get('rd')) {
            const subtitle = document.getElementById('subtitle');
            if (subtitle) {
                subtitle.style.display = 'none';
            }
        }
