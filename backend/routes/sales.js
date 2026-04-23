// routes/sales.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
    const db = getDB();
    const sales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
    res.json(sales);
});

router.post('/', requireRole('administrator', 'cashier', 'sales'), (req, res) => {
    const { customer, productId, quantity, cashier } = req.body;
    if (!productId || !quantity) return res.status(400).json({ error: 'Product and quantity required' });
    const db = getDB();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.quantity < quantity) return res.status(400).json({ error: `Insufficient stock. Only ${product.quantity} available.` });

    const total = product.price * quantity;
    const id = 'TXN-' + Date.now();
    const date = new Date().toLocaleString();

    db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(quantity, productId);
    db.prepare('INSERT INTO sales (id, date, customer, items, total, status, cashier) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, date, customer || 'Walk-in Customer', quantity, total, 'Completed', cashier);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('sale', `New sale: ${quantity}x ${product.name} for ${total}`, date);

    res.status(201).json({ id, total });
});

router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('alert', `Sale ${req.params.id} deleted`, new Date().toLocaleString());
    res.json({ success: true });
});

module.exports = router;