/**
 * tests/smoke-test.js
 * Fast standalone smoke tests for Situla Auth container.
 * Can be executed inside the container: node tests/smoke-test.js
 */
'use strict';

const http = require('http');
const db = require('../database');

let failed = 0;
let passed = 0;

function assert(condition, name) {
    if (condition) {
        console.log(`  ✅ [PASS] ${name}`);
        passed++;
    } else {
        console.error(`  ❌ [FAIL] ${name}`);
        failed++;
    }
}

async function runTests() {
    console.log('\n🔍 === Situla Auth Container Smoke Tests ===\n');

    // 1. Database Tables Integrity Test
    console.log('📌 1. Database Table Verification:');
    const expectedTables = ['users', 'passkeys', 'recovery_codes', 'oidc_store', 'login_logs', 'oidc_clients'];

    for (const table of expectedTables) {
        await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM ${table}`, [], (err, row) => {
                assert(!err && row !== undefined, `Table exists: ${table}`);
                resolve();
            });
        });
    }

    // 2. HTTP Health Endpoint Check
    console.log('\n📌 2. HTTP Health Endpoint Check:');
    await new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:3000/api/health', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                assert(res.statusCode === 200, `GET /api/health returned 200 OK (got ${res.statusCode})`);
                try {
                    const json = JSON.parse(data);
                    assert(json.status === 'healthy', `Health JSON status is healthy (got '${json.status}')`);
                    assert(json.db === 'connected', `Database status in health JSON is connected (got '${json.db}')`);
                } catch (e) {
                    assert(false, `Health response is valid JSON: ${e.message}`);
                }
                resolve();
            });
        });
        req.on('error', (e) => {
            assert(false, `HTTP connection to /api/health failed: ${e.message}`);
            resolve();
        });
    });

    // 3. Static Pages & Core Routes Check
    console.log('\n📌 3. Core Route Availability:');
    const routesToCheck = [
        { path: '/login', expectedStatus: [200, 302] },
        { path: '/admin', expectedStatus: [200, 302] },
        { path: '/verify', expectedStatus: [401] }, // Unauthorized without cookie is expected
        { path: '/oidc/.well-known/openid-configuration', expectedStatus: [200] },
    ];

    for (const route of routesToCheck) {
        await new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:3000${route.path}`, (res) => {
                assert(route.expectedStatus.includes(res.statusCode), `Route ${route.path} responds with expected code ${route.expectedStatus.join('/')} (got ${res.statusCode})`);
                resolve();
            });
            req.on('error', (e) => {
                assert(false, `Route ${route.path} failed to connect: ${e.message}`);
                resolve();
            });
        });
    }

    // Summary
    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
});
