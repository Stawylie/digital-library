const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const Resource = require('../models/Resource');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

// All admin routes require adminAuth (can be bypassed via ADMIN_BYPASS=true)
router.use(adminAuth);

// Simple health for admin namespace
router.get('/health', (req, res) => {
    res.json({ ok: true, namespace: 'admin', version: '1.0.0' });
});

// Admin stats: quick counts to populate dashboard cards
router.get('/stats', async (req, res) => {
    try {
        const [users, resources, notifications] = await Promise.all([
            User.count(),
            Resource.count(),
            Notification.count()
        ]);
        res.json({ users, resources, notifications });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch stats', details: e.message });
    }
});

// Resources management
router.get('/resources', async (req, res) => {
    try {
        const list = await Resource.findAll({ order: [['createdAt', 'DESC']] });
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch resources', details: e.message });
    }
});

router.post('/resources', async (req, res) => {
    try {
        const created = await Resource.create(req.body);
        res.status(201).json(created);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create resource', details: e.message });
    }
});

router.put('/resources/:id', async (req, res) => {
    try {
        const rec = await Resource.findByPk(req.params.id);
        if (!rec) return res.status(404).json({ error: 'Resource not found' });
        await rec.update(req.body);
        res.json(rec);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update resource', details: e.message });
    }
});

router.delete('/resources/:id', async (req, res) => {
    try {
        const rec = await Resource.findByPk(req.params.id);
        if (!rec) return res.status(404).json({ error: 'Resource not found' });
        await rec.destroy();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete resource', details: e.message });
    }
});

// ✅ Send notification
router.post('/notify', async (req, res) => {
    if (process.env.ADMIN_BYPASS !== 'true') {
        return res.status(403).json({
            ok: false,
            error: 'Admin auth not configured. Set ADMIN_TOKEN in environment or ADMIN_BYPASS=true for local testing.'
        });
    }

    const { userId, message } = req.body;
    try {
        const note = await Notification.create({ userId, message });
        res.json({ success: true, note });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

// ✅ View notifications
router.get('/notifications/:userId', async (req, res) => {
    try {
        const notes = await Notification.findAll({ where: { userId: req.params.userId } });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

module.exports = router;