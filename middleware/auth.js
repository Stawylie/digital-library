function requireAdmin(req, res, next) {
    let user;

    try {
        // Try to get user from query string
        if (req.query.user) {
            user = JSON.parse(req.query.user);
        } else {
            return res.status(403).send('Access denied: Missing user info');
        }

        // Check role
        if (user.role === 'admin') {
            return next();
        } else {
            return res.status(403).send('Access denied: Admins only');
        }
    } catch (err) {
        return res.status(403).send('Access denied: Invalid user format');
    }
}

module.exports = { requireAdmin };