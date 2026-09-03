/**
 * public/js/modules/npm-generator.js
 * Nginx Proxy Manager Forward-Auth Configuration Generator
 * Produces production-grade Nginx snippets aligned with /opt/npm configurations.
 */

import { t } from './ui.js';

export function generateNginxSnippet() {
    const domainInput = document.getElementById('npmProtectedDomain');
    const bypassInput = document.getElementById('npmBypassPaths');
    const onionInput = document.getElementById('npmOnionLocation');
    const ssoSelect = document.getElementById('npmSsoMode');

    const domain = (domainInput?.value || '').trim();
    const bypassRaw = bypassInput?.value || '';
    const onionRaw = (onionInput?.value || '').trim();
    const ssoMode = ssoSelect?.value || 'user';

    const authOrigin = window.location.origin || 'https://auth.yourdomain.com';
    const isEn = typeof window.i18n !== 'undefined' && 
                 typeof window.i18n.getLocale === 'function' && 
                 window.i18n.getLocale() === 'en-US';

    const lines = [];

    // Part 1: Auth Subrequest & 401 Interception
    if (isEn) {
        lines.push('# ====================================================');
        lines.push('# Part 1: Forward-Auth Endpoint & 401 Interception');
        lines.push('# ====================================================');
        lines.push('');
        lines.push('# 1. Internal authentication subrequest route (Docker internal network)');
        lines.push('location /_auth {');
        lines.push('    internal;');
        lines.push('    proxy_pass http://situla-auth:3000/verify;');
        lines.push('    proxy_pass_request_body off;');
        lines.push('    proxy_set_header Content-Length "";');
        lines.push('    proxy_set_header X-Original-URI $request_uri;');
        lines.push('}');
        lines.push('');
        lines.push('# 2. Handle 401 Unauthorized: redirect to unified login portal');
        lines.push('error_page 401 = @error401;');
        lines.push('location @error401 {');
        lines.push(`    return 302 ${authOrigin}/?rd=https://$http_host$request_uri;`);
        lines.push('}');
    } else {
        lines.push('# ====================================================');
        lines.push('# 第一部分：认证端点配置与鉴权失败重定向策略');
        lines.push('# ====================================================');
        lines.push('');
        lines.push('# 1. 内部认证子请求路由（基于同源 Docker 网络环境的内部解析）');
        lines.push('location /_auth {');
        lines.push('    internal;');
        lines.push('    proxy_pass http://situla-auth:3000/verify;');
        lines.push('    proxy_pass_request_body off;');
        lines.push('    proxy_set_header Content-Length "";');
        lines.push('    proxy_set_header X-Original-URI $request_uri;');
        lines.push('}');
        lines.push('');
        lines.push('# 2. 鉴权失败时的回退路由（自动重定向至中央认证门户并携带源请求 URI）');
        lines.push('error_page 401 = @error401;');
        lines.push('location @error401 {');
        lines.push(`    return 302 ${authOrigin}/?rd=https://$http_host$request_uri;`);
        lines.push('}');
    }

    // Part 2: Bypassed Paths (Optional)
    const bypassPaths = bypassRaw
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#'));

    let partIndex = 2;

    if (bypassPaths.length > 0) {
        lines.push('');
        if (isEn) {
            lines.push('# ====================================================');
            lines.push('# Part 2: Bypassed Routes (Skip Authentication)');
            lines.push('# ====================================================');
        } else {
            lines.push('# ====================================================');
            lines.push('# 第二部分：放行路径配置（绕过身份拦截）');
            lines.push('# ====================================================');
        }

        bypassPaths.forEach(rawPath => {
            let pathDirective = rawPath;
            if (!pathDirective.startsWith('/') && !pathDirective.startsWith('~') && !pathDirective.startsWith('=')) {
                pathDirective = '/' + pathDirective;
            }

            lines.push('');
            lines.push(`location ${pathDirective} {`);
            lines.push('    auth_request off;');
            lines.push('    proxy_pass $forward_scheme://$server:$port;');
            lines.push('    proxy_set_header Host $host;');
            lines.push('    proxy_set_header X-Real-IP $remote_addr;');
            lines.push('    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
            lines.push('    proxy_set_header X-Forwarded-Proto $scheme;');
            lines.push('}');
        });
        partIndex++;
    }

    // Part 3: Main Route / Access Control
    lines.push('');
    if (isEn) {
        lines.push('# ====================================================');
        lines.push(`# Part ${partIndex}: Global Access Control & Reverse Proxy`);
        lines.push('# ====================================================');
    } else {
        const cnNum = partIndex === 2 ? '第二部分' : '第三部分';
        lines.push('# ====================================================');
        lines.push(`# ${cnNum}：全局访问控制与反向代理转发`);
        lines.push('# ====================================================');
    }

    lines.push('location / {');
    if (isEn) {
        lines.push('    # Enforce authentication check via internal /_auth endpoint');
    } else {
        lines.push('    # 强制启用访问控制拦截，所有流量需先经由 /_auth 节点校验');
    }
    lines.push('    auth_request /_auth;');

    // Onion-Location Injection
    if (onionRaw) {
        const cleanOnion = onionRaw.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        lines.push('');
        if (isEn) {
            lines.push('    # Inject Onion-Location response header (Tor Browser will offer redirect)');
        } else {
            lines.push('    # 严格注入 Onion-Location 响应头（带 always 确保即使 304 缓存也生效）');
        }
        lines.push(`    add_header Onion-Location "http://${cleanOnion}$request_uri" always;`);
    }

    // SSO Header Forwarding
    if (ssoMode === 'user') {
        lines.push('');
        if (isEn) {
            lines.push('    # SSO: Extract authenticated username and forward to upstream backend');
        } else {
            lines.push('    # 核心 SSO 逻辑：从鉴权中心提取已认证的用户名并注入到发往后端的代理请求中');
        }
        lines.push('    auth_request_set $auth_user $upstream_http_x_remote_user;');
        lines.push('    proxy_set_header Remote-User $auth_user;');
        lines.push('    proxy_set_header X-Remote-User $auth_user;');
    } else if (ssoMode === 'email') {
        lines.push('');
        if (isEn) {
            lines.push('    # SSO: Extract authenticated email and forward to upstream backend');
        } else {
            lines.push('    # 核心 SSO 逻辑：从鉴权中心提取已认证的邮箱并注入到发往后端的代理请求中');
        }
        lines.push('    auth_request_set $auth_email $upstream_http_x_remote_email;');
        lines.push('    proxy_set_header Remote-User $auth_email;');
        lines.push('    proxy_set_header X-Remote-User $auth_email;');
    } else if (ssoMode === 'both') {
        lines.push('');
        if (isEn) {
            lines.push('    # SSO: Extract both username and email, forwarding to upstream backend');
        } else {
            lines.push('    # 核心 SSO 逻辑：从鉴权中心提取用户名与邮箱并注入到发往后端的代理请求中');
        }
        lines.push('    auth_request_set $auth_user $upstream_http_x_remote_user;');
        lines.push('    auth_request_set $auth_email $upstream_http_x_remote_email;');
        lines.push('    proxy_set_header Remote-User $auth_user;');
        lines.push('    proxy_set_header X-Remote-User $auth_user;');
        lines.push('    proxy_set_header Remote-Email $auth_email;');
        lines.push('    proxy_set_header X-Remote-Email $auth_email;');
    }

    lines.push('');
    if (isEn) {
        lines.push('    # Standard reverse proxy pass to backend container/host');
    } else {
        lines.push('    # 标准反向代理转发配置');
    }
    lines.push('    proxy_pass $forward_scheme://$server:$port;');
    lines.push('    proxy_set_header Host $host;');
    lines.push('    proxy_set_header X-Real-IP $remote_addr;');
    lines.push('    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
    lines.push('    proxy_set_header X-Forwarded-Proto $scheme;');
    lines.push('');
    if (isEn) {
        lines.push('    # Support WebSocket protocol upgrades');
    } else {
        lines.push('    # 支持 WebSocket 协议升级');
    }
    lines.push('    proxy_http_version 1.1;');
    lines.push('    proxy_set_header Upgrade $http_upgrade;');
    lines.push('    proxy_set_header Connection "upgrade";');
    lines.push('}');

    return lines.join('\n');
}

export function updateNpmCodeDisplay() {
    const codeEl = document.getElementById('npmConfigCode');
    if (!codeEl) return;
    codeEl.textContent = generateNginxSnippet();
}

export function setupNpmGenerator() {
    const domainInput = document.getElementById('npmProtectedDomain');
    const bypassInput = document.getElementById('npmBypassPaths');
    const onionInput = document.getElementById('npmOnionLocation');
    const ssoSelect = document.getElementById('npmSsoMode');
    const copyBtn = document.getElementById('copyNpmConfigBtn');

    // Restore previously saved onion location if present
    try {
        const savedOnion = localStorage.getItem('situla_last_onion');
        if (savedOnion && onionInput && !onionInput.value) {
            onionInput.value = savedOnion;
        }
    } catch (e) {}

    // Attach real-time input listeners
    const triggerUpdate = () => {
        updateNpmCodeDisplay();
        if (onionInput) {
            try {
                const val = onionInput.value.trim();
                if (val) localStorage.setItem('situla_last_onion', val);
            } catch (e) {}
        }
    };

    domainInput?.addEventListener('input', triggerUpdate);
    bypassInput?.addEventListener('input', triggerUpdate);
    onionInput?.addEventListener('input', triggerUpdate);
    ssoSelect?.addEventListener('change', triggerUpdate);

    // One-click copy handler
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const code = generateNginxSnippet();
            let copied = false;
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                try {
                    await navigator.clipboard.writeText(code);
                    copied = true;
                } catch (err) {
                    console.warn('[NPM Generator] Clipboard write failed, falling back:', err);
                }
            }

            if (!copied) {
                const textarea = document.createElement('textarea');
                textarea.value = code;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    copied = document.execCommand('copy');
                } catch (e) {}
                document.body.removeChild(textarea);
            }

            if (copied) {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = t('npm_btn_copied') || '✓ 已复制';
                copyBtn.classList.add('btn-solid');
                copyBtn.classList.remove('btn-outline');
                setTimeout(() => {
                    copyBtn.textContent = t('npm_btn_copy') || originalText;
                    copyBtn.classList.remove('btn-solid');
                    copyBtn.classList.add('btn-outline');
                }, 2000);
            }
        });
    }

    // Re-render when language changes
    window.addEventListener('i18n:localeChanged', () => {
        updateNpmCodeDisplay();
    });

    // Initial render
    updateNpmCodeDisplay();
}
