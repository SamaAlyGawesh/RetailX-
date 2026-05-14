const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');

router.use(authenticate);

// بدء وردية جديدة
router.post('/start', (req, res) => {
    const { branch, department } = req.body;
    const cashier_name = req.user.name;
    const db = getDB();

    // 1. إنهاء أي وردية قديمة (نشطة أو لا) بشكل قاطع أولاً
    db.prepare("UPDATE shifts SET status = 'completed', end_time = ? WHERE cashier_name = ? AND status = 'active'")
      .run(new Date().toLocaleString(), cashier_name);

    // 2. بدء الوردية الجديدة
    const start_time = new Date().toLocaleString();
    const result = db.prepare('INSERT INTO shifts (cashier_name, branch, department, start_time, status) VALUES (?, ?, ?, ?, ?)')
      .run(cashier_name, branch || 'Main Branch', department || 'General', start_time, 'active');

    // 3. تسجيل نشاط
    db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?,?,?,?,?)')
      .run('shift', `${cashier_name} started a shift`, new Date().toLocaleString(), req.user.id, cashier_name);

    res.json({ message: 'Shift started successfully', start_time, id: result.lastInsertRowid });
});

// إنهاء وردية
router.post('/end', (req, res) => {
    const cashier_name = req.user.name;
    const db = getDB();

    const activeShift = db.prepare("SELECT * FROM shifts WHERE cashier_name = ? AND status = 'active'").get(cashier_name);
    if (!activeShift) {
        return res.status(400).json({ error: 'No active shift found.' });
    }

    const end_time = new Date().toLocaleString();
    db.prepare("UPDATE shifts SET end_time = ?, status = 'completed' WHERE id = ?").run(end_time, activeShift.id);

    db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?,?,?,?,?)')
      .run('shift', `${cashier_name} ended a shift`, new Date().toLocaleString(), req.user.id, cashier_name);

    res.json({ message: 'Shift ended successfully', end_time });
});

// جلب الورديات النشطة
router.get('/active', (req, res) => {
    const db = getDB();
    const shifts = db.prepare("SELECT * FROM shifts WHERE status = 'active'").all();
    res.json(shifts);
});

// جلب وردية المستخدم الحالي
router.get('/my-shift', (req, res) => {
    const db = getDB();
    const shift = db.prepare("SELECT * FROM shifts WHERE cashier_name = ? AND status = 'active' ORDER BY start_time DESC LIMIT 1").get(req.user.name);
    res.json(shift || null);
});

module.exports = router;