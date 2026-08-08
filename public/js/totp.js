        const storedToken = sessionStorage.getItem('tempToken');

        if (!storedToken) {
            window.location.href = '/';
        }

        const digits    = [...document.querySelectorAll('.totp-digit')];
        const form      = document.getElementById('totpForm');
        const errMsg    = document.getElementById('totpError');
        const verifyBtn = document.getElementById('verifyBtn');
        let usingRc     = false;

        /* ── Recovery code toggle ── */
        document.getElementById('toggleRcLink').addEventListener('click', (e) => {
            e.preventDefault();
            usingRc = !usingRc;
            document.getElementById('totpBoxSection').style.display = usingRc ? 'none' : '';
            document.getElementById('rcSection').style.display      = usingRc ? '' : 'none';
            document.getElementById('totpSubtitle').textContent     = usingRc
                ? t('totp_subtitle_rc')
                : t('totp_subtitle_app');
            document.getElementById('toggleRcLink').textContent     = usingRc
                ? t('totp_link_code')
                : t('totp_link_rc');
            errMsg.textContent = '';
            if (usingRc) document.getElementById('rcInput').focus();
            else digits[0].focus();
        });

        // Focus first box
        digits[0].focus();

        // Update filled styling
        function updateFilled() {
            digits.forEach(d => {
                d.classList.toggle('filled', d.value !== '');
            });
            const allFilled = digits.every(d => d.value !== '');
            verifyBtn.classList.toggle('active', allFilled);
        }

        // Handle digit input
        digits.forEach((input, i) => {
            input.addEventListener('input', (e) => {
                // Allow only digits
                input.value = input.value.replace(/\D/g, '').slice(-1);
                updateFilled();

                if (input.value && i < digits.length - 1) {
                    digits[i + 1].focus();
                }

                // Auto-submit when all 6 filled
                const code = digits.map(d => d.value).join('');
                if (code.length === 6) {
                    setTimeout(() => form.requestSubmit(), 120);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace') {
                    if (input.value) {
                        input.value = '';
                        updateFilled();
                    } else if (i > 0) {
                        digits[i - 1].focus();
                        digits[i - 1].value = '';
                        updateFilled();
                    }
                } else if (e.key === 'ArrowLeft' && i > 0) {
                    digits[i - 1].focus();
                } else if (e.key === 'ArrowRight' && i < digits.length - 1) {
                    digits[i + 1].focus();
                }
            });

            // Handle paste
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasted = (e.clipboardData || window.clipboardData)
                    .getData('text')
                    .replace(/\D/g, '')
                    .slice(0, 6);
                pasted.split('').forEach((ch, j) => {
                    if (digits[j]) digits[j].value = ch;
                });
                updateFilled();
                const next = Math.min(pasted.length, digits.length - 1);
                digits[next].focus();

                if (pasted.length === 6) {
                    setTimeout(() => form.requestSubmit(), 120);
                }
            });
        });

        // Back button
        document.getElementById('backBtn').addEventListener('click', () => {
            sessionStorage.removeItem('tempToken');
            window.location.href = '/';
        });

        // Submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errMsg.textContent = '';

            let totp;
            if (usingRc) {
                totp = document.getElementById('rcInput').value.trim();
                if (!totp) return;
            } else {
                totp = digits.map(d => d.value).join('');
                if (totp.length < 6) return;
            }

            verifyBtn.textContent = t('msg_verifying');
            verifyBtn.disabled = true;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ tempToken: storedToken, totp })
                });

                const data = await res.json();

                if (data.success) {
                    sessionStorage.removeItem('tempToken');
                    if (data.usedRecoveryCode) sessionStorage.setItem('rcWarning', '1');
                    const rd = new URLSearchParams(window.location.search).get('rd');
                    let target = '/admin';
                    if (rd) {
                        try {
                            if (new URL(rd, window.location.origin).origin === window.location.origin) target = rd;
                        } catch(e) {}
                    }
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
