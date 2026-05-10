// backend/routes/users.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');
const bcrypt = require('bcryptjs');

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

    const users = db.prepare('SELECT id, name, email, role, status, created_at, last_login, branch FROM users ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        users,
        total,
        page,
        pages: Math.ceil(total / limit)
    });
});

// PATCH /api/users/:id/role – تغيير دور مستخدم
router.patch('/:id/role', authenticate, (req, res) => {
    if (req.user.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied' });

    const { role } = req.body;
    const validRoles = ['user', 'viewer', 'sales', 'cashier', 'clerk', 'administrator'];
    if (!validRoles.includes(role))
        return res.status(400).json({ error: 'Invalid role' });

    const userId = req.params.id;
    const db = getDB();
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
	db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
		'settings', `User ${userId} role changed to ${role}`, new Date().toLocaleString(), req.user.id, req.user.name
	);
    res.json({ message: 'Role updated' });
});

// PATCH /api/users/:id/status – تعطيل/تفعيل مستخدم
router.patch('/:id/status', authenticate, (req, res) => {
    if (req.user.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied' });

    const { status } = req.body; // 'active' or 'disabled'
    if (!['active', 'disabled'].includes(status))
        return res.status(400).json({ error: 'Invalid status' });

    const db = getDB();
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id);
	db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
		'settings', `User ${req.params.id} status changed to ${status}`, new Date().toLocaleString(), req.user.id, req.user.name
	);
    res.json({ message: 'Status updated' });
});

// PATCH /api/users/:id/reset-password – إعادة تعيين كلمة المرور
router.patch('/:id/reset-password', authenticate, (req, res) => {
    if (req.user.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied' });

    const tempPassword = 'reset123'; // يمكن توليدها عشوائياً
    const hashed = bcrypt.hashSync(tempPassword, 10);
    const db = getDB();
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.params.id);
	db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
		'settings', `Password reset for user ${req.params.id}`, new Date().toLocaleString(), req.user.id, req.user.name
	);
    res.json({ message: 'Password reset successfully', tempPassword });
});

// PATCH /api/users/:id/branch – تحديث الفرع
router.patch('/:id/branch', authenticate, (req, res) => {
    if (req.user.role !== 'administrator')
        return res.status(403).json({ error: 'Access denied' });

    const { branch } = req.body;
    const db = getDB();
    db.prepare('UPDATE users SET branch = ? WHERE id = ?').run(branch, req.params.id);
    res.json({ message: 'Branch updated' });
});

module.exports = router;