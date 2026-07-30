# Situla Auth 2.0

A lightweight, Apple-style authentication portal supporting Passkeys (WebAuthn), TOTP (2FA), and standard password login. Designed to be deployed with Nginx Proxy Manager as a Forward Auth provider.

## Features

- **Passkey (WebAuthn)**: Passwordless login via Face ID, Touch ID, Windows Hello, or hardware keys.
- **Two-Factor Authentication**: TOTP support (Google Authenticator, iOS Passwords, etc.)
- **Recovery Codes**: One-time backup codes when 2FA device is unavailable.
- **Account Management**: Change username, password, manage Passkeys, generate recovery codes.
- **Apple UI**: Clean, fluid interface following iOS/macOS design language. Supports dark mode.
- **Forward Auth**: Acts as an auth shield for Nginx Proxy Manager (`/verify` endpoint).

## Quick Start

```bash
# 1. Clone and enter the directory
git clone git@github.com:Aquarius-Situla/Situla-auth.git
cd Situla-auth

# 2. One-click deploy (handles Docker, network, .env setup)
bash deploy.sh
```

## Manual Setup

```bash
# Copy and edit the config file
cp .env.example .env
nano .env

# Create the data directory (persists the SQLite database)
mkdir -p data

# Build and start
docker compose up -d --build
```

## Configuration (`.env`)

| Variable        | Description                                              | Example                    |
|-----------------|----------------------------------------------------------|----------------------------|
| `ADMIN_USER`    | Login username                                           | `admin`                    |
| `ADMIN_PASS`    | Login password                                           | `mysecretpassword`         |
| `JWT_SECRET`    | Cookie signing secret. **Auto-generated** if left blank. | *(leave blank)*            |
| `COOKIE_DOMAIN` | Domain scope for the session cookie                      | `.aquarius2009.me`         |
| `RP_ID`         | WebAuthn Relying Party ID (your auth page hostname)      | `auth.aquarius2009.me`     |
| `PORT`          | Internal port (default: `3000`)                          | `3000`                     |

> **Note:** `JWT_SECRET` is automatically generated and written to `.env` on first startup if not set.

## Nginx Proxy Manager Setup

1. Add a new **Proxy Host**:
   - Forward Hostname: `situla-auth`
   - Forward Port: `3000`
   - Forward Scheme: `http`
2. For services you want to protect, enable **Forward Auth** with URL: `http://situla-auth:3000/verify`

Both `situla-auth` and your NPM container must be on the same Docker network (`npm_default`).

## Development & Updates

### Applying changes

| What changed                                | Command needed                     |
|---------------------------------------------|------------------------------------|
| `.env` config only                          | `docker compose restart`           |
| Backend code (`server.js`, `database.js`)   | `docker compose up -d --build`     |
| Frontend files (`public/` — HTML/CSS/JS)    | `docker compose up -d --build`     |
| New npm dependency (`package.json`)         | `docker compose up -d --build`     |

> Static files in `public/` are baked into the Docker image at build time.  
> A plain `restart` only restarts the Node process — it does **not** pick up changes to source files.  
> Always use `--build` after modifying any source code or frontend assets.

### Data persistence

The SQLite database is stored at `./data/database.sqlite` on the host and mounted into the container as a volume. It survives image rebuilds automatically.
