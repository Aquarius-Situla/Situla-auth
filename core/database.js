/*
 * Situla Auth 2.0 - Core Database Client
 * Promise-based SQLite Client with Transaction and Migration support.
 */
'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseClient {
    constructor(customPath) {
        this.dbPath = customPath || process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
        
        if (this.dbPath !== ':memory:') {
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
        }
        
        this.db = new sqlite3.Database(this.dbPath);
        this.initPromise = this._initSchema();
    }

    async ready() {
        return this.initPromise;
    }

    _initSchema() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('PRAGMA journal_mode = WAL');
                this.db.run('PRAGMA foreign_keys = ON');

                this.db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE,
                    password TEXT,
                    totp_secret TEXT,
                    email TEXT DEFAULT '',
                    token_version INTEGER DEFAULT 0,
                    totp_pending_secret TEXT DEFAULT '',
                    two_fa_method TEXT DEFAULT NULL
                )`);

                this.db.run(`CREATE TABLE IF NOT EXISTS passkeys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    credential_id TEXT,
                    public_key TEXT,
                    counter INTEGER,
                    name TEXT DEFAULT '通行密钥',
                    created_at TEXT DEFAULT '',
                    type TEXT DEFAULT 'passkey',
                    transports TEXT DEFAULT '[]',
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )`);

                this.db.run(`CREATE TABLE IF NOT EXISTS recovery_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    code_hash TEXT,
                    used INTEGER DEFAULT 0,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )`);

                this.db.run(`CREATE TABLE IF NOT EXISTS oidc_store (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    granted_at INTEGER,
                    consumed_at INTEGER,
                    expires_at INTEGER,
                    uid TEXT,
                    user_code TEXT,
                    grant_id TEXT
                )`);
                this.db.run(`CREATE INDEX IF NOT EXISTS oidc_store_uid ON oidc_store(uid)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS oidc_store_user_code ON oidc_store(user_code)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS oidc_store_grant_id ON oidc_store(grant_id)`);

                this.db.run(`CREATE TABLE IF NOT EXISTS login_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    ip TEXT,
                    location TEXT,
                    device TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )`);

                this.db.run(`CREATE TABLE IF NOT EXISTS revoked_tokens (
                    jti TEXT PRIMARY KEY,
                    expires_at INTEGER NOT NULL
                )`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_revoked_tokens_exp ON revoked_tokens(expires_at)`);

                this.db.run(`CREATE TABLE IF NOT EXISTS oidc_clients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id TEXT UNIQUE,
                    client_secret_enc TEXT,
                    client_name TEXT,
                    redirect_uris TEXT,
                    created_at TEXT
                )`, (err) => {
                    if (err) return reject(err);
                    // Safe column migrations for existing databases
                    this._runSafeMigrations()
                        .then(resolve)
                        .catch(reject);
                });
            });
        });
    }

    async _runSafeMigrations() {
        const migrations = [
            `ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`,
            `ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0`,
            `ALTER TABLE users ADD COLUMN totp_pending_secret TEXT DEFAULT ''`,
            `ALTER TABLE users ADD COLUMN two_fa_method TEXT DEFAULT NULL`,
            `ALTER TABLE passkeys ADD COLUMN name TEXT DEFAULT '通行密钥'`,
            `ALTER TABLE passkeys ADD COLUMN created_at TEXT DEFAULT ''`,
            `ALTER TABLE passkeys ADD COLUMN type TEXT DEFAULT 'passkey'`,
            `ALTER TABLE passkeys ADD COLUMN transports TEXT DEFAULT '[]'`
        ];

        for (const sql of migrations) {
            await new Promise((res) => {
                this.db.run(sql, () => res()); // safely ignore if column already exists
            });
        }
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    async transaction(action) {
        await this.run('BEGIN TRANSACTION');
        try {
            const result = await action(this);
            await this.run('COMMIT');
            return result;
        } catch (err) {
            await this.run('ROLLBACK');
            throw err;
        }
    }
}

const defaultClient = new DatabaseClient();

module.exports = defaultClient;
module.exports.DatabaseClient = DatabaseClient;
