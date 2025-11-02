const express = require('express');
const router = express.Router();
const { Book } = require('../models');

router.get('/', async (req, res) => {
    try {
        const books = await Book.findAll();
        res.json(books);
    } catch (err) {
        console.error('❌ Error fetching books:', err);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

module.exports = router;