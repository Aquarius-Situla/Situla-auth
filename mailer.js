/*
 * Situla Auth 2.0 — SMTP Mailer
 * Lazy-initialized nodemailer transporter.
 * When SMTP_HOST is not configured, all send calls are silently skipped.
 */

const nodemailer = require('nodemailer');

let _transporter = null;

/**
 * Returns true if SMTP is configured via environment variables.
 */
function isConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Returns the lazily-initialized nodemailer transporter, or null if unconfigured.
 */
function getTransporter() {
    if (!isConfigured()) return null;
    if (!_transporter) {
        _transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465', 10),
            secure: process.env.SMTP_SECURE !== 'false', // default true (TLS/port 465)
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return _transporter;
}

/**
 * Send an email. Silently resolves (no error thrown) if SMTP is not configured.
 *
 * @param {string} to      - Recipient address
 * @param {string} subject - Email subject
 * @param {string} html    - HTML body content
 * @returns {Promise<void>}
 */
async function sendEmail(to, subject, html) {
    const transporter = getTransporter();
    if (!transporter) {
        // SMTP not configured — skip silently
        return;
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    try {
        await transporter.sendMail({ from, to, subject, html });
        console.log(`[mailer] Email sent to ${to}: ${subject}`);
    } catch (err) {
        console.error(`[mailer] Failed to send email to ${to}:`, err.message);
        // Do not rethrow — email failure should not crash auth flows
    }
}

module.exports = { isConfigured, sendEmail };
