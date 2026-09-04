# 🔐 Situla Auth 2.0

<p align="center">
  <strong>🌐 English | <a href="README_zh.md">简体中文</a></strong>
</p>

<p align="center">
  <a href="https://github.com/Aquarius-Situla/Situla-auth/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL%203.0-blue?style=flat&logo=open-source-initiative" alt="License">
  </a>&nbsp;&nbsp;
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js" alt="Node.js">
  </a>&nbsp;&nbsp;
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=flat&logo=docker" alt="Docker">
  </a>&nbsp;&nbsp;
  <a href="https://nginxproxymanager.com/">
    <img src="https://img.shields.io/badge/NPM-Forward_Auth-009639?style=flat&logo=nginx" alt="Nginx Proxy Manager">
  </a>&nbsp;&nbsp;
  <a href="https://fidoalliance.org/">
    <img src="https://img.shields.io/badge/WebAuthn-Passkeys%20%26%20FIDO2-FF6B00?style=flat" alt="WebAuthn">
  </a>&nbsp;&nbsp;
  <a href="https://openid.net/developers/how-connect-works/">
    <img src="https://img.shields.io/badge/OIDC-Provider-F78C40?style=flat&logo=openid" alt="OIDC">
  </a>
</p>

<p align="center">
  An ultra-lightweight (<strong>&lt;50MB RAM</strong>), Apple-styled personal authentication portal and native OpenID Connect (OIDC) Identity Provider. Features biometric Passkeys (WebAuthn), hardware FIDO2 keys, encrypted TOTP, progressive password reveal, and a built-in interactive Nginx Proxy Manager (NPM) configuration generator.
</p>

---

## 💡 Why Situla Auth?

Enterprise identity providers like **authentik** or **Keycloak** offer comprehensive features, but their resource footprints are substantial—typically demanding **2GB+ of RAM** to run reliably.

**Situla Auth** was engineered specifically for **ultra-lightweight servers** (such as small VPS instances with 512MB–1GB RAM), self-hosters, and single-user homelab environments where speed, minimalism, and low resource overhead are essential:

- **Extremely Low Memory**: Runs within **30MB to 50MB of RAM** under production loads.
- **Zero Heavy Dependencies**: Built on pure Node.js, Express, and an embedded SQLite database with automatic zero-config migrations.
- **Single-User Security Focus**: Tailored for protecting homelab dashboards, personal services, and private reverse-proxy backends without multi-tenant enterprise bloat.

> [!NOTE]
> For large organizations, multi-tenant businesses, or complex LDAP/SAML directory federations, mature solutions like [authentik](https://goauthentik.io/) remain the recommended path.

---

## ✨ Features

### 🔑 Modern Biometrics & Passwordless Auth
- **Passkey (WebAuthn)**: One-click biometric sign-in via Face ID, Touch ID, Windows Hello, or Android Passkeys without passwords.
- **FIDO2 Hardware Security Keys**: Phishing-resistant second factor utilizing physical USB/NFC tokens (e.g., YubiKey, Nitrokey) with `residentKey` support.
- **TOTP Authenticator Apps**: Compatible with Google Authenticator, Apple Passwords, 1Password, Bitwarden, etc.
- **Emergency Recovery Codes**: Bcrypt-hashed single-use backup codes when physical authenticator devices are inaccessible.

### 🌐 Forward Auth & Built-in NPM Generator
- **Forward Auth Guard**: Protects reverse-proxied services behind Nginx Proxy Manager (NPM) using the fast `/verify` endpoint.
- **Interactive NPM Config Generator**: Built directly into the Admin Console. Generate tailored, production-ready Nginx configuration blocks (Standard Web Protection, Username SSO, Email SSO, custom API bypasses, and Onion-Location headers) with one click.

### 🆔 Native OIDC Provider (OpenID Connect)
- **Standard-Compliant IdP**: Implements Authorization Code Flow with mandatory PKCE (RFC 7636).
- **Zero-Config Signing**: Auto-generates cryptographic RSA JWKS keys on first startup.
- **Seamless Integrations**: Natively connects third-party services like Grafana, Gitea, Nextcloud, and Jellyfin.
- **Visual Client Management**: Register, view, and manage OIDC client credentials straight from the Admin Console.

### 🎨 Apple Human Interface Design
- **Native Look & Feel**: Tailored with Apple HIG design principles, SF-inspired vector icons, and automatic Light/Dark mode switching.
- **Micro-Halo System**: Standardized 3px subtle focus ring (`0 0 0 3px rgba(0, 113, 227, 0.15)`) across all inputs and modal dialogs.
- **Progressive Disclosure Login Card**: Smooth accordion expansion with an integrated password reveal eye toggle button.
- **Mobile Comfort**: Ergonomic mobile viewport anchoring that prevents abrasive virtual keyboard layout jumps on touchscreens.

### 🔒 Defense-in-Depth Security & Privacy
- **Sudo Elevation Mode**: Requires re-authentication before modifying sensitive credentials (changing passwords, revoking 2FA, or generating backup keys).
- **Untrusted Redirect Interceptor**: Integrated `warning.html` security gate halts phishing attempts and unauthorized external redirects outside your trusted root domains.
- **Timing-Safe Evaluation**: Constant-time bcrypt comparisons to eliminate timing side-channel attacks on usernames.
- **AES-256-GCM Encryption at Rest**: Encrypts TOTP seeds and sensitive secrets in SQLite using AES-256-GCM with authenticated tags.
- **Privacy Masking**: Masks user email addresses (`si*****@corp.internal`) in API responses.
- **Security Audit Logging**: Records login events, timestamps, client IPs, user agents, and security anomalies in a searchable log panel.
- **Instant Revocation**: Real-time JWT token versioning and JTI revocation cache for instant logout enforcement.

### 🌍 Fully Symmetrical Bilingual i18n
- **Dynamic Localization**: Instant switching between English (`en-US`) and Simplified Chinese (`zh-CN`).
- **100% Symmetrical Dictionaries**: Over 240 symmetrically paired translation keys with reactive event dispatching (`i18n:localeChanged`).

---

## 📁 Project Architecture & Directory Structure

```text
situla-auth/
├── core/                           # Low-level infrastructure
│   ├── crypto.js                   # AES-256-GCM encryption, key validation & random generation
│   └── database.js                 # SQLite engine, auto-migrations & backup interfaces
├── services/                       # Business logic services
│   ├── authService.js              # Authentication, bcrypt verification & JWT issuance
│   ├── accountService.js           # Profile management, email masking & credentials
│   ├── webauthnService.js          # WebAuthn Passkey registration & assertion (SimpleWebAuthn)
│   ├── totpService.js              # TOTP secrets, QR codes & AES encryption
│   ├── recoveryService.js          # Single-use emergency recovery code generation
│   ├── oidcService.js              # OpenID Connect client registries & metadata
│   └── auditService.js             # Security audit logs & client telemetry
├── routes/                         # RESTful API route endpoints
│   ├── auth.js                     # Login, logout, session status & Sudo elevation
│   ├── account.js                  # User profile and credential updates
│   ├── passkey.js                  # Passkey challenge and verification endpoints
│   ├── fido2.js                    # FIDO2 2FA hardware key challenge endpoints
│   ├── totp.js                     # TOTP setup, verification & toggle endpoints
│   ├── recovery.js                 # Emergency recovery codes endpoints
│   ├── oidc-clients.js             # OIDC client management endpoints
│   └── logs.js                     # Audit log query endpoints
├── middleware/                     # Express middlewares
│   └── auth.js                     # JWT verification, Sudo token check & version cache
├── public/                         # Frontend client application (Apple HIG)
│   ├── index.html                  # Portal login page (accordion card, eye toggle, Passkey)
│   ├── admin.html                  # Admin console (profile, 2FA, NPM generator, OIDC, audit logs)
│   ├── 2fa.html                    # Dedicated 2FA challenge screen
│   ├── warning.html                # Untrusted redirect interceptor screen
│   ├── css/                        # Modular CSS system
│   │   ├── tokens.css              # Apple HIG design tokens (colors, 3px rings, transitions)
│   │   ├── base.css / layout.css   # Reset & mobile-first responsive shells
│   │   └── components/             # Independent component styles (modals, forms, npm-generator...)
│   ├── js/                         # ES modules & frontend controllers
│   │   ├── modules/                # Decoupled UI modules (api, fido2, npm-generator, oidc, ui...)
│   │   └── login.js / admin.js     # Page orchestration scripts
│   ├── i18n/                       # Localization subsystem
│   │   ├── i18n.js                 # Bilingual runtime engine & event emitter
│   │   └── locales/                # Symmetric dictionary packs (en-US, zh-CN)
│   └── assets/                     # Vector SVGs (branding & UI icons)
├── tests/                          # Automated testing & CI smoke gates
│   ├── smoke-test.js               # Container-internal functionality smoke test
│   └── docker-smoke-test.sh        # Blackbox infrastructure probe gate
├── deploy.sh                       # Production 1-click deployment & hot-backup pipeline
├── Dockerfile                      # Minimal multi-stage production Docker image
├── docker-compose.yml              # Docker Compose deployment & volume mapping
├── server.js                       # Primary application entry point & route aggregator
└── oidc.mjs                        # Native OIDC Provider protocol engine
```

---

## 🚀 Quick Start

### Option 1: Automated 1-Click Deployment (Recommended)

Situla Auth ships with an industrial-grade deployment script (`deploy.sh`) that automates environment validation, Docker networking, hot SQLite backup, container rebuilding, and dual-layer smoke testing:

```bash
# 1. Clone the repository
git clone https://github.com/Aquarius-Situla/Situla-auth.git
cd Situla-auth

# 2. Run the deployment automation
bash deploy.sh
```

The script automatically guides you through the initial configuration on your first launch.

### Option 2: Manual Docker Compose

```bash
# 1. Prepare environment configuration
cp .env.example .env
nano .env

# 2. Create the SQLite persistence directory
mkdir -p data

# 3. Build and launch the container
docker compose up -d --build
```

---

## ⚙️ Configuration Reference (`.env`)

Configure the following variables in your `.env` file:

| Variable | Required | Default | Description | Example |
|---|:---:|---|---|---|
| `ADMIN_USER` | **Yes** | `admin` | Default administrator username | `admin` |
| `ADMIN_PASS` | **Yes** | — | Default administrator password | `YourStrongPasswordHere` |
| `COOKIE_DOMAIN` | **Yes** | `.example.com` | Root domain for the session cookie (starts with `.`) | `.example.com` |
| `RP_ID` | **Yes** | `auth.example.com` | WebAuthn Relying Party ID (your auth domain hostname) | `auth.example.com` |
| `TRUSTED_DOMAINS` | No | — | Additional root domains permitted for `?rd=` redirects | `app.example.com,b.org` |
| `PORT` | No | `3000` | Internal server listen port | `3000` |
| `JWT_SECRET` | Auto | *(auto-generated)* | 256-bit cookie signing secret. Generated on 1st boot. | *(leave blank)* |
| `ENCRYPTION_KEY`| Auto | *(auto-generated)* | 256-bit key for AES-GCM TOTP encryption at rest. | *(leave blank)* |
| `OIDC_JWKS` | Auto | *(auto-generated)* | RSA keypair for OIDC token signatures. | *(leave blank)* |
| `OIDC_ISSUER` | No | `https://<RP_ID>` | Issuer URL advertised in `.well-known` discovery | `https://auth.example.com` |
| `OIDC_CLIENTS` | No | `[]` | JSON array of pre-registered OIDC client applications | *(manageable via Admin UI)* |
| `SMTP_HOST` | No | — | Optional SMTP server for email alerts | `smtp.example.com` |
| `SMTP_PORT` | No | `465` | SMTP port | `465` |
| `SMTP_USER` | No | — | SMTP username / address | `noreply@example.com` |
| `SMTP_PASS` | No | — | SMTP password or app-password | `secret` |

> [!TIP]
> `JWT_SECRET`, `ENCRYPTION_KEY`, and `OIDC_JWKS` are automatically generated on first startup if left blank. You never need to generate them by hand.

---

## 🌐 Trusted Redirect Domains (`?rd=`)

When navigating to protected services, Situla Auth safely redirects the user back after authentication via the `?rd=` parameter.

1. **Automatic Trust Roots**:
   - Both `COOKIE_DOMAIN` (e.g., `*.example.com`) and `RP_ID` (e.g., `auth.example.com`) are automatically trusted.
2. **Additional Trust Roots (`TRUSTED_DOMAINS`)**:
   - Provide a comma-separated list of roots (e.g., `TRUSTED_DOMAINS=company.internal,partner.org`). All subdomains under these roots are permitted automatically.
3. **Phishing Interception**:
   - Any redirection target outside the trusted roots is immediately stopped by the **Untrusted Redirect Interceptor** (`warning.html`), displaying the destination domain and administrative whitelist instructions.

---

## 🛡️ Nginx Proxy Manager (NPM) Integration

### Built-in Interactive Generator (Recommended)

Situla Auth features an interactive **Nginx Proxy Manager Config Generator** directly inside the Admin Console:

1. Open your Situla Auth Admin Console (`https://auth.example.com/admin`).
2. Click **NPM Generator** in the navigation bar.
3. Select your authentication scheme:
   - **Simple Web Protection**: Blocks unauthorized visitors without forwarding credentials.
   - **Username SSO**: Injects `Remote-User` header for applications matching usernames (e.g., FreshRSS, Audiobookshelf).
   - **Email SSO**: Injects `Remote-Email` header for applications matching emails (e.g., Beszel, Grafana).
4. Specify bypass paths (e.g., API webhooks or mobile endpoints) and onion links if desired.
5. Click **Copy Configuration** and paste it directly into your NPM Host's **Advanced** tab!

### Minimal Base Nginx Configuration

If you prefer configuring NPM manually, place the following block in your NPM Proxy Host's **Advanced** tab:

```nginx
# 1. Forward Auth validation route
location /_auth {
    internal;
    proxy_pass http://situla-auth:3000/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
}

# 2. Redirect unauthenticated visitors to login
error_page 401 = @error401;
location @error401 {
    return 302 https://auth.example.com/?rd=https://$http_host$request_uri;
}

# 3. Guard the main application
location / {
    auth_request /_auth;

    proxy_pass $forward_scheme://$server:$port;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> [!IMPORTANT]
> Ensure both your `situla-auth` container and Nginx Proxy Manager container share the same Docker network (e.g., `npm_default`) so NPM can reach `http://situla-auth:3000`.

---

## 🔐 OIDC Provider (OpenID Connect)

Situla Auth includes a built-in OpenID Connect Identity Provider supporting the Authorization Code Flow with PKCE.

### Discovery Metadata
Available upon deployment at:
```
https://<your-auth-domain>/oidc/.well-known/openid-configuration
```

### Supported Scopes & Claims
- `openid`: `sub` (User ID)
- `profile`: `preferred_username`, `name`
- `email`: `email`, `email_verified`

### Integrating Applications

Applications like Grafana or Gitea can be registered directly through the **OIDC Management** panel in the Situla Auth Admin Console or configured in `.env` via `OIDC_CLIENTS`.

**Grafana Configuration Example** (`grafana.ini`):
```ini
[auth.generic_oauth]
enabled = true
name = Situla Auth
client_id = grafana
client_secret = your-client-secret
scopes = openid profile email
auth_url = https://auth.example.com/oidc/auth
token_url = https://auth.example.com/oidc/token
api_url = https://auth.example.com/oidc/userinfo
```

---

## 🔄 Maintenance & Updates

### Applying Updates

| Type of Change | Command Required |
|---|---|
| Modifying `.env` configuration | `docker compose restart` |
| Updating backend or frontend code (`public/`, `services/`, `server.js`) | `docker compose up -d --build` |
| Running full deployment & health check | `bash deploy.sh` |

> [!WARNING]
> Because frontend assets in `public/` and server dependencies are compiled into the container, a plain `restart` will not pick up code changes. Always use `docker compose up -d --build` or `bash deploy.sh` when pulling new code.

### Data Persistence & Hot Backups

- **Persistence**: All SQLite data is stored on the host at `./data/database.sqlite` and mounted into `/app/data` inside the container. It persists across image rebuilds.
- **Automated Snapshots**: Running `bash deploy.sh` automatically creates timestamped backups in `./data/database.sqlite.bak_YYYYMMDD_HHMMSS` before performing rebuilds.

---

## 📄 License

This project is licensed under the **AGPL-3.0 License**. See the [LICENSE](LICENSE) file for details.
