// backend/routes/users.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');

router.get('/', authenticate, (req, res) => {
    if (req.user.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    const db = getDB();
    const totalRow = db.prepare('SELECT COUNT(*) as total FROM users').get();
    const total = totalRow?.total || 0;

    const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        users,
        total,
        page,
        pages: Math.ceil(total / limit)
    });
});

router.patch('/:id/role', authenticate, (req, res) => {
    // ... بدون تغيير
});

module.exports = router;