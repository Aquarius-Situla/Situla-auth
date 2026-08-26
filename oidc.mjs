/*
 * Situla Auth 2.0 - OIDC Provider Module
 * Copyright (C) 2026 Situla
 *
 * This file is intentionally written as ESM because oidc-provider is ESM-only.
 * It is dynamically imported from server.js (CommonJS) via import().
 */

import { createRequire } from "module";
import { Provider } from "oidc-provider";

// Bridge: use require() inside ESM to access CommonJS modules
const require = createRequire(import.meta.url);
const db = require("./database.js");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

/* MARK: SQLite Adapter */
class SQLiteAdapter {
    constructor(name) { this.name = name; }
    _run(sql, p=[]) { return new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res(this)})); }
    _get(sql, p=[]) { return new Promise((res,rej)=>db.get(sql,p,(e,r)=>{e?rej(e):res(r)})); }

    async upsert(id, payload, expiresIn) {
        const expiresAt = expiresIn ? Math.floor(Date.now()/1000)+expiresIn : null;
        await this._run(
            `INSERT INTO oidc_store (id,type,payload,granted_at,consumed_at,expires_at,uid,user_code,grant_id)
             VALUES (?,?,?,?,?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,granted_at=excluded.granted_at,
             consumed_at=excluded.consumed_at,expires_at=excluded.expires_at,uid=excluded.uid,
             user_code=excluded.user_code,grant_id=excluded.grant_id`,
            [id, this.name, JSON.stringify(payload),
             payload.grantedAt ? Math.floor(payload.grantedAt/1000) : null,
             payload.consumed ? Math.floor(Date.now()/1000) : null,
             expiresAt, payload.uid||null, payload.userCode||null, payload.grantId||null]
        );
    }

    async find(id) {
        const row = await this._get(
            `SELECT payload,consumed_at FROM oidc_store WHERE id=? AND type=? AND (expires_at IS NULL OR expires_at>?)`,
            [id, this.name, Math.floor(Date.now()/1000)]
        );
        if (!row) return undefined;
        const p = JSON.parse(row.payload);
        if (row.consumed_at) p.consumed = true;
        return p;
    }

    async findByUserCode(userCode) {
        const row = await this._get(
            `SELECT payload,consumed_at FROM oidc_store WHERE user_code=? AND type=? AND (expires_at IS NULL OR expires_at>?)`,
            [userCode, this.name, Math.floor(Date.now()/1000)]
        );
        if (!row) return undefined;
        const p = JSON.parse(row.payload);
        if (row.consumed_at) p.consumed = true;
        return p;
    }

    async findByUid(uid) {
        const row = await this._get(
            `SELECT payload,consumed_at FROM oidc_store WHERE uid=? AND type=? AND (expires_at IS NULL OR expires_at>?)`,
            [uid, this.name, Math.floor(Date.now()/1000)]
        );
        if (!row) return undefined;
        const p = JSON.parse(row.payload);
        if (row.consumed_at) p.consumed = true;
        return p;
    }

    async consume(id) {
        await this._run(`UPDATE oidc_store SET consumed_at=? WHERE id=? AND type=?`,
            [Math.floor(Date.now()/1000), id, this.name]);
    }

    async destroy(id) {
        await this._run(`DELETE FROM oidc_store WHERE id=? AND type=?`, [id, this.name]);
    }

    async revokeByGrantId(grantId) {
        await this._run(`DELETE FROM oidc_store WHERE grant_id=?`, [grantId]);
    }
}

/* MARK: JWKS Key Management */
function loadOrGenerateJWKS() {
    // Resolve .env path robustly for Windows
    const dir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const envPath = path.join(dir, ".env");
    let raw = process.env.OIDC_JWKS;

    if (!raw) {
        console.log("[OIDC] No OIDC_JWKS found — generating RSA-2048 signing key...");
        const { privateKey } = crypto.generateKeyPairSync("rsa", {
            modulusLength: 2048,
            publicKeyEncoding:  { type: "spki",  format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });
        const jwk = crypto.createPrivateKey(privateKey).export({ format: "jwk" });
        jwk.kid = crypto.randomBytes(8).toString("hex");
        jwk.use = "sig";
        jwk.alg = "RS256";
        raw = JSON.stringify({ keys: [jwk] });
        try {
            let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
            if (env.length && !env.endsWith("\n")) env += "\n";
            env += `OIDC_JWKS=${raw}\n`;
            fs.writeFileSync(envPath, env, "utf8");
            console.log("[OIDC] OIDC_JWKS written to .env for persistence.");
        } catch (e) {
            console.warn("[OIDC] Could not write OIDC_JWKS to .env:", e.message);
        }
        process.env.OIDC_JWKS = raw;
    }
    return JSON.parse(raw);
}

/* MARK: Account finder */
async function findAccount(ctx, id) {
    return new Promise((resolve) => {
        db.get("SELECT id, username, email FROM users WHERE id=?", [id], (err, user) => {
            if (err || !user) return resolve(undefined);
            resolve({
                accountId: String(user.id),
                async claims(use, scope) {
                    const c = { sub: String(user.id) };
                    if (scope.includes("profile")) { c.preferred_username = user.username; c.name = user.username; }
                    if (scope.includes("email"))   { c.email = user.email || ""; c.email_verified = !!(user.email); }
                    return c;
                },
            });
        });
    });
}

/* MARK: Load registered clients from env */
function loadClients() {
    const raw = process.env.OIDC_CLIENTS;
    if (!raw) { console.warn("[OIDC] OIDC_CLIENTS not set — no client apps registered."); return []; }
    try {
        const clients = JSON.parse(raw);
        console.log(`[OIDC] Loaded ${clients.length} client(s):`, clients.map(c => c.client_id).join(", "));
        return clients;
    } catch (e) {
        console.error("[OIDC] Failed to parse OIDC_CLIENTS:", e.message);
        return [];
    }
}

/* MARK: Provider */
const issuer  = process.env.OIDC_ISSUER || `https://${process.env.RP_ID || "localhost"}/oidc`;
const jwks    = loadOrGenerateJWKS();

const provider = new Provider(issuer, {
    adapter:     SQLiteAdapter,
    clients:     loadClients(),
    jwks,
    scopes:      ["openid", "profile", "email"],
    claims: {
        openid:  ["sub"],
        profile: ["preferred_username", "name"],
        email:   ["email", "email_verified"],
    },
    findAccount,
    features: {
        devInteractions: { enabled: false },
    },
    ttl: {
        AccessToken:       1 * 60 * 60,
        AuthorizationCode: 10 * 60,
        IdToken:           1 * 60 * 60,
        RefreshToken:      14 * 24 * 60 * 60,
        Session:           14 * 24 * 60 * 60,
    },
    interactions: {
        url: (ctx, interaction) => `/oidc/interaction/${interaction.uid}`,
    },
    cookies: {
        keys: [process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex")],
        short: { sameSite: "lax" },
        long:  { sameSite: "lax" },
    },
    responseTypes: ["code"],
});

// Trust X-Forwarded-* headers from Nginx Proxy Manager
provider.proxy = true;

// Purge expired tokens every 30 minutes
setInterval(() => {
    db.run(`DELETE FROM oidc_store WHERE expires_at IS NOT NULL AND expires_at<?`,
        [Math.floor(Date.now()/1000)]);
}, 30 * 60 * 1000);

export default provider;