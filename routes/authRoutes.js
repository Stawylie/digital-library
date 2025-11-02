const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    // 🔍 Add these logs for debugging
    console.log('Login attempt for:', email);
    console.log('User found:', !!user);
    console.log('Stored hash:', user?.password);
    console.log('Password match:', user ? bcrypt.compareSync(password, user.password) : false);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', user: { id: user.id, name: user.name, role: user.role } });
});

// Register (optional for testing)
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    const hashed = bcrypt.hashSync(password, 10);
    const user = await User.create({ name, email, password: hashed, role });
    res.json(user);
});

module.exports = router;