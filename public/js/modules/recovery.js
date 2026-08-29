/**
 * public/js/modules/recovery.js
 * Recovery codes generation, download, and status monitoring.
 */

import { fetchApi, enterSudoStep } from './api.js';
import { copyToClipboard, downloadText } from './ui.js';

let latestCodes = [];

export async function loadRecoveryStatus() {
    const el = document.getElementById('recoveryStatusText');
    if (!el) return;

    try {
        const { ok, data } = await fetchApi('/api/recovery-codes/status');
        if (ok && data) {
            el.textContent = `${data.remaining} / 8`;
        }
    } catch (e) {
        console.error('[Recovery] Status error:', e);
    }
}

export function setupRecoveryModal() {
    const genBtn = document.getElementById('generateRecoveryBtn');
    const copyBtn = document.getElementById('copyRcBtn');
    const downloadBtn = document.getElementById('downloadRcBtn');

    if (genBtn) {
        genBtn.onclick = () => {
            const modal = document.getElementById('recoveryModal');
            if (modal) modal.style.display = 'flex';

            enterSudoStep('recoveryModal', async (currentPassword) => {
                const res = await fetchApi('/api/recovery-codes/generate', {
                    method: 'POST',
                    body: JSON.stringify({ currentPassword })
                });

                if (res.ok && res.data?.success) {
                    latestCodes = res.data.codes || [];
                    const rcListEl = document.getElementById('rcList');
                    if (rcListEl) {
                        rcListEl.innerHTML = latestCodes.join('<br>');
                    }
                    const step1 = document.getElementById('recoveryStep1');
                    const step3 = document.getElementById('recoveryStep3');
                    if (step1) step1.style.display = 'none';
                    if (step3) step3.style.display = 'block';

                    loadRecoveryStatus();
                }
                return res;
            });
        };
    }

    if (copyBtn) {
        copyBtn.onclick = () => {
            if (latestCodes.length > 0) {
                copyToClipboard(latestCodes.join('\n'), copyBtn);
            }
        };
    }

    if (downloadBtn) {
        downloadBtn.onclick = () => {
            if (latestCodes.length > 0) {
                const content = `Situla Auth Recovery Codes\nGenerated at: ${new Date().toISOString()}\n\n${latestCodes.join('\n')}\n`;
                downloadText('situla-auth-recovery-codes.txt', content);
            }
        };
    }
}
