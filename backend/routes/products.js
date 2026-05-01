// backend/routes/products.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

// GET /api/products?page=1&limit=15&search=
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    const db = getDB();
    let where = '';
    let params = [];

    if (search) {
        where = ' WHERE name LIKE ? OR sku LIKE ? OR category LIKE ?';
        params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    // جلب العدد الإجمالي
    const totalRow = db.prepare(`SELECT COUNT(*) as total FROM products ${where}`).get(...params);
    const total = totalRow?.total || 0;

    // جلب المنتجات
    const products = db.prepare(`SELECT * FROM products ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({
        products,
        total,
        page,
        pages: Math.ceil(total / limit)
    });
});

// POST /api/products (يبقى كما هو ...)
// PATCH /api/products/:id/stock ...
// DELETE /api/products/:id ...

// باقي المسارات بدون تغيير
router.post('/', requireRole('administrator'), (req, res) => {
    const { name, sku, category, quantity, reorderLevel, price, supplier } = req.body;
    if (!name || !sku) return res.status(400).json({ error: 'Name and SKU required' });
    const db = getDB();
    const result = db.prepare('INSERT INTO products (name, sku, category, quantity, reorderLevel, price, supplier) VALUES (?,?,?,?,?,?,?)').run(name, sku, category || '', quantity || 0, reorderLevel || 5, price || 0, supplier || '');
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `New product: ${name}`, new Date().toLocaleString());
    res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/:id/stock', requireRole('administrator', 'clerk'), (req, res) => {
    const { quantity } = req.body;
    const db = getDB();
    db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `Stock updated for product ${req.params.id}`, new Date().toLocaleString());
    res.json({ success: true });
});

router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('alert', `Product ${req.params.id} deleted`, new Date().toLocaleString());
    res.json({ success: true });
});

module.exports = router;