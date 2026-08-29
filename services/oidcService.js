/*
 * Situla Auth 2.0 - OIDC Client Management Service
 */
'use strict';

const crypto = require('crypto');
const db = require('../core/database');
const { encrypt, decrypt } = require('../core/crypto');

class OidcService {
    static async listClients() {
        const rows = await db.all(
            'SELECT id, client_id, client_name, redirect_uris, created_at FROM oidc_clients ORDER BY id DESC'
        );
        return rows.map(r => {
            let uris = [];
            try { uris = JSON.parse(r.redirect_uris || '[]'); } catch (e) {}
            return { ...r, redirect_uris: uris };
        });
    }

    static async createClient(clientName, redirectUris) {
        const client_id = 'client_' + crypto.randomBytes(8).toString('hex');
        const client_secret = crypto.randomBytes(32).toString('base64url');
        const encryptedSecret = encrypt(client_secret);

        await db.run(
            'INSERT INTO oidc_clients (client_id, client_secret_enc, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?, ?)',
            [client_id, encryptedSecret, clientName, JSON.stringify(redirectUris), new Date().toISOString()]
        );

        return {
            client_id,
            client_secret,
            client_name: clientName,
            redirect_uris: redirectUris
        };
    }

    static async deleteClient(id) {
        const result = await db.run('DELETE FROM oidc_clients WHERE id = ?', [id]);
        return result.changes > 0;
    }

    /**
     * Used by oidc-provider to resolve clients dynamically from SQLite
     */
    static async findClient(clientId) {
        const row = await db.get(
            'SELECT client_id, client_secret_enc, client_name, redirect_uris FROM oidc_clients WHERE client_id = ?',
            [clientId]
        );
        if (!row) return null;

        const clientSecret = decrypt(row.client_secret_enc);
        let redirectUris = [];
        try {
            redirectUris = JSON.parse(row.redirect_uris || '[]');
        } catch (e) {}

        return {
            client_id: row.client_id,
            client_secret: clientSecret,
            client_name: row.client_name,
            redirect_uris: redirectUris,
            response_types: ['code'],
            grant_types: ['authorization_code', 'refresh_token'],
            token_endpoint_auth_method: 'client_secret_basic'
        };
    }
}

module.exports = OidcService;
