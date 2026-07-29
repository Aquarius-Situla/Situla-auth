const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(path.join(dbDir, 'database.sqlite'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        totp_secret TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS passkeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        credential_id TEXT,
        public_key TEXT,
        counter INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS recovery_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        code_hash TEXT,
        used INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Migrations: add columns if they don't exist yet (errors are safely ignored)
    db.run(`ALTER TABLE passkeys ADD COLUMN name TEXT DEFAULT '通行密钥'`, () => {});
    db.run(`ALTER TABLE passkeys ADD COLUMN created_at TEXT DEFAULT ''`, () => {});

});

module.exports = db;
