/*
 * Situla Auth 2.0 - Core Crypto Utilities
 * Secure AES-256-GCM encryption, key derivation, and random tokens.
 */
'use strict';

const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
const JWT_SECRET = process.env.JWT_SECRET || 'situla_jwt_secret_placeholder_must_be_overridden';

function getEncryptionKeyBuffer() {
    const keyHex = process.env.ENCRYPTION_KEY || ENCRYPTION_KEY;
    try {
        const buf = Buffer.from(keyHex, 'hex');
        if (buf.length === 32) return buf;
    } catch (e) {}
    // If not a 32-byte hex, derive 32 bytes using SHA-256
    return crypto.createHash('sha256').update(String(keyHex)).digest();
}

/**
 * Encrypt a string with AES-256-GCM.
 * Format: enc:iv_base64:authTag_base64:cipher_base64
 */
function encrypt(text) {
    if (!text || typeof text !== 'string') return text;
    if (text.startsWith('enc:')) return text; // already encrypted
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKeyBuffer(), iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
    } catch (e) {
        console.error('[Crypto] Encryption error:', e.message);
        throw e;
    }
}

/**
 * Decrypt a string with AES-256-GCM.
 */
function decrypt(text) {
    if (!text || typeof text !== 'string' || !text.startsWith('enc:')) return text;
    try {
        const parts = text.split(':');
        if (parts.length !== 4) throw new Error('Invalid encrypted format');
        const iv = Buffer.from(parts[1], 'base64');
        const authTag = Buffer.from(parts[2], 'base64');
        const ciphertext = Buffer.from(parts[3], 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKeyBuffer(), iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        console.error('[Crypto] Decryption error:', e.message);
        return null;
    }
}

function sha256(str) {
    return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function randomHex(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

function randomBase64Url(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}

function hmacSha256(key, data) {
    const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf8') : key;
    return crypto.createHmac('sha256', keyBuf).update(String(data)).digest('hex');
}

const INSECURE_JWT_PLACEHOLDERS = [
    'situla_jwt_secret_placeholder_must_be_overridden',
    'default_jwt_secret',
    'secret'
];
const INSECURE_ENC_KEYS = [
    '0000000000000000000000000000000000000000000000000000000000000000'
];

function assertProductionKeySecurity(jwtSecret, encKey) {
    if (process.env.NODE_ENV === 'production') {
        const jSecret = jwtSecret || process.env.JWT_SECRET || '';
        const eKey = encKey || process.env.ENCRYPTION_KEY || '';

        if (!jSecret || INSECURE_JWT_PLACEHOLDERS.includes(jSecret)) {
            console.error('[CRITICAL SECURITY ERROR] Production mode cannot start with default or empty JWT_SECRET!');
            process.exit(1);
        }
        if (!eKey || INSECURE_ENC_KEYS.includes(eKey)) {
            console.error('[CRITICAL SECURITY ERROR] Production mode cannot start with default or empty ENCRYPTION_KEY!');
            process.exit(1);
        }
    }
}

module.exports = {
    encrypt,
    decrypt,
    sha256,
    hmacSha256,
    assertProductionKeySecurity,
    randomHex,
    randomBase64Url,
    JWT_SECRET,
    ENCRYPTION_KEY
};

