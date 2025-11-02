function adminAuth(req, res, next) {
    // ✅ Bypass for local testing
    if (process.env.ADMIN_BYPASS === 'true') {
        return next();
    }

    // 🔐 Optional token-based auth (future-proofing)
    const token = req.headers['x-admin-token'];
    if (token && token === process.env.ADMIN_TOKEN) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        error: 'Admin auth not configured. Set ADMIN_TOKEN in environment or ADMIN_BYPASS=true for local testing.'
    });
}

module.exports = adminAuth;