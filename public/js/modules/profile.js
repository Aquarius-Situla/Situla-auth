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
        if (step1) step1.style.display = 'block';
        const inp = document.getElementById('newUsername');
        if (inp) inp.value = '';
        const msg1 = document.getElementById('usernameMsg1');
        if (msg1) msg1.textContent = '';
    });

    document.getElementById('cancelUsernameBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelUsernameBtn2')?.addEventListener('click', closeAllModals);

    document.getElementById('continueUsernameBtn')?.addEventListener('click', () => {
        const newUsername = document.getElementById('newUsername')?.value?.trim() || '';
        const msg1 = document.getElementById('usernameMsg1');
        if (msg1) msg1.textContent = '';
        if (!newUsername) {
            if (msg1) {
                msg1.textContent = t('msg_enter_new_username') || '请输入新用户名';
                msg1.className = 'msg msg-err';
            }
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
    });

    // ── Change Email ──
    document.getElementById('showEmailFormBtn')?.addEventListener('click', () => {
        closeAllModals();
        const modal = document.getElementById('emailModal');
        if (modal) modal.style.display = 'flex';
        const step1 = document.getElementById('emailStep1');
        if (step1) step1.style.display = 'block';
        const inp = document.getElementById('newEmail');
        if (inp) inp.value = '';
        const msg1 = document.getElementById('emailMsg1');
        if (msg1) msg1.textContent = '';
        setTimeout(() => inp?.focus(), 60);
    });

    document.getElementById('cancelEmailBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelEmailBtn2')?.addEventListener('click', closeAllModals);

    document.getElementById('continueEmailBtn')?.addEventListener('click', () => {
        const newEmail = document.getElementById('newEmail')?.value?.trim() || '';
        const msg1 = document.getElementById('emailMsg1');
        if (msg1) msg1.textContent = '';
        if (!newEmail) {
            if (msg1) {
                msg1.textContent = t('msg_enter_email') || '请输入有效邮箱';
                msg1.className = 'msg msg-err';
            }
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
    });

    // ── Change Password ──
    document.getElementById('showPasswordFormBtn')?.addEventListener('click', () => {
        closeAllModals();
        const modal = document.getElementById('passwordModal');
        if (modal) modal.style.display = 'flex';
        const step1 = document.getElementById('passwordStep1');
        if (step1) step1.style.display = 'block';
        const p1 = document.getElementById('newPassword');
        const p2 = document.getElementById('confirmPassword');
        if (p1) p1.value = '';
        if (p2) p2.value = '';
        const msg1 = document.getElementById('passwordMsg1');
        if (msg1) msg1.textContent = '';
        setTimeout(() => p1?.focus(), 60);
    });

    document.getElementById('cancelPasswordBtn1')?.addEventListener('click', closeAllModals);
    document.getElementById('cancelPasswordBtn2')?.addEventListener('click', closeAllModals);

    document.getElementById('continuePasswordBtn')?.addEventListener('click', () => {
        const newPassword = document.getElementById('newPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPassword')?.value || '';
        const msg1 = document.getElementById('passwordMsg1');
        if (msg1) msg1.textContent = '';

        if (!newPassword) {
            if (msg1) {
                msg1.textContent = t('msg_enter_new_pwd') || '请输入新密码';
                msg1.className = 'msg msg-err';
            }
            return;
        }
        if (newPassword !== confirmPassword) {
            if (msg1) {
                msg1.textContent = t('msg_pwd_mismatch') || '两次输入的密码不一致';
                msg1.className = 'msg msg-err';
            }
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
    });

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
