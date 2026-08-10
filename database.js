/*
 * Situla Auth 2.0
 * Copyright (C) 2026 Situla
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(path.join(dbDir, 'database.sqlite'));

db.serialize(() => {
    // Optimization and data integrity
    db.run(`PRAGMA journal_mode = WAL`);
    db.run(`PRAGMA foreign_keys = ON`);

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
    db.run(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN totp_pending_secret TEXT DEFAULT ''`, () => {});
    db.run(`ALTER TABLE passkeys ADD COLUMN name TEXT DEFAULT '通行密钥'`, () => {});
    db.run(`ALTER TABLE passkeys ADD COLUMN created_at TEXT DEFAULT ''`, () => {});

});

module.exports = db;
