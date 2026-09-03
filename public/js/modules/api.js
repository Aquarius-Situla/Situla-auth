/**
 * public/js/modules/api.js
 * API communication, fetch wrapper, and Sudo elevation orchestrator.
 */

import { t, setModalActionsLoading, closeAllModals } from './ui.js';

export async function fetchApi(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    try {
        const res = await fetch(url, { ...options, headers });
        let data = {};
        try {
            data = await res.json();
        } catch (e) {}

        if (!res.ok) {
            console.warn(`[Situla-Auth API] ${options.method || 'GET'} ${url} returned HTTP ${res.status}:`, data);
        }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error(`[Situla-Auth Network Error] ${options.method || 'GET'} ${url}:`, err);
        return { ok: false, status: 0, data: { error: 'msg_network_error', message: 'msg_network_error' } };
    }
}

export function enterSudoStep(modalId, actionFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const prefix = modalId.replace('Modal', '');
    const step1 = modal.querySelector('#' + prefix + 'Step1') || modal.querySelector('[id$="Step1"]');
    const step2 = modal.querySelector('#' + prefix + 'Step2') || modal.querySelector('[id$="Step2"]') || modal.querySelector('#sudoStep1');
    const form = step2 ? step2.querySelector('form') : modal.querySelector('form');
    const pwdInp = form ? form.querySelector('input[type="password"]') : null;
    const msg = form ? form.querySelector('.msg') : null;

    function attachFormSubmit() {
        if (!form) return;
        form.onsubmit = async (e) => {
            e.preventDefault();
            const pwd = pwdInp ? pwdInp.value : '';
            if (!pwd) {
                if (msg) {
                    msg.textContent = t('msg_enter_current_pwd') || '请输入当前密码';
                    msg.className = 'msg msg-err';
                }
                return;
            }

            const actionsContainer = form.querySelector('.modal-actions');
            setModalActionsLoading(actionsContainer, true, 'status_updating');

            try {
                const res = await actionFn(pwd);
                let data = res?.data || res || {};

                const isSuccess = data.success === true || data.verified === true || (res?.ok === true && !data.error && !data.requireElevation);
                const isPasswordError = res?.status === 401 || (data?.success === false && (data?.message?.includes('密码错误') || data?.message === 'Invalid credentials' || data?.message === 'Invalid password'));

                if (isPasswordError) {
                    setModalActionsLoading(actionsContainer, false);
                    if (msg) {
                        msg.textContent = data.message || t('msg_wrong_credentials') || '密码错误';
                        msg.className = 'msg msg-err';
                    }
                    if (pwdInp) {
                        pwdInp.value = '';
                        pwdInp.focus();
                    }
                    return;
                }

                if (isSuccess) {
                    window.isElevated = true;
                    setModalActionsLoading(actionsContainer, false);

                    if (modalId === 'oidcModal' && data.client_id) {
                        if (step2) step2.style.display = 'none';
                        const step3 = modal.querySelector('#oidcStep3');
                        if (step3) step3.style.display = 'block';
                        document.getElementById('newOidcClientId').textContent = data.client_id;
                        document.getElementById('newOidcClientSecret').textContent = data.client_secret;
                    } else {
                        closeAllModals();
                    }
                } else {
                    setModalActionsLoading(actionsContainer, false);
                    if (data.message || data.error) {
                        if (msg) {
                            msg.textContent = data.message || data.error;
                            msg.className = 'msg msg-err';
                        }
                    }
                }
            } catch (err) {
                setModalActionsLoading(actionsContainer, false);
                if (msg) {
                    msg.textContent = t('msg_network_error') || '网络错误，请重试';
                    msg.className = 'msg msg-err';
                }
            }
        };
    }

    function showStep2() {
        if (step1) step1.style.display = 'none';
        if (step2) step2.style.display = 'block';
        modal.style.display = 'flex';

        // Auto-populate hidden username field for Bitwarden & browser password managers
        const hiddenUser = form ? form.querySelector('.sudo-hidden-username') : null;
        if (hiddenUser) {
            hiddenUser.value = window.currentUsername || document.getElementById('usernameDisplay')?.textContent?.trim() || '';
        }

        if (pwdInp) {
            pwdInp.value = '';
        }
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        if (msg) {
            msg.textContent = '';
            msg.className = 'msg';
        }
        attachFormSubmit();
    }

    if (window.isElevated) {
        const step1Actions = step1 ? step1.querySelector('.modal-actions') : null;
        if (step1Actions) setModalActionsLoading(step1Actions, true, 'status_updating');

        actionFn('').then(res => {
            const data = res?.data || res || {};
            const isSuccess = data.success === true || data.verified === true || (res?.ok === true && !data.error && !data.requireElevation);
            const needsElevation = data.requireElevation === true || res?.status === 401 || (data.message && (data.message.includes('需要密码确认') || data.message.includes('特权会话已过期') || data.message.includes('密码错误')));

            if (step1Actions) setModalActionsLoading(step1Actions, false);

            if (needsElevation) {
                window.isElevated = false;
                showStep2();
            } else if (isSuccess) {
                closeAllModals();
            } else if (data.message || data.error) {
                const step1Msg = step1 ? step1.querySelector('.msg') : null;
                if (step1Msg) {
                    step1Msg.textContent = data.message || data.error;
                    step1Msg.className = 'msg msg-err';
                }
            }
        }).catch(() => {
            if (step1Actions) setModalActionsLoading(step1Actions, false);
            window.isElevated = false;
            showStep2();
        });
        return;
    }

    showStep2();
}
