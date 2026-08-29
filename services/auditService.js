/*
 * Situla Auth 2.0 - Audit Logging Service
 */
'use strict';

const db = require('../core/database');

function isPrivateIp(ip) {
    if (!ip || ip === 'Unknown' || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
    if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
    if (ip.startsWith('172.')) {
        const parts = ip.split('.');
        if (parts.length >= 2) {
            const second = parseInt(parts[1], 10);
            if (second >= 16 && second <= 31) return true;
        }
    }
    if (ip.startsWith('100.')) {
        const parts = ip.split('.');
        if (parts.length >= 2) {
            const second = parseInt(parts[1], 10);
            if (second >= 64 && second <= 127) return true;
        }
    }
    if (ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fe80:')) return true;
    return false;
}

function detectDevice(ua) {
    if (!ua) return '未知设备';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android 设备';
    if (ua.includes('Macintosh') || ua.includes('Mac OS')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Linux')) return 'Linux';
    return '未知设备';
}

class AuditService {
    static async logLogin(req, userId, authMethod = 'unknown') {
        if (!req) return;
        try {
            const rawIp = req.ip || req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'Unknown';
            const cleanIp = String(rawIp).replace(/^::ffff:/, '').replace(/^\[|\]$/g, '').trim().split(',')[0].trim();
            const ua = req.headers['user-agent'] || 'Unknown Device';
            const device = detectDevice(ua);

            let location = '未知位置';
            if (isPrivateIp(cleanIp)) {
                location = '局域网';
            } else if (req.headers['cf-ipcountry']) {
                location = req.headers['cf-ipcountry'];
            }

            await db.run(
                'INSERT INTO login_logs (user_id, ip, location, device) VALUES (?, ?, ?, ?)',
                [userId, cleanIp.substring(0, 64), location, device]
            );
        } catch (err) {
            console.error('[AuditService] Failed to insert login log:', err.message);
        }
    }

    static async getRecentLogs(userId, limit = 20) {
        return await db.all(
            'SELECT ip, location, device, created_at FROM login_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?',
            [userId, limit]
        );
    }
}

module.exports = AuditService;
