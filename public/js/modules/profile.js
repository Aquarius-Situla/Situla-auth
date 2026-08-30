/**
 * public/js/modules/profile.js
 * User profile management (username, email, password, and logout).
 */

import { t, closeAllModals } from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

export function setupProfileEvents(onSuccessReload) {
    // ── Change Username ──
    document.getElementById('showUsernameFormBtn')?.addEventListener('click', () => {
        closeAllModals();
        const modal = document.getElementById('usernameModal');
        if (modal) modal.style.display = 'flex';
        const step1 = document.getElementById('usernameStep1');
        const step2 = document.getElementById('usernameStep2');
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        const inp = document.getElementById('newUsername');
        if (inp) inp.value = '';
        const msg1 = document.getElementById('usernameMsg1');
        if (msg1) {
            msg1.textContent = '';
            msg1.className = 'msg';
        }
        setTimeout(() => inp?.focus(), 60);
    });

    document.getElementById('cancelUsernameBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelUsernameBtn2')?.addEventListener('click', closeAllModals);

    function handleUsernameStep1Submit(e) {
        if (e) e.preventDefault();
        const newUsername = document.getElementById('newUsername')?.value?.trim() || '';
        const msg1 = document.getElementById('usernameMsg1');
        if (msg1) msg1.textContent = '';

        if (!newUsername) {
            if (msg1) {
                msg1.textContent = t('msg_enter_new_username') || '请输入新用户名';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newUsername')?.focus();
            return;
        }

        if (window.currentUsername && newUsername === window.currentUsername) {
            if (msg1) {
                msg1.textContent = t('msg_username_same') || '新用户名不能与当前用户名相同';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newUsername')?.focus();
            return;
        }

        const usernameRegex = /^[a-zA-Z0-9_-]{3,32}$/;
        if (!usernameRegex.test(newUsername)) {
            if (msg1) {
                msg1.textContent = t('msg_username_invalid') || '用户名须为 3-32 位字母、数字、下划线或连字符';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newUsername')?.focus();
            return;
        }

        const actionFn = async (pwd) => {
            const res = await fetchApi('/api/change-username', {
                method: 'POST',
                body: JSON.stringify({ newUsername, currentPassword: pwd })
            });

            if (res.ok && res.data?.success) {
                alert(t('msg_username_changed', newUsername) || `用户名已修改为 ${newUsername}`);
                location.reload();
                return { success: true };
            }
            return { success: false, message: res.data?.message || '修改失败' };
        };

        enterSudoStep('usernameModal', actionFn);
    }

    document.getElementById('usernameStep1Form')?.addEventListener('submit', handleUsernameStep1Submit);
    document.getElementById('continueUsernameBtn')?.addEventListener('click', handleUsernameStep1Submit);

    // ── Change Email ──
    document.getElementById('showEmailFormBtn')?.addEventListener('click', () => {
        closeAllModals();
        const modal = document.getElementById('emailModal');
        if (modal) modal.style.display = 'flex';
        const step1 = document.getElementById('emailStep1');
        const step2 = document.getElementById('emailStep2');
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        const inp = document.getElementById('newEmail');
        if (inp) inp.value = '';
        const msg1 = document.getElementById('emailMsg1');
        if (msg1) {
            msg1.textContent = '';
            msg1.className = 'msg';
        }
        setTimeout(() => inp?.focus(), 60);
    });

    document.getElementById('cancelEmailBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelEmailBtn2')?.addEventListener('click', closeAllModals);

    function handleEmailStep1Submit(e) {
        if (e) e.preventDefault();
        const newEmail = document.getElementById('newEmail')?.value?.trim() || '';
        const msg1 = document.getElementById('emailMsg1');
        if (msg1) msg1.textContent = '';

        if (!newEmail) {
            if (msg1) {
                msg1.textContent = t('msg_enter_email') || '请输入有效邮箱';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newEmail')?.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            if (msg1) {
                msg1.textContent = t('msg_invalid_email') || '邮箱格式不正确';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newEmail')?.focus();
            return;
        }

        const actionFn = async (pwd) => {
            const res = await fetchApi('/api/change-email', {
                method: 'POST',
                body: JSON.stringify({ newEmail, currentPassword: pwd })
            });

            if (res.ok && res.data?.success) {
                alert(t('msg_email_changed') || '邮箱修改成功');
                if (onSuccessReload) onSuccessReload();
                return { success: true };
            }
            return { success: false, message: res.data?.message || '修改失败' };
        };

        enterSudoStep('emailModal', actionFn);
    }

    document.getElementById('emailStep1Form')?.addEventListener('submit', handleEmailStep1Submit);
    document.getElementById('continueEmailBtn')?.addEventListener('click', handleEmailStep1Submit);

    // ── Change Password ──
    document.getElementById('showPasswordFormBtn')?.addEventListener('click', () => {
        closeAllModals();
        const modal = document.getElementById('passwordModal');
        if (modal) modal.style.display = 'flex';
        const step1 = document.getElementById('passwordStep1');
        const step2 = document.getElementById('passwordStep2');
        if (step1) step1.style.display = 'block';
        if (step2) step2.style.display = 'none';
        const p1 = document.getElementById('newPassword');
        const p2 = document.getElementById('confirmPassword');
        if (p1) p1.value = '';
        if (p2) p2.value = '';
        const msg1 = document.getElementById('passwordMsg1');
        if (msg1) {
            msg1.textContent = '';
            msg1.className = 'msg';
        }
        setTimeout(() => p1?.focus(), 60);
    });

    document.getElementById('cancelPasswordBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelPasswordBtn2')?.addEventListener('click', closeAllModals);

    function handlePasswordStep1Submit(e) {
        if (e) e.preventDefault();
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        const msg1 = document.getElementById('passwordMsg1');
        if (msg1) msg1.textContent = '';

        if (!newPassword) {
            if (msg1) {
                msg1.textContent = t('msg_enter_new_pwd') || '请输入新密码';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newPassword')?.focus();
            return;
        }
        if (newPassword.length < 6) {
            if (msg1) {
                msg1.textContent = t('msg_pwd_too_short') || '密码长度至少为 6 位';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('newPassword')?.focus();
            return;
        }
        if (newPassword !== confirmPassword) {
            if (msg1) {
                msg1.textContent = t('msg_pwd_mismatch') || '两次输入的密码不一致';
                msg1.className = 'msg msg-err';
            }
            document.getElementById('confirmPassword')?.focus();
            return;
        }

        const actionFn = async (pwd) => {
            if (newPassword === pwd) {
                return { success: false, message: t('msg_pwd_same') || '新密码不能与当前密码相同' };
            }

            const res = await fetchApi('/api/change-password', {
                method: 'POST',
                body: JSON.stringify({ newPassword, currentPassword: pwd })
            });

            if (res.ok && res.data?.success) {
                alert(t('msg_pwd_changed') || '密码修改成功');
                return { success: true };
            }
            return { success: false, message: res.data?.message || '修改失败' };
        };

        enterSudoStep('passwordModal', actionFn);
    }

    document.getElementById('newPasswordForm')?.addEventListener('submit', handlePasswordStep1Submit);
    document.getElementById('continuePasswordBtn')?.addEventListener('click', handlePasswordStep1Submit);

    // ── Logout ──
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try {
            await fetchApi('/api/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (e) {}
    });

    document.getElementById('logoutAllBtn')?.addEventListener('click', async () => {
        if (!confirm(t('msg_confirm_logout_all') || '确定要在所有设备上退出登录吗？')) return;
        try {
            await fetchApi('/api/logout-all', { method: 'POST' });
            window.location.href = '/';
        } catch (e) {}
    });
}
