/**
 * public/js/modules/recovery.js
 * Recovery Codes generation, copy, and UI badge management.
 */

import { t, copyToClipboard, closeAllModals } from './ui.js';
import { fetchApi, enterSudoStep } from './api.js';

export function updateRcCard(has2FA, remaining = 0) {
    const rcCard = document.getElementById('rcCard');
    const badge = document.getElementById('rcBadge');
    if (!rcCard) return;

    rcCard.style.display = has2FA ? '' : 'none';
    if (!has2FA || !badge) return;

    if (remaining === 0) {
        badge.textContent = t('badge_not_gen') || '未生成';
        badge.className = 'badge badge-disabled';
    } else {
        badge.textContent = t('badge_rc_remaining', remaining) || `剩余 ${remaining} 个`;
        badge.className = remaining <= 2 ? 'badge badge-warn' : 'badge badge-count';
    }
}

export function setupRecoveryEvents(onSuccessReload) {
    document.getElementById('genRcBtn')?.addEventListener('click', () => {
        const actionFn = async (pwd) => {
            const { ok, data } = await fetchApi('/api/recovery-codes/generate', {
                method: 'POST',
                body: JSON.stringify({ currentPassword: pwd })
            });

            if (ok && data.success) {
                const rcPanel = document.getElementById('rcPanel');
                const rcList = document.getElementById('rcList');
                const rcBadge = document.getElementById('rcBadge');

                if (rcPanel) rcPanel.style.display = 'block';
                if (rcList) rcList.innerHTML = (data.codes || []).join('<br>');
                if (rcBadge) {
                    rcBadge.textContent = '已生成(8)';
                    rcBadge.className = 'badge badge-enabled';
                }
                if (onSuccessReload) onSuccessReload();
                return { success: true };
            }
            return { success: false, message: data?.message || '生成失败' };
        };

        enterSudoStep('sudoModal', actionFn);
    });

    document.getElementById('cancelSudoBtn')?.addEventListener('click', closeAllModals);

    document.getElementById('copyRcBtn')?.addEventListener('click', () => {
        const listText = document.getElementById('rcList')?.innerText?.replace(/\n/g, ' ') || '';
        const btn = document.getElementById('copyRcBtn');
        if (listText && btn) {
            copyToClipboard(listText, btn, '已复制');
        }
    });
}
