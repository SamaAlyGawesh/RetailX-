// routes/reports.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/:type', (req, res) => {
    const db = getDB();
    const { type } = req.params;
    let data;
    switch (type) {
        case 'stock':
            data = db.prepare('SELECT name, sku, quantity, price FROM products ORDER BY name').all();
            break;
        case 'lowstock':
            data = db.prepare('SELECT name, quantity, reorderLevel FROM products WHERE quantity <= reorderLevel').all();
            break;
        case 'sales':
            data = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all();
            break;
        case 'value':
            data = db.prepare('SELECT name, quantity, price, (quantity * price) as totalValue FROM products').all();
            break;
        default:
            return res.status(400).json({ error: 'Unknown report type' });
    }
    res.json(data);
});

module.exports = router;
