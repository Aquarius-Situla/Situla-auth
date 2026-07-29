const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const db = require('./database');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'situla_default_secret_please_change';
const ADMIN_USER = process.env.ADMIN_USER || 'akadmin';
const ADMIN_PASS_RAW = (process.env.ADMIN_PASS || '').replace(/^['\"]|['\"]$/g, '');
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '.aquarius2009.me';
const COOKIE_NAME = 'situla_session';
const RP_ID = process.env.RP_ID || 'auth.aquarius2009.me';
const RP_NAME = 'Situla Auth';
/* In Nginx reverse proxy, the client origin is usually https://auth.aquarius2009.me */
const ORIGIN = `https://${RP_ID}`;

function hashPassword(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex');
}

db.get('SELECT * FROM users WHERE username = ?', [ADMIN_USER], (err, row) => {
    if (err) { console.error(err); return; }
    if (!row) {
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [ADMIN_USER, hashPassword(ADMIN_PASS_RAW)]);
    } else {
        db.run('UPDATE users SET password = ? WHERE username = ?', [hashPassword(ADMIN_PASS_RAW), ADMIN_USER]);
    }
});

function authenticateJWT(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Unauthorized' });
    }
}

function setAuthCookie(res, userId, username) {
    const token = jwt.sign({ id: userId, user: username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true, secure: true, domain: COOKIE_DOMAIN, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'Lax'
    });
}

/* NGINX Forward Auth endpoint */
app.get('/verify', (req, res) => {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).send('Unauthorized');
    try {
        jwt.verify(token, JWT_SECRET);
        res.status(200).send('OK');
    } catch (err) {
        res.status(401).send('Unauthorized');
    }
});

/* Password & TOTP Login */
app.post('/api/login', (req, res) => {
    const { username, password, totp } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (!user || user.password !== hashPassword(password)) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (user.totp_secret) {
            if (!totp) return res.json({ success: false, requireTotp: true });
            if (!authenticator.verify({ token: totp, secret: user.totp_secret })) {
                return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
            }
        }
        setAuthCookie(res, user.id, user.username);
        res.json({ success: true });
    });
});

const userChallenges = {};

/* Passkey Login Options */
app.get('/api/webauthn/login-options', (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [ADMIN_USER], async (err, user) => {
        if (!user) return res.status(400).json({ error: 'User not found' });
        db.all('SELECT * FROM passkeys WHERE user_id = ?', [user.id], async (err, keys) => {
            const options = await generateAuthenticationOptions({
                rpID: RP_ID,
                allowCredentials: keys.map(k => ({
                    id: Buffer.from(k.credential_id, 'base64url'),
                    type: 'public-key'
                })),
                userVerification: 'preferred'
            });
            userChallenges[user.id] = options.challenge;
            res.json(options);
        });
    });
});

/* Passkey Verify */
app.post('/api/webauthn/login-verify', async (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [ADMIN_USER], (err, user) => {
        db.all('SELECT * FROM passkeys WHERE user_id = ?', [user.id], async (err, keys) => {
            const passkey = keys.find(k => k.credential_id === req.body.id);
            if (!passkey) return res.status(400).json({ error: 'Key not found' });
            
            try {
                const verification = await verifyAuthenticationResponse({
                    response: req.body,
                    expectedChallenge: userChallenges[user.id],
                    expectedOrigin: ORIGIN,
                    expectedRPID: RP_ID,
                    authenticator: {
                        credentialID: Buffer.from(passkey.credential_id, 'base64url'),
                        credentialPublicKey: Buffer.from(passkey.public_key, 'base64url'),
                        counter: passkey.counter
                    }
                });
                
                if (verification.verified) {
                    db.run('UPDATE passkeys SET counter = ? WHERE id = ?', [verification.authenticationInfo.newCounter, passkey.id]);
                    setAuthCookie(res, user.id, user.username);
                    delete userChallenges[user.id];
                    return res.json({ verified: true });
                }
            } catch (error) {
                return res.status(400).json({ error: error.message });
            }
        });
    });
});

/* ---- ADMIN ROUTES ---- */
app.get('/api/totp/generate', authenticateJWT, (req, res) => {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.user, RP_NAME, secret);
    qrcode.toDataURL(otpauth, (err, imageUrl) => res.json({ secret, qr: imageUrl }));
});

app.post('/api/totp/verify', authenticateJWT, (req, res) => {
    if (authenticator.verify({ token: req.body.token, secret: req.body.secret })) {
        db.run('UPDATE users SET totp_secret = ? WHERE id = ?', [req.body.secret, req.user.id]);
        return res.json({ success: true });
    }
    res.status(400).json({ success: false, message: 'Invalid token' });
});

app.get('/api/webauthn/register-options', authenticateJWT, async (req, res) => {
    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: Buffer.from(req.user.id.toString()),
        userName: req.user.user,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
    });
    userChallenges[req.user.id] = options.challenge;
    res.json(options);
});

app.post('/api/webauthn/register-verify', authenticateJWT, async (req, res) => {
    try {
        const verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge: userChallenges[req.user.id],
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID
        });
        
        if (verification.verified) {
            const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
            db.run('INSERT INTO passkeys (user_id, credential_id, public_key, counter) VALUES (?, ?, ?, ?)',
                [req.user.id, Buffer.from(credentialID).toString('base64url'), Buffer.from(credentialPublicKey).toString('base64url'), counter]);
            delete userChallenges[req.user.id];
            return res.json({ verified: true });
        }
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
    res.json({ success: true });
});

app.get('/admin', authenticateJWT, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Situla Auth 2.0 listening on port ${port}`));
