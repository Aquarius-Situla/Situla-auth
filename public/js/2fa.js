        const { startAuthentication } = window.SimpleWebAuthnBrowser || SimpleWebAuthnBrowser || {};

        /* ── Trusted-redirect resolution ── */
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
        getTrustedRoots();

        /* ── Session setup ── */
        const storedToken = sessionStorage.getItem('tempToken');
        const twoFaMethod = sessionStorage.getItem('twoFaMethod') || 'totp'; // 'totp' | 'fido2'

        if (!storedToken) {
            window.location.href = '/';
        }

        /* ── Mode routing ── */
        if (twoFaMethod === 'fido2') {
            document.getElementById('totpMode').style.display = 'none';
            document.getElementById('fido2Mode').style.display = '';
            initFido2Mode();
        } else {
            initTotpMode();
        }

        /* ════════════════════════════════════════
           TOTP MODE
        ════════════════════════════════════════ */
        function initTotpMode() {
            const digits    = [...document.querySelectorAll('.totp-digit')];
            const form      = document.getElementById('totpForm');
            const errMsg    = document.getElementById('totpError');
            const verifyBtn = document.getElementById('verifyBtn');
            let usingRc     = false;

            /* ── Recovery code toggle ── */
            document.getElementById('rcInput').addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });

            document.getElementById('toggleRcLink').addEventListener('click', (e) => {
                e.preventDefault();
                usingRc = !usingRc;
                document.getElementById('totpBoxSection').style.display = usingRc ? 'none' : '';
                document.getElementById('rcSection').style.display      = usingRc ? ''    : 'none';
                document.getElementById('totpSubtitle').setAttribute('data-i18n', usingRc ? 'totp_subtitle_rc' : 'totp_subtitle_app');
                document.getElementById('totpSubtitle').textContent = t(usingRc ? 'totp_subtitle_rc' : 'totp_subtitle_app');
                document.getElementById('toggleRcLink').setAttribute('data-i18n', usingRc ? 'totp_link_code' : 'totp_link_rc');
                document.getElementById('toggleRcLink').textContent = t(usingRc ? 'totp_link_code' : 'totp_link_rc');
                errMsg.textContent = '';
                if (usingRc) document.getElementById('rcInput').focus();
                else digits[0].focus();
            });

            /* ── 6-box digit input ── */
            digits.forEach((input, idx) => {
                input.addEventListener('input', (e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    e.target.value = val ? val[val.length - 1] : '';
                    e.target.classList.toggle('filled', !!e.target.value);
                    if (val && idx < digits.length - 1) digits[idx + 1].focus();
                    if (digits.every(d => d.value)) form.requestSubmit();
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !input.value && idx > 0) {
                        digits[idx - 1].value = '';
                        digits[idx - 1].classList.remove('filled');
                        digits[idx - 1].focus();
                    }
                    if (e.key === 'ArrowLeft' && idx > 0) digits[idx - 1].focus();
                    if (e.key === 'ArrowRight' && idx < digits.length - 1) digits[idx + 1].focus();
                });
                input.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
                    text.split('').slice(0, digits.length).forEach((ch, i) => {
                        if (digits[idx + i]) {
                            digits[idx + i].value = ch;
                            digits[idx + i].classList.add('filled');
                        }
                    });
                    const next = Math.min(idx + text.length, digits.length - 1);
                    digits[next].focus();
                    if (digits.every(d => d.value)) form.requestSubmit();
                });
            });

            digits[0].focus();

            /* ── Form submit ── */
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errMsg.textContent = '';
                verifyBtn.disabled = true;
                verifyBtn.textContent = t('msg_verifying');

                const totp = usingRc
                    ? document.getElementById('rcInput').value.trim()
                    : digits.map(d => d.value).join('');

                const body = usingRc
                    ? { tempToken: storedToken, totp }
                    : { tempToken: storedToken, totp };

                try {
                    const res = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                    const data = await res.json();

                    if (data.success) {
                        sessionStorage.removeItem('tempToken');
                        sessionStorage.removeItem('twoFaMethod');
                        if (data.usedRecoveryCode) sessionStorage.setItem('rcWarning', '1');
                        const rd = new URLSearchParams(window.location.search).get('rd');
                        const target = (await safeRedirectUrl(rd)) || '/admin';
                        window.location.href = target;
                    } else {
                        errMsg.textContent = data.message || t('msg_verify_failed');
                        if (!usingRc) {
                            digits.forEach(d => { d.value = ''; d.classList.remove('filled'); });
                            digits[0].focus();
                        }
                        verifyBtn.textContent = t('btn_continue');
                        verifyBtn.disabled = false;
                    }
                } catch (err) {
                    errMsg.textContent = t('msg_network_error');
                    verifyBtn.textContent = t('btn_continue');
                    verifyBtn.disabled = false;
                }
            });

            document.getElementById('backBtn').addEventListener('click', () => {
                sessionStorage.removeItem('tempToken');
                sessionStorage.removeItem('twoFaMethod');
                window.location.href = '/';
            });
        }

        /* ════════════════════════════════════════
           FIDO2 MODE
        ════════════════════════════════════════ */
        function initFido2Mode() {
            const errMsg         = document.getElementById('fido2Error');
            const spinner        = document.getElementById('fido2Spinner');
            const statusHint     = document.getElementById('fido2StatusHint');
            const subtitle       = document.getElementById('fido2Subtitle');
            const primaryBtn     = document.getElementById('fido2PrimaryBtn');
            const keySection     = document.getElementById('fido2KeySection');
            const rcSection      = document.getElementById('fido2RcSection');
            const rcInput        = document.getElementById('fido2RcInput');
            const toggleRcLink   = document.getElementById('toggleFido2RcLink');
            let usingRc          = false;

            // Detect mobile for NFC-aware hint
            const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
            const defaultSubtitleKey = isMobile ? 'fido2_subtitle_nfc' : 'fido2_subtitle_usb';
            if (subtitle) {
                subtitle.setAttribute('data-i18n', defaultSubtitleKey);
                subtitle.textContent = t(defaultSubtitleKey);
            }

            // Upper-case recovery code input
            if (rcInput) {
                rcInput.addEventListener('input', function() {
                    this.value = this.value.toUpperCase();
                });
                rcInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePrimaryAction();
                    }
                });
            }

            // Toggle recovery code vs key
            if (toggleRcLink) {
                toggleRcLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    usingRc = !usingRc;
                    if (keySection) keySection.style.display = usingRc ? 'none' : '';
                    if (rcSection) rcSection.style.display = usingRc ? '' : 'none';

                    if (subtitle) {
                        const subKey = usingRc ? 'totp_subtitle_rc' : defaultSubtitleKey;
                        subtitle.setAttribute('data-i18n', subKey);
                        subtitle.textContent = t(subKey);
                    }

                    const linkKey = usingRc ? 'fido2_link_key' : 'fido2_link_rc';
                    toggleRcLink.setAttribute('data-i18n', linkKey);
                    toggleRcLink.textContent = t(linkKey);

                    const btnKey = usingRc ? 'btn_continue' : 'fido2_btn_start';
                    primaryBtn.setAttribute('data-i18n', btnKey);
                    primaryBtn.textContent = t(btnKey);
                    primaryBtn.disabled = false;

                    errMsg.textContent = '';
                    if (usingRc && rcInput) {
                        rcInput.focus();
                    }
                });
            }

            document.getElementById('fido2BackBtn').addEventListener('click', () => {
                sessionStorage.removeItem('tempToken');
                sessionStorage.removeItem('twoFaMethod');
                window.location.href = '/';
            });

            primaryBtn.addEventListener('click', () => {
                handlePrimaryAction();
            });

            async function handlePrimaryAction() {
                if (usingRc) {
                    await submitRecoveryCode();
                } else {
                    await triggerFido2();
                }
            }

            async function submitRecoveryCode() {
                const totp = rcInput ? rcInput.value.trim() : '';
                if (!totp) {
                    if (rcInput) rcInput.focus();
                    return;
                }

                errMsg.textContent = '';
                primaryBtn.disabled = true;
                primaryBtn.textContent = t('msg_verifying');

                try {
                    const res = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tempToken: storedToken, totp })
                    });
                    const data = await res.json();

                    if (data.success) {
                        sessionStorage.removeItem('tempToken');
                        sessionStorage.removeItem('twoFaMethod');
                        if (data.usedRecoveryCode) sessionStorage.setItem('rcWarning', '1');
                        const rd = new URLSearchParams(window.location.search).get('rd');
                        const target = (await safeRedirectUrl(rd)) || '/admin';
                        window.location.href = target;
                    } else {
                        errMsg.textContent = data.message || t('msg_verify_failed');
                        primaryBtn.textContent = t('btn_continue');
                        primaryBtn.disabled = false;
                        if (rcInput) rcInput.focus();
                    }
                } catch (err) {
                    errMsg.textContent = t('msg_network_error');
                    primaryBtn.textContent = t('btn_continue');
                    primaryBtn.disabled = false;
                }
            }

            async function triggerFido2() {
                if (spinner) spinner.style.display = '';
                if (statusHint) statusHint.textContent = t('fido2_waiting');
                errMsg.textContent = '';
                primaryBtn.disabled = true;
                primaryBtn.textContent = t('msg_verifying');

                try {
                    // Step 1: Get challenge from server (passes tempToken)
                    const challengeRes = await fetch('/api/fido2/challenge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tempToken: storedToken })
                    });
                    if (!challengeRes.ok) {
                        const err = await challengeRes.json();
                        throw new Error(err.message || err.error || t('msg_network_error'));
                    }
                    const options = await challengeRes.json();

                    // Step 2: Prompt browser/OS for authenticator
                    const assertionResponse = await startAuthentication(options);

                    // Step 3: Verify with server
                    const verifyRes = await fetch('/api/fido2/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tempToken: storedToken, ...assertionResponse })
                    });
                    const verifyData = await verifyRes.json();

                    if (verifyData.verified) {
                        sessionStorage.removeItem('tempToken');
                        sessionStorage.removeItem('twoFaMethod');
                        if (spinner) spinner.style.display = 'none';
                        const rd = new URLSearchParams(window.location.search).get('rd');
                        const target = (await safeRedirectUrl(rd)) || '/admin';
                        window.location.href = target;
                    } else {
                        throw new Error(verifyData.error || verifyData.message || t('fido2_verify_failed'));
                    }
                } catch (err) {
                    console.error('[FIDO2 Auth Error]:', err);
                    if (spinner) spinner.style.display = 'none';
                    if (statusHint) statusHint.textContent = t('fido2_prompt');
                    if (err.name === 'NotAllowedError') {
                        errMsg.textContent = t('fido2_canceled');
                    } else {
                        errMsg.textContent = err.message || t('fido2_verify_failed');
                    }
                    primaryBtn.disabled = false;
                    primaryBtn.setAttribute('data-i18n', 'fido2_btn_retry');
                    primaryBtn.textContent = t('fido2_btn_retry');
                }
            }
        }
