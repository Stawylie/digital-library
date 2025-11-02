const express = require('express');
const router = express.Router();
// Use correct case for cross-platform compatibility (Windows vs. Linux/Mac filesystems)
const notificationController = require('../Controllers/notificationController');

// POST /api/notifications
router.post('/', notificationController.sendNotification);

// GET /api/notifications/:userId
router.get('/:userId', notificationController.getUserNotifications);

module.exports = router;