const express = require('express');
const router = express.Router();

// Simulated borrowed books data
router.get('/user/borrowed', (req, res) => {
    const borrowedBooks = [
        {
            id: 1,
            title: 'Clean Code',
            author: 'Robert C. Martin',
            dueDate: '2025-11-10',
            coverUrl: '/images/clean-code.jpg'
        },
        {
            id: 2,
            title: 'You Don’t Know JS',
            author: 'Kyle Simpson',
            dueDate: '2025-11-15',
            coverUrl: '/images/ydkjs.jpg'
        }
    ];

    res.json(borrowedBooks);
});

module.exports = router;

router.get('/user/notifications', (req, res) => {
    const notifications = [
        {
            id: 1,
            message: '📢 New arrivals: JavaScript books now available!',
            date: '2025-11-01'
        },
        {
            id: 2,
            message: '⚠️ Reminder: Return overdue books by Nov 10.',
            date: '2025-10-30'
        },
        {
            id: 3,
            message: '✅ Your membership has been renewed!',
            date: '2025-11-02'
        }
    ];
    res.json(notifications);
});

router.get('/user/stats', (req, res) => {
    const stats = {
        totalBorrowed: 42,
        genres: {
            'Fiction': 40,
            'Science': 20,
            'Fantasy': 25,
            'Biography': 14

        },
        readingHours: 128
    };

    res.json(stats);
});