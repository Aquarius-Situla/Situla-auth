# 🔐 Situla Auth 2.0

[![License](https://img.shields.io/badge/License-AGPL%203.0-blue?style=flat&logo=open-source-initiative)](https://github.com/Aquarius-Situla/Situla-auth/blob/main/LICENSE) [![Node.js](https://img.shields.io/badge/Powered_by-Node.js-339933?style=flat&logo=node.js)](https://nodejs.org/) [![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=flat&logo=docker)](https://www.docker.com/) [![Nginx Proxy Manager](https://img.shields.io/badge/NPM-Forward_Auth-009639?style=flat&logo=nginx)](https://nginxproxymanager.com/)

A lightweight, Apple-style authentication portal supporting Passkeys (WebAuthn), TOTP (2FA), and standard password login. Designed to be deployed with Nginx Proxy Manager as a Forward Auth provider.

---

## ✨ Features

- **Passkey (WebAuthn)**: Passwordless login via Face ID, Touch ID, Windows Hello, or hardware keys.
- **Two-Factor Authentication**: TOTP support (Google Authenticator, iOS Passwords, etc.)
- **Recovery Codes**: One-time backup codes when 2FA device is unavailable.
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

| Variable        | Description                                              | Example                    |
|-----------------|----------------------------------------------------------|----------------------------|
| `ADMIN_USER`    | Default login username                                   | `admin`                    |
| `ADMIN_PASS`    | Default login password                                   | `mysecretpassword`         |
| `JWT_SECRET`    | Cookie signing secret. **Auto-generated** if left blank. | *(leave blank)*            |
| `COOKIE_DOMAIN` | Domain scope for the session cookie                      | `.example.com`             |
| `RP_ID`         | WebAuthn Relying Party ID (your auth page hostname)      | `auth.example.com`         |
| `PORT`          | Internal port (default: `3000`)                          | `3000`                     |

> [!NOTE]
> `JWT_SECRET` is automatically generated and written to `.env` on first startup if not set manually.

---

## 🛡️ Nginx Proxy Manager Setup

1. Add a new **Proxy Host** for your protected service.
2. Go to the **Advanced** tab and use the `auth_request` configuration to point to Situla Auth.

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
