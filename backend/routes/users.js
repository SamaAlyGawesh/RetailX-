// backend/routes/users.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');

// GET /api/users – قائمة المستخدمين (للأدمن فقط)
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

// PATCH /api/users/:id/role – تغيير دور مستخدم (للأدمن فقط)
router.patch('/:id/role', authenticate, (req, res) => {
    if (req.user.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied' });

    const { role } = req.body;
    const validRoles = ['user', 'viewer', 'sales', 'cashier', 'clerk', 'administrator'];
    if (!validRoles.includes(role))
        return res.status(400).json({ error: 'Invalid role' });

    const userId = req.params.id;
    const db = getDB();
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    const result = stmt.run(role, userId);
    if (result.changes === 0)
        return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Role updated successfully' });
});

module.exports = router;