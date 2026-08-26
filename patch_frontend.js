const fs = require('fs');

// Patch admin.html
let html = fs.readFileSync('public/admin.html', 'utf8');

const oidcCard = `
        <!-- OIDC Clients card -->
        <div class="settings-group" id="oidcCard">
            <div class="section">
                <div class="section-header">
                    <h3 data-i18n="oidc_title">OIDC 第三方应用</h3>
                    <p class="section-desc" data-i18n="oidc_desc">管理可以通过当前身份验证系统登录的第三方应用（如网盘、论坛等）。必须使用高安全级别会话管理。</p>
                </div>
                
                <div id="oidcErrorMsg" style="color: #ff3b30; display: none; font-size: 14px; margin-bottom: 15px;"></div>
                
                <div id="oidcClientList" class="key-list"></div>
                
                <div class="action-btn-container" style="margin-top: 15px;">
                    <button class="apple-btn btn-secondary" id="addOidcBtn" data-i18n="oidc_add">添加第三方应用</button>
                </div>
            </div>
        </div>

        <!-- Add OIDC Client Modal -->
        <div class="modal-overlay" id="oidcModal">
            <div class="modal-card">
                <h3 style="margin-top:0" data-i18n="oidc_add_title">添加第三方应用</h3>
                <input type="text" id="oidcAppName" class="apple-input" placeholder="应用名称 (如 Nextcloud)">
                <textarea id="oidcRedirectUris" class="apple-input" placeholder="重定向 URI (一行一个)" style="height: 80px; margin-top: 10px;"></textarea>
                <div class="modal-actions">
                    <button class="apple-btn btn-secondary" onclick="document.getElementById('oidcModal').style.display='none'" data-i18n="cancel">取消</button>
                    <button class="apple-btn btn-primary" id="confirmAddOidcBtn" data-i18n="confirm">确认</button>
                </div>
            </div>
        </div>
        
        <!-- OIDC Secret Display Modal -->
        <div class="modal-overlay" id="oidcSecretModal">
            <div class="modal-card">
                <h3 style="margin-top:0">应用创建成功</h3>
                <p style="color:#ff3b30; font-size:14px; font-weight:600;">请立刻妥善保存以下信息，Client Secret 只会显示这一次！</p>
                <div style="text-align: left; background: #f0f0f5; padding: 10px; border-radius: 8px; margin: 15px 0;">
                    <strong style="display:block;margin-bottom:5px;">Client ID:</strong>
                    <code id="newOidcClientId" style="word-break: break-all; display:block; margin-bottom:15px; color:#1d1d1f;"></code>
                    
                    <strong style="display:block;margin-bottom:5px;">Client Secret:</strong>
                    <code id="newOidcClientSecret" style="word-break: break-all; display:block; color:#1d1d1f;"></code>
                </div>
                <div class="modal-actions">
                    <button class="apple-btn btn-primary" onclick="document.getElementById('oidcSecretModal').style.display='none'">我已保存</button>
                </div>
            </div>
        </div>
`;

// Insert the card right before the logout container
html = html.replace('        <div class="logout-container">', oidcCard + '\n        <div class="logout-container">');
fs.writeFileSync('public/admin.html', html);

// Patch admin.js
let js = fs.readFileSync('public/js/admin.js', 'utf8');

const oidcJs = `
async function loadOidcClients() {
    const res = await fetch('/api/oidc/clients');
    if (res.status === 403) {
        document.getElementById('oidcErrorMsg').textContent = '⚠️ 权限不足：您当前未处于高安全级别会话（Passkey/2FA），无法管理 OIDC 应用。';
        document.getElementById('oidcErrorMsg').style.display = 'block';
        document.getElementById('addOidcBtn').disabled = true;
        document.getElementById('addOidcBtn').style.opacity = '0.5';
        return;
    }
    const data = await res.json();
    const list = document.getElementById('oidcClientList');
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
        delBtn.onclick = async () => {
            if(confirm('确定删除该第三方应用？删除后它将无法通过本系统登录。')) {
                await fetch('/api/oidc/clients/' + client.id, { method: 'DELETE' });
                loadOidcClients();
            }
        };
        
        item.appendChild(info);
        item.appendChild(delBtn);
        list.appendChild(item);
    });
}

document.getElementById('addOidcBtn')?.addEventListener('click', () => {
    document.getElementById('oidcAppName').value = '';
    document.getElementById('oidcRedirectUris').value = '';
    document.getElementById('oidcModal').style.display = 'flex';
});

document.getElementById('confirmAddOidcBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('oidcAppName').value.trim();
    const uris = document.getElementById('oidcRedirectUris').value.split('\\n').map(u => u.trim()).filter(u => u);
    
    if (!name || uris.length === 0) return alert('请填写完整的应用名称和至少一个重定向URI');
    
    const res = await fetch('/api/oidc/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: name, redirect_uris: uris })
    });
    
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
});

// Call it on load
loadOidcClients();
`;

// Insert at the end of the file
if (!js.includes('loadOidcClients')) {
    js += '\n' + oidcJs;
    fs.writeFileSync('public/js/admin.js', js);
}

console.log('Frontend patched');
