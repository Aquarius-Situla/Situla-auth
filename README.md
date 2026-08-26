# 🔐 Situla Auth 2.0

<p>
  <a href="https://github.com/Aquarius-Situla/Situla-auth/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL%203.0-blue?style=flat&logo=open-source-initiative" alt="License">
  </a>&nbsp;&nbsp;
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Powered_by-Node.js-339933?style=flat&logo=node.js" alt="Node.js">
  </a>&nbsp;&nbsp;
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=flat&logo=docker" alt="Docker">
  </a>&nbsp;&nbsp;
  <a href="https://nginxproxymanager.com/">
    <img src="https://img.shields.io/badge/NPM-Forward_Auth-009639?style=flat&logo=nginx" alt="Nginx Proxy Manager">
  </a>
</p>

A lightweight, Apple-style authentication portal supporting Passkeys (WebAuthn), TOTP (2FA), and standard password login. Designed to be deployed with Nginx Proxy Manager as a Forward Auth provider.

---

## 💡 Why Situla Auth? (开发目的)

Mature authentication solutions like **authentik** or **Authelia** are incredibly powerful, but they are also resource-heavy—authentik typically requires **at least 2GB of RAM** to run smoothly. 

**Situla Auth** was created for **extremely lightweight servers** (e.g., small VPS instances with 512MB-1GB RAM). It is strictly designed for **single-user personal use** or homelab environments where minimalism and low resource consumption are the highest priorities.

> [!NOTE]
> For professional, multi-user, or enterprise scenarios, we highly recommend using mature open-source projects like [authentik](https://goauthentik.io/).

---

## ✨ Features

- **Passkey (WebAuthn) Passwordless Login**: Log in effortlessly via Face ID, Touch ID, or Windows Hello.
- **Robust Two-Factor Authentication (2FA)**:
  - **FIDO2 Security Keys**: Use hardware keys (e.g., YubiKey) as a phishing-resistant second factor.
  - **TOTP Authenticator Apps**: Support for Google Authenticator, iOS Passwords, etc.
- **NSA-Grade Defense-in-Depth Security**: 
  - AES-256-GCM strong encryption for TOTP secrets at rest.
  - Constant-time password verification to prevent timing-based username enumeration.
  - Strict algorithmic enforcement for JWT session tokens (HS256).
- **Recovery Codes**: Bcrypt-hashed one-time backup codes when 2FA devices are unavailable.
- **Account Management**: Change username, password, manage Passkeys, generate recovery codes.
- **Apple UI**: Clean, fluid interface following iOS/macOS design language. Seamlessly supports dark and light modes.
- **Forward Auth**: Acts as an auth shield for Nginx Proxy Manager (`/verify` endpoint).

---

## 🚀 Quick Start

```bash
# 1. Clone and enter the directory
git clone git@github.com:Aquarius-Situla/Situla-auth.git
cd Situla-auth

# 2. One-click deploy (handles Docker, network, .env setup)
bash deploy.sh
```

---

## 🛠️ Manual Setup

```bash
# Copy and edit the config file
cp .env.example .env
nano .env

# Create the data directory (persists the SQLite database)
mkdir -p data

# Build and start
docker compose up -d --build
```

---

## ⚙️ Configuration (`.env`)

| Variable           | Description                                              | Example                    |
|--------------------|----------------------------------------------------------|----------------------------|
| `ADMIN_USER`       | Default login username                                   | `admin`                    |
| `ADMIN_PASS`       | Default login password                                   | `mysecretpassword`         |
| `JWT_SECRET`       | Cookie signing secret. **Auto-generated** if left blank. | *(leave blank)*            |
| `COOKIE_DOMAIN`    | Domain scope for the session cookie                      | `.example.com`             |
| `RP_ID`            | WebAuthn Relying Party ID (your auth page hostname)      | `auth.example.com`         |
| `TRUSTED_DOMAINS`  | Extra trusted redirect root domains (comma-separated)    | `a.com,b.org`              |
| `PORT`             | Internal port (default: `3000`)                          | `3000`                     |

> [!NOTE]
> `JWT_SECRET` is automatically generated and written to `.env` on first startup if not set manually.

---

## 🌐 Trusted Redirect Domains

After login, Situla Auth redirects users back to the service they originally tried to access (via the `?rd=` query parameter). For security, only URLs pointing to a **trusted domain** are allowed; all others fall back to the admin panel.

### Default trust (automatic)

The trust root is derived automatically from your `RP_ID`. The **direct parent domain** of the auth hostname is trusted by default — along with all of its subdomains:

| `RP_ID` value            | Automatically trusted                                   |
|--------------------------|----------------------------------------------------------|
| `auth.example.com`       | `example.com` and `*.example.com`                       |
| `auth.a.example.com`     | `a.example.com` and `*.a.example.com` *(not `example.com`)* |
| `auth.com`               | `auth.com` and `*.auth.com`                             |

### Custom extra trust (`TRUSTED_DOMAINS`)

To allow redirects to additional domains, add them as a comma-separated list of **root domains** (no wildcards needed — all subdomains of each root are included automatically):

```env
# .env
TRUSTED_DOMAINS=a.com,b.a.com
```

| `TRUSTED_DOMAINS` value | Trusts                                                      | Does NOT trust              |
|-------------------------|-------------------------------------------------------------|-----------------------------||
| `a.com`                 | `a.com`, `www.a.com`, `sub.a.com`, …                       | —                           |
| `b.a.com`               | `b.a.com`, `x.b.a.com`, …                                  | `a.com`, `other.a.com`      |
| `a.com,b.org`           | Both `a.com` + all subdomains, and `b.org` + all subdomains | —                           |

> [!IMPORTANT]
> After changing `TRUSTED_DOMAINS`, run `docker compose restart` (no rebuild needed).

---


## 🛡️ Nginx Proxy Manager Setup

To protect your services with Situla Auth, you need to configure Nginx Proxy Manager (NPM). All configurations should be placed in the **Advanced** tab of your Proxy Host.

First, you **MUST** include the following base configuration to define the authentication backend and the login redirect behavior:

```nginx
# 1. Define the internal auth route pointing to Situla Auth
location /_auth {
    internal;
    proxy_pass http://situla-auth:3000/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
}

# 2. Catch 401 Unauthorized errors and redirect to the login page
error_page 401 = @error401;
location @error401 {
    # Replace auth.example.com with your actual Situla Auth domain
    return 302 https://auth.example.com/?rd=https://$http_host$request_uri;
}
```

Then, depending on your goal, configure the `location /` block using one of the three scenarios below:

### Scenario 1: Simple Web Protection (简单的网页保护)
If you only want to protect a webpage from public access without passing any user identity to the backend:

```nginx
location / {
    # Enforce authentication
    auth_request /_auth;

    # Standard proxy passthrough
    proxy_pass $forward_scheme://$server:$port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Scenario 2: Username SSO (用户名 SSO)
If your backend application (e.g., FreshRSS, Audiobookshelf) supports Single Sign-On via HTTP Headers and matches users by **Username**, you can pass the username dynamically:

```nginx
location / {
    # Enforce authentication
    auth_request /_auth;

    # Extract the username from Situla Auth
    auth_request_set $auth_user $upstream_http_x_remote_user;
    
    # Forward the username to the backend
    proxy_set_header Remote-User $auth_user;
    proxy_set_header X-Remote-User $auth_user;

    # Standard proxy passthrough
    proxy_pass $forward_scheme://$server:$port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Scenario 3: Email SSO (邮箱 SSO)
If your backend application (e.g., Beszel, PocketBase, Grafana) matches users by **Email Address**, ensure the user has bound an email in their Situla Auth account settings, then pass the email dynamically:

```nginx
location / {
    # Enforce authentication
    auth_request /_auth;

    # Extract the email from Situla Auth
    auth_request_set $auth_email $upstream_http_x_remote_email;
    
    # Forward the email to the backend
    proxy_set_header Remote-User $auth_email;
    proxy_set_header X-Remote-User $auth_email;

    # Standard proxy passthrough
    proxy_pass $forward_scheme://$server:$port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Bypassing Specific Paths (e.g., API or Agents)
If your backend has endpoints that must be accessed by automated agents or external APIs without human authentication (for example, the **Beszel Agent** reporting to the hub via `/api/beszel/agent-connect`), you can bypass SSO for those specific paths by adding a dedicated `location` block *before* the main `location /` block:

```nginx
location /api/beszel/agent-connect {
    # No auth_request here, so this path bypasses SSO
    proxy_pass $forward_scheme://$server:$port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    
    # Required if the path uses WebSockets (e.g., Beszel Agent)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 360s;
    proxy_send_timeout 360s;
}
```

> [!IMPORTANT]
> Both `situla-auth` and your NPM container must be on the same Docker network (e.g., `npm_default`) to resolve internal hostnames like `http://situla-auth:3000`.

---

## 🔄 Development & Updates

### Applying changes

| What changed                                | Command needed                     |
|---------------------------------------------|------------------------------------|
| `.env` config only                          | `docker compose restart`           |
| Backend code (`server.js`, `database.js`)   | `docker compose up -d --build`     |
| Frontend files (`public/` — HTML/CSS/JS)    | `docker compose up -d --build`     |
| New npm dependency (`package.json`)         | `docker compose up -d --build`     |

> [!WARNING]
> Static files in `public/` are baked into the Docker image at build time.  
> A plain `restart` only restarts the Node process — it does **not** pick up changes to source files.  
> Always use `--build` after modifying any source code or frontend assets.

### 💾 Data Persistence

The SQLite database is stored at `./data/database.sqlite` on the host and mounted into the container as a volume. It survives image rebuilds automatically.

---

## 📄 License

This project is open-sourced under the **AGPL-3.0 License**.

---

## 🔐 OIDC Provider (OpenID Connect)

Situla Auth can act as a native **OpenID Connect Identity Provider**, allowing any OIDC-compatible application (Grafana, Gitea, Nextcloud, Jellyfin, etc.) to use it as a login source — no Nginx header injection required.

### Discovery Endpoint

Once deployed, the OIDC metadata is available at:
```
https://<your-auth-domain>/oidc/.well-known/openid-configuration
```

### Configuration (`.env`)

Add the following variables to your `.env` file:

```env
# Required: your auth domain (no trailing slash)
# OIDC_ISSUER is auto-derived from RP_ID if not set.
OIDC_ISSUER=https://auth.example.com

# Required: JSON array of registered client applications
# Fields per client: client_id, client_secret, redirect_uris (array), grant_types (optional)
OIDC_CLIENTS=[{"client_id":"grafana","client_secret":"strong-secret-here","redirect_uris":["https://grafana.example.com/login/generic_oauth"]},{"client_id":"gitea","client_secret":"another-secret","redirect_uris":["https://gitea.example.com/user/oauth2/situla/callback"]}]

# Auto-generated on first startup and persisted here. DO NOT change manually.
# OIDC_JWKS={"keys":[...]}
```

> [!IMPORTANT]
> After editing `OIDC_CLIENTS`, run `docker compose restart` (no rebuild needed).
> The RSA signing key (`OIDC_JWKS`) is auto-generated on first boot and saved to `.env` automatically.

### Supported Scopes & Claims

| Scope | Claims returned |
|---|---|
| `openid` | `sub` (user ID) |
| `profile` | `preferred_username`, `name` |
| `email` | `email`, `email_verified` |

### Application Configuration Examples

**Grafana** (`grafana.ini`):
```ini
[auth.generic_oauth]
enabled = true
name = Situla Auth
client_id = grafana
client_secret = strong-secret-here
scopes = openid profile email
auth_url = https://auth.example.com/oidc/auth
token_url = https://auth.example.com/oidc/token
api_url = https://auth.example.com/oidc/userinfo
```

**Gitea** (Admin Panel → Authentication Sources → OAuth2):
```
Provider: OpenID Connect
Client ID: gitea
Client Secret: another-secret
OpenID Connect Auto Discovery URL: https://auth.example.com/oidc/.well-known/openid-configuration
```

---

## 🗺️ Roadmap

- [x] **OIDC (OpenID Connect) Support**: ✅ Situla Auth now acts as a native OpenID Connect Identity Provider, supporting Authorization Code Flow with mandatory PKCE.

