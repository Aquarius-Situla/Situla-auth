        const { startAuthentication } = SimpleWebAuthnBrowser;
        let step = 1;

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const submitBtn = document.getElementById('submitBtn');
        const pwdGroup = document.getElementById('passwordGroup');
        const dividerWrap = document.getElementById('dividerWrap');
        const inputCard = document.getElementById('inputCard');
        const errMsg = document.getElementById('errorMessage');

        function triggerPulse(el) {
            if (!el) return;
            el.classList.remove('field-pulse');
            void el.offsetWidth;
            el.classList.add('field-pulse');
        }

        // Unified focus ring on the card with field-pulse animation
        usernameInput.addEventListener('focus', () => {
            inputCard.classList.add('focused');
            triggerPulse(document.getElementById('usernameGroup'));
        });
        usernameInput.addEventListener('blur', () => inputCard.classList.remove('focused'));

        passwordInput.addEventListener('focus', () => {
            inputCard.classList.add('focused');
            triggerPulse(document.getElementById('passwordGroup'));
        });
        passwordInput.addEventListener('blur', () => inputCard.classList.remove('focused'));

        // Blue button only when username has text and trigger pulse on first char
        function updateButtonState() {
            if (usernameInput.value.trim()) {
                submitBtn.classList.add('active');
            } else {
                submitBtn.classList.remove('active');
            }
        }
        usernameInput.addEventListener('input', () => {
            updateButtonState();
            if (usernameInput.value.length === 1) {
                triggerPulse(document.getElementById('usernameGroup'));
            }
        });
        passwordInput.addEventListener('input', () => {
            if (passwordInput.value.length === 1) {
                triggerPulse(document.getElementById('passwordGroup'));
            }
        });

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
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const u = usernameInput.value.trim();
            const p = passwordInput.value;
            errMsg.textContent = '';

            /* Step 1: Reveal password field with animation */
            if (step === 1) {
                if (!u) return;

                // Mark username input as "top" (square bottom corners)
                usernameInput.classList.add('top-input');

                // Reveal divider + password with slide-down animation
                dividerWrap.classList.add('show');
                // Trigger reflow so transition fires
                pwdGroup.getBoundingClientRect();
                pwdGroup.classList.add('show');

                setTimeout(() => passwordInput.focus(), 350);
                step = 2;
                return;
            }

            /* Step 2: Attempt login */
            if (step === 2 && !p) return;

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
