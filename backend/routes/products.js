// routes/products.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
    const db = getDB();
    const { search } = req.query;
    let products;
    if (search) {
        products = db.prepare('SELECT * FROM products WHERE name LIKE ? OR sku LIKE ?').all(`%${search}%`, `%${search}%`);
    } else {
        products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
    }
    res.json(products);
});

router.post('/', requireRole('administrator', 'clerk'), (req, res) => {
    const { name, sku, category, quantity, reorderLevel, price, supplier } = req.body;
    if (!name || !sku) return res.status(400).json({ error: 'Name and SKU required' });
    const db = getDB();
    const result = db.prepare('INSERT INTO products (sku, name, category, quantity, reorderLevel, price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)').run(sku, name, category, quantity || 0, reorderLevel || 5, price || 0, supplier);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `New product: ${name}`, new Date().toLocaleString());
    res.status(201).json({ id: result.lastInsertRowid });
});

router.patch('/:id/stock', requireRole('administrator', 'clerk'), (req, res) => {
    const { quantity } = req.body;
    if (quantity === undefined || quantity < 0) return res.status(400).json({ error: 'Valid quantity required' });
    const db = getDB();
    db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('stock', `Stock updated for ${product.name} to ${quantity}`, new Date().toLocaleString());
    res.json({ success: true });
});

router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('alert', 'Product deleted', new Date().toLocaleString());
    res.json({ success: true });
});

module.exports = router;