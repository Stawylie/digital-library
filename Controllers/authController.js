const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/user');

function signToken(payload, opts = {}) {
  const secret = process.env.JWT_SECRET || 'dev_insecure_secret_change_me';
  const expiresIn = opts.expiresIn || '1h';
  return jwt.sign(payload, secret, { expiresIn });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const normEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name || '', email: normEmail, role: role || 'user', passwordHash, mfaEnabled: false });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, mfaEnabled: user.mfaEnabled });
  } catch (e) {
    res.status(500).json({ error: 'Failed to register', details: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const normEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ where: { email: normEmail } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.mfaEnabled) {
      const mfaToken = signToken({ sub: user.id, purpose: 'mfa' }, { expiresIn: '5m' });
      return res.json({ mfaRequired: true, mfaToken, user: { id: user.id, email: user.email } });
    }

    const accessToken = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ token: accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, mfaEnabled: user.mfaEnabled } });
  } catch (e) {
    res.status(500).json({ error: 'Login failed', details: e.message });
  }
};

exports.mfaSetup = async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.mfaEnabled) return res.status(400).json({ error: 'MFA already enabled' });

    const appName = process.env.APP_NAME || 'Digital Library';
    const secret = speakeasy.generateSecret({ name: `${appName} (${user.email})` });

    // Store secret temporarily (enabled flag remains false until verification)
    user.mfaSecret = secret.base32;
    await user.save();

    const otpauthUrl = secret.otpauth_url;
    const qr = await qrcode.toDataURL(otpauthUrl);

    res.json({ base32: secret.base32, otpauth_url: otpauthUrl, qrDataUrl: qr });
  } catch (e) {
    res.status(500).json({ error: 'Failed to start MFA setup', details: e.message });
  }
};

exports.mfaVerify = async (req, res) => {
  try {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    let payload = null;
    if (token) {
      try { payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_insecure_secret_change_me'); } catch (_) {}
    }

    let userId = null;
    if (payload && payload.purpose === 'mfa' && payload.sub) {
      userId = payload.sub;
    } else if (payload && payload.sub) {
      userId = payload.sub;
    }

    const { code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'Missing user context or code' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfaSecret) return res.status(400).json({ error: 'MFA secret not set. Call /mfa/setup first.' });

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid MFA code' });
    }

    // Enable MFA if not yet enabled
    if (!user.mfaEnabled) {
      user.mfaEnabled = true;
      await user.save();
    }

    // If this came from an MFA login challenge, issue a full token now
    const accessToken = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ ok: true, token: accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, mfaEnabled: user.mfaEnabled } });
  } catch (e) {
    res.status(500).json({ error: 'Failed to verify MFA code', details: e.message });
  }
};

exports.mfaDisable = async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    const { code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'Missing user or code' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ error: 'MFA not enabled' });
    }

    const verified = speakeasy.totp.verify({ secret: user.mfaSecret, encoding: 'base32', token: code, window: 1 });
    if (!verified) return res.status(401).json({ error: 'Invalid MFA code' });

    user.mfaEnabled = false;
    user.mfaSecret = null;
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disable MFA', details: e.message });
  }
};

exports.me = async (req, res) => {
  try {
    const userId = req.user && req.user.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findByPk(userId, { attributes: ['id', 'name', 'email', 'role', 'mfaEnabled'] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user', details: e.message });
  }
};

// Dev-only helper: return the current TOTP code for the authenticated user.
// Strictly gated by MFA_TEST_MODE=true and NODE_ENV!=='production'.
exports.mfaDevCode = async (req, res) => {
  try {
    const testMode = String(process.env.MFA_TEST_MODE || '').toLowerCase() === 'true';
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!testMode || isProd) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Accept either a normal access token or an MFA temp token, like mfaVerify
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    let payload = null;
    if (token) {
      try { payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_insecure_secret_change_me'); } catch (_) {}
    }
    let userId = null;
    if (payload && payload.sub) userId = payload.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findByPk(userId);
    if (!user || !user.mfaSecret) return res.status(400).json({ error: 'MFA secret not set for this user' });

    const code = speakeasy.totp({ secret: user.mfaSecret, encoding: 'base32' });
    res.json({ code });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate test code', details: e.message });
  }
};
