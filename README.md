# Situla Auth 2.0

A lightweight, Apple-style authentication portal supporting Passkeys (WebAuthn), TOTP (2FA), and standard password login. Designed to be deployed with Nginx Proxy Manager as a Forward Auth provider for securing existing web services like Homepage.

## Features
- **Passkey Support**: Secure, passwordless login using biometrics (Face ID, Touch ID, Windows Hello).
- **Two-Factor Authentication (2FA)**: TOTP support via apps like Google Authenticator or iOS Passwords.
- **Apple UI Aesthetics**: A clean, fluid interface mimicking iOS/macOS design language.
- **Forward Auth (auth_request)**: Acts as an invisible authentication shield layer for Nginx.

Please see the root `README.md` for full Nginx Proxy Manager configuration instructions, including how to integrate this alongside Onion-Location and WebSockets.
