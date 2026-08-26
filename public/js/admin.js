        const { startRegistration } = SimpleWebAuthnBrowser;

        /* ── Helpers ── */
        function escapeHTML(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        function set2faBadge(method, fido2Count = 0) {
            const badge = document.getElementById('twoFaBadge');
            const desc = document.getElementById('twoFaDesc');
            
            document.getElementById('twoFaDisabledUI').style.display = 'none';
            document.getElementById('twoFaMethodSelector').style.display = 'none';
            document.getElementById('totpEnabledUI').style.display = 'none';
            document.getElementById('fido2EnabledUI').style.display = 'none';
            document.getElementById('totpSetup').style.display = 'none';

            if (method === 'totp') {
                badge.className = 'badge badge-enabled';
                badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${t('badge_2fa_totp')}`;
                desc.textContent = t('section_2fa_desc_totp');
                document.getElementById('totpEnabledUI').style.display = 'flex';
            } else if (method === 'fido2') {
                badge.className = 'badge badge-enabled';
                badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>${t('badge_2fa_fido2')}`;
                desc.textContent = t('section_2fa_desc_fido2');
                document.getElementById('fido2EnabledUI').style.display = 'block';
                document.getElementById('fido2AddBtnRow').style.display = 'none';
                document.getElementById('enableFido2Btn').style.display = 'none';
                document.getElementById('disableFido2Btn').style.display = 'block';
            } else if (!method && fido2Count > 0) {
                // Downgraded FIDO2 state
                badge.className = 'badge badge-error';
                badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${t('badge_downgraded')}`;
                desc.textContent = t('section_fido2_downgraded_desc');
                document.getElementById('fido2EnabledUI').style.display = 'block';
                document.getElementById('fido2AddBtnRow').style.display = 'flex';
                document.getElementById('enableFido2Btn').style.display = 'block';
                document.getElementById('disableFido2Btn').style.display = 'none';
            } else {
                badge.className = 'badge badge-disabled';
                badge.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>${t('badge_disabled')}`;
                desc.textContent = t('section_2fa_desc');
                document.getElementById('twoFaDisabledUI').style.display = 'flex';
            }
        }

        function setPasskeyBadge(count) {
            const badge = document.getElementById('passkeyBadge');
            badge.textContent = count > 0 ? t('badge_pk_count_full', count) : t('badge_none');
            badge.className = count > 0 ? 'badge badge-count' : 'badge badge-disabled';
        }

        /* ── Passkey list ── */
        function fmtDate(iso) {
            if (!iso) return '';
            const d = new Date(iso);
            return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
        }

        function renderPasskeys(keys) {
            const list = document.getElementById('passkeyList');
            const badge = document.getElementById('passkeyBadge');
            if (!keys || keys.length === 0) {
                list.innerHTML = '';
                badge.textContent = t('badge_none');
                badge.className = 'badge badge-disabled';
                return;
            }
            badge.textContent = t('badge_pk_count', keys.length);
            badge.className = 'badge badge-count';
            list.innerHTML = keys.map(k => `
                <div class="passkey-item" id="pk-${k.id}">
                    <div class="passkey-icon">
                        <svg viewBox="0 0 825 825" width="22" height="22" preserveAspectRatio="xMidYMid meet">
                            <g transform="translate(0,825) scale(0.1,-0.1)" fill="currentColor" stroke="none">
                                <path d="M3396 7389 c-509 -44 -957 -406 -1146 -927 -72 -196 -100 -364 -100 -587 0 -474 192 -934 521 -1250 142 -137 255 -215 410 -282 89 -38 104 -43 244 -75 260 -59 579 6 817 166 29 20 56 36 60 36 15 0 308 279 308 293 0 2 25 41 56 87 69 104 175 319 209 425 37 119 74 287 86 400 16 139 6 384 -21 518 -36 186 -115 393 -202 532 -101 159 -256 334 -370 415 -27 18 -48 38 -48 43 0 6 -2 8 -6 5 -3 -3 -42 15 -87 41 -148 85 -328 144 -472 156 -140 11 -172 12 -259 4z"/>
                                <path d="M6305 4921 c-211 -50 -378 -153 -542 -334 -139 -152 -235 -331 -278 -517 -23 -99 -31 -302 -16 -413 35 -263 164 -517 351 -690 69 -64 181 -145 233 -168 l27 -12 0 -837 0 -836 110 -110 c61 -61 110 -108 110 -106 0 2 12 -6 27 -18 25 -19 38 -21 214 -20 l187 2 88 91 c122 126 207 218 287 309 54 63 67 84 67 111 0 41 -12 58 -185 246 -77 84 -141 156 -143 160 -2 7 179 210 340 379 78 82 79 84 77 130 -3 46 -6 50 -169 215 -91 93 -169 175 -173 183 -13 24 -57 64 -70 65 -13 0 27 18 52 22 74 13 257 134 358 236 197 200 298 440 310 737 12 308 -60 537 -248 785 -137 181 -346 322 -559 379 -120 32 -342 37 -455 11z m336 -578 c65 -29 111 -73 145 -140 25 -50 29 -69 29 -138 -1 -110 -16 -154 -76 -219 -68 -75 -137 -108 -227 -108 -71 -1 -142 16 -142 33 0 6 -4 8 -9 5 -5 -3 -29 10 -55 29 -47 37 -90 99 -107 157 -14 50 -13 148 4 196 18 52 58 112 74 112 6 0 15 5 19 12 5 7 3 8 -6 3 -9 -5 -11 -4 -6 3 4 7 13 12 21 12 7 0 16 7 19 16 3 8 10 13 15 10 5 -4 11 -1 13 4 14 42 205 51 289 13z"/>
                                <path d="M3210 3630 c-36 -5 -87 -11 -115 -14 -27 -2 -61 -6 -75 -9 -14 -4 -84 -18 -156 -32 -135 -26 -321 -76 -459 -122 -44 -15 -82 -28 -85 -28 -5 -2 -13 -5 -120 -50 -222 -94 -519 -273 -700 -424 -93 -77 -251 -234 -325 -321 -303 -361 -495 -809 -495 -1154 0 -185 46 -302 157 -406 35 -33 83 -70 106 -81 23 -12 44 -24 47 -28 3 -3 12 -8 20 -10 8 -2 44 -13 80 -25 l65 -21 2262 -3 c2154 -2 2262 -1 2265 15 3 10 -1 30 -9 45 -7 15 -15 35 -16 45 -2 10 -10 32 -18 48 -11 25 -14 159 -17 737 l-3 706 -89 81 c-83 76 -200 211 -183 211 5 0 3 4 -3 8 -40 27 -139 225 -165 330 -15 60 -17 62 -179 142 -58 29 -108 58 -112 64 -4 6 -8 8 -8 4 0 -3 -42 12 -92 34 -268 116 -561 199 -863 244 -128 18 -612 28 -715 14z"/>
                            </g>
                        </svg>
                    </div>
                    <div class="passkey-info">
                        <span class="passkey-name" id="pk-name-${k.id}">${escapeHTML(k.name || t('default_pk_name'))}</span>
                        <span class="passkey-date">${fmtDate(k.created_at)}</span>
                    </div>
                    <div class="passkey-actions">
                        <button class="pk-btn pk-rename" data-action="rename" data-id="${k.id}" title="重命名" aria-label="重命名">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="pk-btn pk-delete" data-action="delete" data-id="${k.id}" title="删除" aria-label="删除">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                        </button>
                    </div>
                </div>`).join('');
        }

        document.getElementById('passkeyList').addEventListener('click', (e) => {
            const btn = e.target.closest('.pk-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'rename') renamePasskey(id);
            if (action === 'delete') deletePasskey(id);
        });

        async function loadStatus() {
            try {
                const res = await fetch('/api/status');
                if (!res.ok) throw new Error();
                const data = await res.json();
                
                if (data.email) {
                    document.getElementById('newEmail').value = data.email;
                }
                set2faBadge(data.twoFaMethod, data.fido2Count || 0);
                renderPasskeys(data.passkeys);
                if (typeof renderFido2Keys === 'function') {
                    renderFido2Keys(data.fido2Keys || [], data.twoFaMethod);
                }
                // Show recovery code card only when 2FA is enabled
                updateRcCard(!!data.twoFaMethod, data.recoveryCodesRemaining);
            } catch (err) {
                console.error("loadStatus failed:", err);
                renderPasskeys([]);
                set2faBadge(null);
            }
        }
        loadStatus();

        function updateRcCard(hasTOTP, remaining) {
            document.getElementById('rcCard').style.display = hasTOTP ? '' : 'none';
            const badge = document.getElementById('rcBadge');
            if (!hasTOTP) return;
            if (remaining === 0) {
                badge.textContent = t('badge_not_gen');
                badge.className = 'badge badge-disabled';
            } else {
                badge.textContent = t('badge_rc_remaining', remaining);
                badge.className = remaining <= 2 ? 'badge badge-warn' : 'badge badge-count';
            }
        }

        async function deletePasskey(id) {
            if (!confirm(t('alert_delete_pk'))) return;
            const res = await fetch(`/api/passkeys/${id}`, { method: 'DELETE' });
            if ((await res.json()).success) {
                document.getElementById(`pk-${id}`)?.remove();
                // refresh badge
                const remaining = document.querySelectorAll('[id^="pk-"]').length;
                const badge = document.getElementById('passkeyBadge');
                if (remaining === 0) {
                    badge.textContent = t('badge_none'); badge.className = 'badge badge-disabled';
                } else {
                    badge.textContent = t('badge_pk_count', remaining);
                }
            }
        }

        async function renamePasskey(id) {
            const current = document.getElementById(`pk-name-${id}`)?.textContent || t('default_pk_name');
            const newName = prompt(t('prompt_rename_pk'), current);
            if (!newName || newName.trim() === current) return;
            const res = await fetch(`/api/passkeys/${id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: newName.trim() })
            });
            if ((await res.json()).success) {
                const el = document.getElementById(`pk-name-${id}`);
                if (el) el.textContent = newName.trim(); // textContent is safe
            }
        }

        /* ── Passkey registration ── */
        // Step 1: Show the inline naming panel (avoids focus-stealing prompt())
        document.getElementById('regPasskeyBtn').addEventListener('click', () => {
            document.getElementById('passkeyNameInput').value = '';
            document.getElementById('passkeyMsg').textContent = '';
            document.getElementById('passkeyMsg').className = 'msg';
            document.getElementById('passkeyNamePanel').style.display = 'block';
            document.getElementById('regPasskeyBtn').style.display = 'none';
            document.getElementById('passkeyNameInput').focus();
        });

        document.getElementById('cancelAddPasskeyBtn').addEventListener('click', () => {
            document.getElementById('passkeyNamePanel').style.display = 'none';
            document.getElementById('regPasskeyBtn').style.display = '';
        });

        // Step 2: User clicks confirm — document is still focused, WebAuthn works fine
        document.getElementById('confirmAddPasskeyBtn').addEventListener('click', async () => {
            const msg = document.getElementById('passkeyMsg');
            const passkeyName = document.getElementById('passkeyNameInput').value.trim() || t('default_pk_name');

            document.getElementById('passkeyNamePanel').style.display = 'none';
            document.getElementById('regPasskeyBtn').style.display = '';

            msg.textContent = t('msg_preparing');
            msg.className = 'msg';
            try {
                const options = await (await fetch('/api/webauthn/register-options')).json();
                const attResp = await startRegistration(options);
                // Attach chosen name so server can save it
                attResp._passkeyName = passkeyName;
                const result = await (await fetch('/api/webauthn/register-verify', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(attResp)
                })).json();

                if (result.verified) {
                    msg.textContent = t('msg_pk_added', passkeyName);
                    msg.className = 'msg msg-ok';
                    loadStatus();
                } else {
                    throw new Error('Verification failed');
                }
            } catch (e) {
                msg.textContent = 'Error: ' + (e.message || t('msg_cancel'));
                msg.className = 'msg msg-err';
            }
        });

        // Allow pressing Enter in the name input to confirm
        document.getElementById('passkeyNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('confirmAddPasskeyBtn').click();
        });

        /* ── 2FA General Setup ── */
        document.getElementById('setup2faBtn').addEventListener('click', () => {
            document.getElementById('twoFaDisabledUI').style.display = 'none';
            document.getElementById('twoFaMethodSelector').style.display = 'block';
        });

        document.getElementById('cancelMethodSelectorBtn').addEventListener('click', () => {
            document.getElementById('twoFaMethodSelector').style.display = 'none';
            loadStatus();
        });

        document.getElementById('chooseTotpBtn').addEventListener('click', () => {
            document.getElementById('twoFaMethodSelector').style.display = 'none';
            openTotpSetup();
        });

        document.getElementById('chooseFido2Btn').addEventListener('click', () => {
            document.getElementById('twoFaMethodSelector').style.display = 'none';
            document.getElementById('fido2EnabledUI').style.display = 'block';
            document.getElementById('fido2AddBtnRow').style.display = 'flex';
            document.getElementById('enableFido2Btn').style.display = 'block';
            document.getElementById('disableFido2Btn').style.display = 'none';
        });

        /* ── TOTP Setup & Verify ── */
        let currentSecret = '';

        async function openTotpSetup() {
            const res  = await fetch('/api/totp/generate');
            const data = await res.json();
            currentSecret = data.secret;
            document.getElementById('qrCode').src = data.qr;
            document.getElementById('secretKey').textContent = data.secret;
            document.getElementById('totpCode').value = '';
            document.getElementById('totpMsg').textContent = '';
            document.getElementById('totpMsg').className = 'msg';
            document.getElementById('totpSetup').style.display = 'block';
            document.getElementById('twoFaDisabledUI').style.display = 'none';
            document.getElementById('totpEnabledUI').style.display  = 'none';
        }

        document.getElementById('reset2faBtn').addEventListener('click', () => {
            document.getElementById('totpEnabledUI').style.display = 'none';
            document.getElementById('twoFaMethodSelector').style.display = 'block';
        });

        document.getElementById('verify2faBtn').addEventListener('click', async () => {
            const code = document.getElementById('totpCode').value.replace(/\s/g, '');
            const msg  = document.getElementById('totpMsg');
            if (code.length !== 6) {
                msg.textContent = t('msg_enter_6_digits');
                msg.className = 'msg msg-err';
                return;
            }
            const data = await (await fetch('/api/totp/verify', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ token: code, secret: currentSecret })
            })).json();

            if (data.success) {
                msg.textContent = t('msg_2fa_enabled');
                msg.className = 'msg msg-ok';
                setTimeout(() => {
                    document.getElementById('totpSetup').style.display = 'none';
                    set2faBadge('totp');
                    loadStatus();
                }, 1200);
            } else {
                msg.textContent = data.message || t('msg_2fa_wrong');
                msg.className = 'msg msg-err';
            }
        });

        /* ── Disable 2FA (Both TOTP and FIDO2) ── */
        async function disable2faCommon() {
            if (!confirm(t('alert_disable_2fa'))) return;

            const currentPassword = prompt('请输入当前密码以确认操作：');
            if (currentPassword === null) return; // user cancelled
            
            // Note: If TOTP is enabled, server requires totpToken to disable. 
            // If FIDO2 is enabled, server only requires currentPassword.
            // We pass totpToken optionally.
            let totpToken = '';
            const isTotp = document.getElementById('totpEnabledUI').style.display === 'flex';
            if (isTotp) {
                totpToken = prompt('请输入 Authenticator 中的当前 6 位验证码：');
                if (totpToken === null) return; // user cancelled
            }

            const data = await (await fetch('/api/totp/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, totpToken })
            })).json();

            if (data.success) {
                set2faBadge(null);
                loadStatus();
            } else {
                alert(data.message || '禁用失败，请检查密码和验证码是否正确');
            }
        }

        document.getElementById('disable2faBtn').addEventListener('click', disable2faCommon);
        document.getElementById('disableFido2Btn').addEventListener('click', disable2faCommon);

        /* ── FIDO2 Key Management ── */
        function renderFido2Keys(keys, method) {
            const list = document.getElementById('fido2KeyList');
            if (!keys || keys.length === 0) {
                list.innerHTML = '';
                return;
            }
            list.innerHTML = keys.map(k => {
                const transports = k.transports || [];
                const badges = transports.map(tr => {
                    if (tr === 'usb') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_usb')}</span>`;
                    if (tr === 'nfc') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_nfc')}</span>`;
                    if (tr === 'ble') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_ble')}</span>`;
                    if (tr === 'internal') return `<span class="badge" style="background:#e5e5ea;color:#1c1c1e;margin-left:4px;">${t('transport_internal')}</span>`;
                    return '';
                }).join('');

                return `
                <div class="passkey-item" id="fido2-${k.id}">
                    <div class="passkey-icon">
                        <img src="/FIDO.svg" style="width:22px;height:22px;object-fit:contain;" class="icon-adaptive">
                    </div>
                    <div class="passkey-info">
                        <span class="passkey-name" id="fido2-name-${k.id}">${escapeHTML(k.name || t('default_fido2_key_name'))}${badges}</span>
                        <span class="passkey-date">${fmtDate(k.created_at)}</span>
                    </div>
                    <div class="passkey-actions">
                        <button class="pk-btn fido2-rename" data-action="rename" data-id="${k.id}" title="重命名">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="pk-btn fido2-delete" data-action="delete" data-id="${k.id}" title="删除">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
            }).join('');
        }

        document.getElementById('fido2KeyList').addEventListener('click', (e) => {
            const btn = e.target.closest('.pk-btn');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const id = btn.getAttribute('data-id');
            if (action === 'rename') renameFido2Key(id);
            if (action === 'delete') deleteFido2Key(id);
        });

        async function renameFido2Key(id) {
            const currentEl = document.getElementById(`fido2-name-${id}`);
            const current = currentEl ? currentEl.childNodes[0].nodeValue.trim() : t('default_fido2_key_name');
            const newName = prompt(t('prompt_rename_pk'), current);
            if (!newName || newName.trim() === current) return;
            const res = await fetch(`/api/fido2/keys/${id}`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name: newName.trim() })
            });
            if ((await res.json()).success) {
                if (currentEl) currentEl.childNodes[0].nodeValue = newName.trim();
            }
        }

        async function deleteFido2Key(id) {
            if (!confirm(t('alert_delete_fido2_key'))) return;
            const res = await fetch(`/api/fido2/keys/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                document.getElementById(`fido2-${id}`)?.remove();
                if (data.autoDisabled) {
                    alert(t('fido2_min_warning'));
                    loadStatus();
                }
            }
        }

        document.getElementById('addFido2KeyBtn').addEventListener('click', () => {
            document.getElementById('fido2KeyNameInput').value = '';
            document.getElementById('fido2Msg').textContent = '';
            document.getElementById('fido2Msg').className = 'msg';
            document.getElementById('fido2NamePanel').style.display = 'block';
            document.getElementById('fido2AddBtnRow').style.display = 'none';
            document.getElementById('fido2KeyNameInput').focus();
        });

        document.getElementById('cancelAddFido2KeyBtn').addEventListener('click', () => {
            document.getElementById('fido2NamePanel').style.display = 'none';
            document.getElementById('fido2AddBtnRow').style.display = 'flex';
        });

        document.getElementById('confirmAddFido2KeyBtn').addEventListener('click', async () => {
            const msg = document.getElementById('fido2Msg');
            const keyName = document.getElementById('fido2KeyNameInput').value.trim() || t('default_fido2_key_name');

            document.getElementById('fido2NamePanel').style.display = 'none';
            document.getElementById('fido2AddBtnRow').style.display = 'flex';

            msg.textContent = t('msg_preparing');
            msg.className = 'msg';
            try {
                const optionsRes = await fetch('/api/fido2/register-options');
                if (!optionsRes.ok) {
                    const err = await optionsRes.json();
                    throw new Error(err.error || 'Failed to get options');
                }
                const options = await optionsRes.json();
                
                const attResp = await startRegistration(options);
                attResp._keyName = keyName;
                
                const verifyRes = await fetch('/api/fido2/register-verify', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(attResp)
                });
                const result = await verifyRes.json();

                if (result.verified) {
                    msg.textContent = t('msg_fido2_key_added', keyName);
                    msg.className = 'msg msg-ok';
                    loadStatus();
                } else {
                    throw new Error(result.error || 'Verification failed');
                }
            } catch (e) {
                msg.textContent = 'Error: ' + (e.message || t('msg_cancel'));
                msg.className = 'msg msg-err';
            }
        });

        document.getElementById('fido2KeyNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('confirmAddFido2KeyBtn').click();
        });

        document.getElementById('enableFido2Btn').addEventListener('click', async () => {
            const msg = document.getElementById('fido2Msg');
            msg.textContent = '';
            
            const res = await fetch('/api/2fa/enable', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ method: 'fido2' })
            });
            const data = await res.json();
            if (data.success) {
                msg.textContent = t('msg_2fa_enabled');
                msg.className = 'msg msg-ok';
                setTimeout(() => {
                    set2faBadge('fido2');
                    loadStatus();
                    msg.textContent = '';
                }, 1200);
            } else {
                msg.textContent = data.message || 'Error enabling FIDO2';
                msg.className = 'msg msg-err';
            }
        });

        /* ── Copy secret on click ── */
        document.getElementById('secretKey').addEventListener('click', function() {
            navigator.clipboard.writeText(this.textContent).then(() => {
                this.style.color = '#34c759';
                setTimeout(() => this.style.color = '', 1000);
            });
        });

        /* ── Change username ── */
        document.getElementById('showUsernameFormBtn').addEventListener('click', () => {
            document.getElementById('usernameFormPanel').style.display = 'block';
            document.getElementById('showUsernameFormBtn').style.display = 'none';
        });

        document.getElementById('cancelUsernameBtn').addEventListener('click', () => {
            document.getElementById('usernameFormPanel').style.display = 'none';
            document.getElementById('showUsernameFormBtn').style.display = '';
            document.getElementById('newUsername').value = '';
            document.getElementById('usernameConfirmPwd').value = '';
            document.getElementById('usernameMsg').textContent = '';
        });

        document.getElementById('changeUsernameBtn').addEventListener('click', async () => {
            const msg = document.getElementById('usernameMsg');
            const newUsername = document.getElementById('newUsername').value.trim();
            const currentPassword = document.getElementById('usernameConfirmPwd').value;
            msg.textContent = '';
            if (!newUsername) { msg.textContent = t('msg_enter_new_username'); msg.className = 'msg msg-err'; return; }
            if (!currentPassword) { msg.textContent = t('msg_enter_current_pwd'); msg.className = 'msg msg-err'; return; }

            try {
                const res = await fetch('/api/change-username', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    // JSON.stringify handles all special characters in passwords automatically
                    body: JSON.stringify({ newUsername, currentPassword })
                });
                const data = await res.json();
                if (data.success) {
                    msg.textContent = t('msg_username_changed', newUsername);
                    msg.className = 'msg msg-ok';
                    document.getElementById('newUsername').value = '';
                    document.getElementById('usernameConfirmPwd').value = '';
                } else {
                    msg.textContent = data.message || t('msg_change_failed');
                    msg.className = 'msg msg-err';
                }
            } catch {
                msg.textContent = t('msg_network_error');
                msg.className = 'msg msg-err';
            }
        });

        /* ── Change email ── */
        document.getElementById('showEmailFormBtn').addEventListener('click', () => {
            document.getElementById('emailFormPanel').style.display = 'block';
            document.getElementById('showEmailFormBtn').style.display = 'none';
        });

        document.getElementById('cancelEmailBtn').addEventListener('click', () => {
            document.getElementById('emailFormPanel').style.display = 'none';
            document.getElementById('showEmailFormBtn').style.display = '';
            document.getElementById('emailConfirmPwd').value = '';
            document.getElementById('emailMsg').textContent = '';
        });

        document.getElementById('changeEmailBtn').addEventListener('click', async () => {
            const msg = document.getElementById('emailMsg');
            const newEmail = document.getElementById('newEmail').value.trim();
            const currentPassword = document.getElementById('emailConfirmPwd').value;
            msg.textContent = '';
            if (!newEmail) { msg.textContent = t('msg_enter_email'); msg.className = 'msg msg-err'; return; }
            if (!currentPassword) { msg.textContent = t('msg_enter_current_pwd'); msg.className = 'msg msg-err'; return; }

            // Basic regex format validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                msg.textContent = t('msg_invalid_email'); 
                msg.className = 'msg msg-err'; 
                return;
            }

            try {
                const res = await fetch('/api/change-email', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ newEmail, currentPassword })
                });
                const data = await res.json();
                if (data.success) {
                    msg.textContent = t('msg_email_changed');
                    msg.className = 'msg msg-ok';
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    msg.textContent = data.message || t('msg_change_failed');
                    msg.className = 'msg msg-err';
                }
            } catch {
                msg.textContent = t('msg_network_error');
                msg.className = 'msg msg-err';
            }
        });

        /* ── Change password ── */
        document.getElementById('showPasswordFormBtn').addEventListener('click', () => {
            document.getElementById('passwordFormPanel').style.display = 'block';
            document.getElementById('showPasswordFormBtn').style.display = 'none';
        });

        document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
            document.getElementById('passwordFormPanel').style.display = 'none';
            document.getElementById('showPasswordFormBtn').style.display = '';
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            document.getElementById('passwordMsg').textContent = '';
        });

        document.getElementById('changePasswordBtn').addEventListener('click', async () => {
            const msg = document.getElementById('passwordMsg');
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            msg.textContent = '';

            if (!currentPassword) { msg.textContent = t('msg_enter_current_pwd'); msg.className = 'msg msg-err'; return; }
            if (!newPassword)     { msg.textContent = t('msg_enter_new_pwd'); msg.className = 'msg msg-err'; return; }
            if (newPassword !== confirmPassword) { msg.textContent = t('msg_pwd_mismatch'); msg.className = 'msg msg-err'; return; }
            if (newPassword === currentPassword) { msg.textContent = t('msg_pwd_same'); msg.className = 'msg msg-err'; return; }

            try {
                const res = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    // Raw string via JSON — &, #, *, @, \, " etc. all safe
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const data = await res.json();
                if (data.success) {
                    msg.textContent = t('msg_pwd_changed');
                    msg.className = 'msg msg-ok';
                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                } else {
                    msg.textContent = data.message || t('msg_change_failed');
                    msg.className = 'msg msg-err';
                }
            } catch {
                msg.textContent = t('msg_network_error');
                msg.className = 'msg msg-err';
            }
        });

        /* ── Recovery codes ── */
        document.getElementById('genRcBtn').addEventListener('click', async () => {
            const hasExisting = document.getElementById('rcBadge').textContent !== t('badge_not_gen');
            if (hasExisting) {
                if (!confirm(t('alert_regen_rc'))) return;
            }
            const res  = await fetch('/api/recovery-codes/generate', { method: 'POST' });
            const data = await res.json();
            if (!data.success) return;

            // Display codes
            const listEl = document.getElementById('rcList');
            listEl.innerHTML = data.codes.map(c => `<div>${escapeHTML(c)}</div>`).join('');
            document.getElementById('rcPanel').style.display = 'block';
            document.getElementById('rcMsg').textContent = '';
            updateRcCard(true, data.codes.length);
        });

        document.getElementById('copyRcBtn').addEventListener('click', () => {
            const codes = [...document.querySelectorAll('#rcList div')].map(d => d.textContent).join('\n');
            navigator.clipboard.writeText(codes).then(() => {
                const msg = document.getElementById('rcMsg');
                msg.textContent = t('msg_copied');
                msg.className = 'msg msg-ok';
            });
        });

        /* ── Logout ── */
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/';
        });

        document.getElementById('logoutAllBtn').addEventListener('click', async () => {
            if (confirm(t('msg_logout_all_confirm') || '确定要在所有设备上退出登录吗？此操作会使所有当前已登录的会话立即失效。')) {
                await fetch('/api/logout-all', { method: 'POST' });
                window.location.href = '/';
            }
        });




// --- OIDC & Elevation Logic ---

let pendingElevationCallback = null;

function requestElevation(callback) {
    pendingElevationCallback = callback;
    document.getElementById('elevationTotpForm').style.display = 'none';
    document.getElementById('elevationCancelRow').style.display = 'block';
    const methodsDiv = document.getElementById('elevationMethods');
    methodsDiv.innerHTML = '';
    
    // Check user's available 2FA methods from window.currentUserStatus (fetched by loadStatus)
    const status = window.currentUserStatus || {};
    let hasMethods = false;
    
    if (status.passkeyCount > 0) {
        hasMethods = true;
        const pkBtn = document.createElement('button');
        pkBtn.className = 'modal-btn modal-btn-secondary';
        pkBtn.textContent = '使用通行密钥 (Passkey)';
        pkBtn.onclick = elevateWithPasskey;
        methodsDiv.appendChild(pkBtn);
    }
    
    if (status.hasTOTP) {
        hasMethods = true;
        const totpBtn = document.createElement('button');
        totpBtn.className = 'modal-btn modal-btn-secondary';
        totpBtn.textContent = '使用身份验证器 (TOTP) 或恢复码';
        totpBtn.onclick = () => {
            methodsDiv.style.display = 'none';
            document.getElementById('elevationCancelRow').style.display = 'none';
            document.getElementById('elevationTotpForm').style.display = 'block';
            document.getElementById('elevationTotpInput').value = '';
            document.getElementById('elevationTotpInput').focus();
        };
        methodsDiv.appendChild(totpBtn);
    }
    
    // Note: FIDO2 hardware keys can use the Passkey flow (WebAuthn). 
    // We also support status.fido2Count if they are separate, but WebAuthn handles both.
    
    if (!hasMethods) {
        methodsDiv.innerHTML = '<div style="color:#ff3b30;font-size:14px;">您需要先在上方配置 2FA 或通行密钥才能执行此操作。</div>';
    } else {
        methodsDiv.style.display = 'flex';
    }
    
    document.getElementById('elevationModal').style.display = 'flex';
}

function cancelElevation() {
    document.getElementById('elevationModal').style.display = 'none';
    pendingElevationCallback = null;
}

async function elevateWithPasskey() {
    try {
        const resp = await fetch('/api/webauthn/login-options');
        const options = await resp.json();
        if (options.error) return alert(options.error);
        
        const assertion = await SimpleWebAuthnBrowser.startAuthentication(options);
        const verifyResp = await fetch('/api/webauthn/login-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assertion)
        });
        const verifyData = await verifyResp.json();
        
        if (verifyData.verified) {
            document.getElementById('elevationModal').style.display = 'none';
            if (pendingElevationCallback) pendingElevationCallback();
        } else {
            alert('验证失败');
        }
    } catch (e) {
        console.error(e);
        alert('验证取消或出错');
    }
}

document.getElementById('confirmElevationTotpBtn')?.addEventListener('click', async () => {
    const totp = document.getElementById('elevationTotpInput').value.trim();
    if (!totp) return;
    
    const res = await fetch('/api/auth/elevate/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totp })
    });
    
    const data = await res.json();
    if (data.success) {
        document.getElementById('elevationModal').style.display = 'none';
        if (pendingElevationCallback) pendingElevationCallback();
    } else {
        alert(data.message || '验证失败');
    }
});

async function loadOidcClients() {
    const res = await fetch('/api/oidc/clients');
    const data = await res.json();
    const list = document.getElementById('oidcClientList');
    if (!list) return;
    list.innerHTML = '';
    
    if (!data || data.length === 0) {
        list.innerHTML = '<div style="color: #86868b; font-size: 14px; padding: 10px 0;">暂无接入的应用</div>';
        return;
    }
    
    data.forEach(client => {
        const item = document.createElement('div');
        item.className = 'key-item';
        
        const info = document.createElement('div');
        info.className = 'key-info';
        
        const name = document.createElement('div');
        name.className = 'key-name';
        name.textContent = client.client_name;
        
        const meta = document.createElement('div');
        meta.className = 'key-meta';
        meta.textContent = client.client_id;
        
        info.appendChild(name);
        info.appendChild(meta);
        
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '删除';
        delBtn.onclick = () => {
            if(confirm('确定删除该第三方应用？删除后它将无法通过本系统登录。')) {
                performOidcAction(async () => {
                    const r = await fetch('/api/oidc/clients/' + client.id, { method: 'DELETE' });
                    if (r.status === 403) return r;
                    loadOidcClients();
                    return r;
                });
            }
        };
        
        item.appendChild(info);
        item.appendChild(delBtn);
        list.appendChild(item);
    });
}

// Wrapper for actions that require Step-Up Auth
async function performOidcAction(actionFn) {
    // We don't know for sure if the current cookie has auth_method yet, so we just try it.
    // Wait, the API might not support a "dry run". But for DELETE we can't dry run.
    // Actually, we can check window.currentUserStatus to see if we need elevation? 
    // No, currentUserStatus doesn't have auth_method.
    // We can just try the action, if 403, elevate and retry!
    
    // Let's modify actionFn to be aware of 403.
    const res = await actionFn();
    if (res && res.status === 403) {
        requestElevation(async () => {
            // Elevated successfully! Retry!
            await actionFn();
        });
    }
}

document.getElementById('addOidcBtn')?.addEventListener('click', () => {
    // Before showing the modal, check if they can even submit it by checking status?
    // Let's just show the add modal. If they submit and get 403, we elevate then.
    document.getElementById('oidcAppName').value = '';
    document.getElementById('oidcRedirectUris').value = '';
    document.getElementById('oidcModal').style.display = 'flex';
});

document.getElementById('confirmAddOidcBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('oidcAppName').value.trim();
    const uris = document.getElementById('oidcRedirectUris').value.split('\n').map(u => u.trim()).filter(u => u);
    if (!name || uris.length === 0) return alert('请填写完整的应用名称和至少一个重定向URI');
    
    const doAdd = async () => {
        const res = await fetch('/api/oidc/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_name: name, redirect_uris: uris })
        });
        if (res.status === 403) return res; // Return response so performOidcAction can catch it
        
        const data = await res.json();
        if (data.success) {
            document.getElementById('oidcModal').style.display = 'none';
            document.getElementById('newOidcClientId').textContent = data.client_id;
            document.getElementById('newOidcClientSecret').textContent = data.client_secret;
            document.getElementById('oidcSecretModal').style.display = 'flex';
            loadOidcClients();
        } else {
            alert(data.message || '添加失败');
        }
        return res;
    };
    
    performOidcAction(doAdd);
});

// Call it on load
setTimeout(() => { if (document.getElementById('oidcClientList')) loadOidcClients(); }, 500);

// We need to inject window.currentUserStatus inside loadStatus()
const originalLoadStatus = loadStatus;
loadStatus = async function() {
    await originalLoadStatus();
    // Fetch it again to store in window (since original doesn't expose it)
    try {
        const res = await fetch('/api/status');
        window.currentUserStatus = await res.json();
    } catch(e) {}
};


document.getElementById('cancelOidcBtn')?.addEventListener('click', () => {
    document.getElementById('oidcModal').style.display = 'none';
});
document.getElementById('finishOidcSecretBtn')?.addEventListener('click', () => {
    document.getElementById('oidcSecretModal').style.display = 'none';
});
document.getElementById('cancelElevationBtn1')?.addEventListener('click', cancelElevation);
document.getElementById('cancelElevationBtn2')?.addEventListener('click', cancelElevation);

