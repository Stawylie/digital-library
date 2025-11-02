const Notification = require('../models/Notification');

exports.sendNotification = async (req, res) => {
    const { userId, message } = req.body;
    try {
        const newNotification = await Notification.create({
            userId,
            message,
            sentDate: new Date()
        });
        res.status(201).json(newNotification);
    } catch (error) {
        res.status(500).json({ error: 'Failed to send notification' });
    }
};

exports.getUserNotifications = async (req, res) => {
    const { userId } = req.params;
    try {
        const notifications = await Notification.findAll({
            where: { userId },
            order: [['sentDate', 'DESC']]
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};