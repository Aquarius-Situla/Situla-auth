/**
 * ==============================================================================
 * SCRIPT       : tests/smoke-test.js
 * MODULE       : Situla-Auth / In-Container Self-Check Suite
 * PURPOSE      : 容器内部白盒冒烟测试。全方位验证 SQLite 状态、存储卷写权限、
 *                内部 HTTP 健康探针、OIDC 协议发现端点及密码学引擎完整性。
 * AUTHOR       : Infrastructure & DevOps Team (30-Year Ops Standard)
 * CREATED_AT   : 2026-08-29
 * EXIT CODES   : 0 = ALL PASS, 1 = ONE OR MORE ASSERTIONS FAILED
 * DEPENDENCIES : node >= 18, sqlite3 (internal), core modules
 * USAGE        : node tests/smoke-test.js
 * ==============================================================================
 */
'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { encrypt, decrypt, randomHex } = require('../core/crypto');

let failed = 0;
let passed = 0;
const failures = [];

/**
 * 统一断言函数，记录通过/失败状态并提供上下文
 * @param {boolean} condition - 断言条件
 * @param {string} name - 测试用例名称
 * @param {string} [hint] - 失败时的排查线索
 */
function assert(condition, name, hint = '') {
    if (condition) {
        console.log(`  ✅ [PASS] ${name}`);
        passed++;
    } else {
        console.error(`  ❌ [FAIL] ${name}`);
        if (hint) {
            console.error(`     ↳ 💡 [Troubleshooting Hint]: ${hint}`);
        }
        failed++;
        failures.push({ name, hint });
    }
}

/**
 * 辅助工具：带超时的 HTTP GET 请求封装
 * @param {string} url - 目标请求地址
 * @param {number} timeoutMs - 超时毫秒数
 * @returns {Promise<{ statusCode: number, headers: object, data: string }>}
 */
function fetchWithTimeout(url, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                data
            }));
        });

        req.on('error', (err) => reject(err));
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
        });
    });
}

/**
 * 核心冒烟测试执行器
 */
async function runSmokeTests() {
    const startTime = Date.now();
    console.log('============================================================');
    console.log('  🔍 SITULA-AUTH IN-CONTAINER SMOKE TEST SUITE');
    console.log(`  🕒 Timestamp : ${new Date().toISOString()}`);
    console.log(`  ⚙️  Node Ver   : ${process.version} | PID: ${process.pid} | UID: ${typeof process.getuid === 'function' ? process.getuid() : 'N/A'}`);
    console.log('============================================================\n');

    // --------------------------------------------------------------------------
    // SECTION 1: DATABASE INTEGRITY & WAL MODE
    // --------------------------------------------------------------------------
    // [PURPOSE] 确保 SQLite 数据库正常初始化、WAL 模式开启、外键约束生效且核心表已就绪
    // [ASSERTION] 核心 6 张表 COUNT(*) 查询无报错且能够返回数据
    console.log('📌 [SECTION 1] SQLite Database & Schema Verification');
    await db.ready();

    // 1.1 PRAGMA 运行时检查
    await new Promise((resolve) => {
        db.get('PRAGMA journal_mode', [], (err, row) => {
            const mode = row ? Object.values(row)[0] : '';
            assert(!err && (mode === 'wal' || mode === 'memory'), `SQLite PRAGMA journal_mode is WAL (got '${mode}')`, '请检查 core/database.js 中的 journal_mode 设置');
            resolve();
        });
    });

    await new Promise((resolve) => {
        db.get('PRAGMA foreign_keys', [], (err, row) => {
            const fk = row ? Object.values(row)[0] : 0;
            assert(!err && fk === 1, `SQLite PRAGMA foreign_keys is ENABLED (got ${fk})`, '外键约束未开启可能导致关联数据孤立');
            resolve();
        });
    });

    // 1.2 核心业务表完整性验证
    const expectedTables = [
        'users',
        'passkeys',
        'recovery_codes',
        'oidc_store',
        'login_logs',
        'oidc_clients'
    ];

    for (const table of expectedTables) {
        await new Promise((resolve) => {
            db.get(`SELECT COUNT(*) as cnt FROM ${table}`, [], (err, row) => {
                assert(!err && row !== undefined && typeof row.cnt === 'number', `Database table exists & queryable: '${table}' (rows: ${row ? row.cnt : 'ERR'})`, `表 ${table} 缺失或损坏，请检查 database migration 逻辑`);
                resolve();
            });
        });
    }

    // 1.3 初始数据 Seed 验证 (至少存在初始管理员)
    await new Promise((resolve) => {
        db.get('SELECT COUNT(*) as admin_count FROM users', [], (err, row) => {
            assert(!err && row && row.admin_count > 0, `Initial admin seed present in 'users' (count: ${row ? row.admin_count : 0})`, '用户表为空，server.js 中的 admin seed 逻辑可能未执行');
            resolve();
        });
    });

    // --------------------------------------------------------------------------
    // SECTION 2: STORAGE & VOLUME WRITE PERMISSIONS
    // --------------------------------------------------------------------------
    // [PURPOSE] 验证容器进程在非 root 身份下对持久化数据目录拥有可读可写权限
    // [ASSERTION] 在 /app/data 中创建、写入、读取、删除临时探针文件均成功
    console.log('\n📌 [SECTION 2] Storage Volume & Data Directory Writability');
    const dataDir = path.join(__dirname, '../data');
    const testProbeFile = path.join(dataDir, `.smoke_write_probe_${Date.now()}`);
    const probePayload = `smoke_test_payload_${randomHex(8)}`;

    try {
        fs.writeFileSync(testProbeFile, probePayload, 'utf8');
        const readBack = fs.readFileSync(testProbeFile, 'utf8');
        fs.unlinkSync(testProbeFile);
        assert(readBack === probePayload, 'Data directory (/app/data) write & read & delete probe succeeded', '容器对 ./data 目录无写权限，请检查宿主机目录属主是否为 UID 1000 (node)');
    } catch (e) {
        assert(false, `Data directory writability check failed: ${e.message}`, '文件写入失败，可能是宿主机挂载了只读卷或权限不足');
    }

    // --------------------------------------------------------------------------
    // SECTION 3: HTTP HEALTH ENDPOINT & JSON CONTRACT
    // --------------------------------------------------------------------------
    // [PURPOSE] 验证 Express 服务已绑定 3000 端口，且 /api/health 输出符合运维健康契约
    // [ASSERTION] HTTP 200, status='healthy', db='connected', uptime >= 0
    console.log('\n📌 [SECTION 3] HTTP Health Endpoint & API Contract Check');
    try {
        const res = await fetchWithTimeout('http://127.0.0.1:3000/api/health', 3000);
        assert(res.statusCode === 200, `GET /api/health returned 200 OK (got ${res.statusCode})`, '健康检查端点未返回 200，请检查 server.js 监听状态');

        let json = null;
        try {
            json = JSON.parse(res.data);
            assert(true, 'Health response payload is valid JSON');
        } catch (e) {
            assert(false, `Health response is invalid JSON: ${e.message}`, '接口输出非标准 JSON');
        }

        if (json) {
            assert(json.status === 'healthy', `Health JSON status is 'healthy' (got '${json.status}')`, '服务状态异常');
            assert(json.db === 'connected', `Database connection status is 'connected' (got '${json.db}')`, '健康检查探测数据库连接失败');
            assert(typeof json.uptime === 'number' && json.uptime >= 0, `Process uptime is valid numeric value (${json.uptime}s)`);
        }
    } catch (e) {
        assert(false, `HTTP connection to /api/health failed: ${e.message}`, '无法连接到 127.0.0.1:3000，服务未监听或端口被占用');
    }

    // --------------------------------------------------------------------------
    // SECTION 4: CORE AUTH & OIDC PROTOCOL ENDPOINTS
    // --------------------------------------------------------------------------
    // [PURPOSE] 验证核心 Web 路由和 OpenID Connect 协议端点能够正常响应且元数据完整
    // [ASSERTION] /login, /admin, /verify(401) 以及 OIDC discovery 元数据包含 issuer
    console.log('\n📌 [SECTION 4] Core Auth & OIDC Protocol Endpoints Check');
    const routesToCheck = [
        { path: '/login', expectedStatus: [200, 302], desc: 'Login portal UI' },
        { path: '/admin', expectedStatus: [200, 302], desc: 'Admin portal UI' },
        { path: '/verify', expectedStatus: [401], desc: 'NPM Forward-Auth verify endpoint (unauthorized without cookie)' },
        { path: '/oidc/.well-known/openid-configuration', expectedStatus: [200], desc: 'OIDC Discovery Endpoint', isOidcDiscovery: true },
        { path: '/oidc/jwks', expectedStatus: [200], desc: 'OIDC JWKS Public Key Endpoint', isJwks: true },
    ];

    for (const route of routesToCheck) {
        try {
            const res = await fetchWithTimeout(`http://127.0.0.1:3000${route.path}`, 3000);
            const statusOk = route.expectedStatus.includes(res.statusCode);
            assert(statusOk, `Route '${route.path}' (${route.desc}) responds with ${route.expectedStatus.join('/')} (got ${res.statusCode})`, `端点 ${route.path} 响应非预期状态码`);

            // 深度校验 OIDC Discovery JSON
            if (route.isOidcDiscovery && res.statusCode === 200) {
                try {
                    const disc = JSON.parse(res.data);
                    assert(!!disc.issuer, `OIDC Discovery contains valid 'issuer' (${disc.issuer})`, 'OIDC Discovery JSON 缺少 issuer 声明');
                    assert(!!disc.jwks_uri, `OIDC Discovery contains valid 'jwks_uri' (${disc.jwks_uri})`, 'OIDC Discovery JSON 缺少 jwks_uri 声明');
                } catch (e) {
                    assert(false, `OIDC Discovery JSON parsing error: ${e.message}`);
                }
            }

            // 深度校验 OIDC JWKS JSON
            if (route.isJwks && res.statusCode === 200) {
                try {
                    const jwks = JSON.parse(res.data);
                    assert(Array.isArray(jwks.keys), `OIDC JWKS contains valid 'keys' array (count: ${jwks.keys ? jwks.keys.length : 0})`, 'JWKS 缺少公钥集合');
                } catch (e) {
                    assert(false, `OIDC JWKS JSON parsing error: ${e.message}`);
                }
            }
        } catch (e) {
            assert(false, `Route '${route.path}' connection failed: ${e.message}`, `网络异常，无法访问 ${route.path}`);
        }
    }

    // --------------------------------------------------------------------------
    // SECTION 5: CRYPTO & ENCRYPTION ENGINE INTEGRITY
    // --------------------------------------------------------------------------
    // [PURPOSE] 验证应用内置 AES-256-GCM 与密钥生成模块能否正常加解密数据
    // [ASSERTION] 加密后密文格式正确，解密后原文完全一致
    console.log('\n📌 [SECTION 5] Cryptographic & Token Engine Integrity');
    try {
        const plainText = `SmokeTest_Secret_Payload_${randomHex(16)}`;
        const encrypted = encrypt(plainText);
        assert(encrypted && encrypted.startsWith('enc:'), `AES-256-GCM encryption produces valid prefix (${encrypted.substring(0, 15)}...)`);

        const decrypted = decrypt(encrypted);
        assert(decrypted === plainText, 'AES-256-GCM decryption restores original plaintext exactly', '加解密逻辑异常，可能 ENCRYPTION_KEY 格式错误');
    } catch (e) {
        assert(false, `Crypto engine test failed: ${e.message}`, '密码学模块报错，请排查 core/crypto.js');
    }

    // --------------------------------------------------------------------------
    // SUMMARY & EXIT REPORT
    // --------------------------------------------------------------------------
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n============================================================');
    console.log(`  📊 SMOKE TEST SUMMARY : ${passed} Passed, ${failed} Failed (${duration}s)`);
    console.log('============================================================');

    if (failed > 0) {
        console.error(`\n🚨 [FATAL] Smoke tests failed with ${failed} error(s):`);
        failures.forEach((f, idx) => {
            console.error(`  ${idx + 1}. ${f.name}`);
            if (f.hint) console.error(`     ↳ Hint: ${f.hint}`);
        });
        console.error('\n❌ Container is NOT ready for production traffic. Exiting with code 1.\n');
        process.exit(1);
    } else {
        console.log('\n🎉 [SUCCESS] All in-container smoke tests passed perfectly. Container is READY.\n');
        process.exit(0);
    }
}

// 异常捕获保护
runSmokeTests().catch((e) => {
    console.error('\n🚨 [FATAL EXCEPTION]: Unhandled error during smoke testing:', e);
    process.exit(1);
});
