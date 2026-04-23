// routes/backup.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
    const db = getDB();
    const backup = {
        products: db.prepare('SELECT * FROM products').all(),
        sales: db.prepare('SELECT * FROM sales').all(),
        suppliers: db.prepare('SELECT * FROM suppliers').all(),
        users: db.prepare('SELECT id, name, email, role, created_at FROM users').all(),
        date: new Date().toISOString()
    };
    res.json(backup);
});

module.exports = router;