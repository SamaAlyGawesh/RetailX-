// backend/routes/suppliers.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    const db = getDB();
    const totalRow = db.prepare('SELECT COUNT(*) as total FROM suppliers').get();
    const total = totalRow?.total || 0;

    const suppliers = db.prepare('SELECT id, name, contact, email, phone, productsSuppliedList, leadTime, addedDate, address1, address2, website, payment_terms FROM suppliers ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
    const result = suppliers.map(s => ({
        ...s,
        productsSuppliedList: JSON.parse(s.productsSuppliedList || '[]')
    }));

    res.json({
        suppliers: result,
        total,
        page,
        pages: Math.ceil(total / limit)
    });
});

router.post('/', requireRole('administrator'), (req, res) => {
    const { name, contact, email, phone, productsSuppliedList, leadTime, address1, address2, website, payment_terms } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    const db = getDB();
    const result = db.prepare('INSERT INTO suppliers (name, contact, email, phone, productsSuppliedList, leadTime, addedDate, address1, address2, website, payment_terms) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        name, contact || '', email, phone || '', JSON.stringify(productsSuppliedList || []), leadTime || 5, new Date().toISOString(),
        address1 || '', address2 || '', website || '', payment_terms || ''
    );
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `New supplier: ${name}`, new Date().toLocaleString());
    res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireRole('administrator'), (req, res) => {
    const { name, contact, email, phone, productsSuppliedList, leadTime, address1, address2, website, payment_terms } = req.body;
    const db = getDB();
    db.prepare('UPDATE suppliers SET name=?, contact=?, email=?, phone=?, productsSuppliedList=?, leadTime=?, address1=?, address2=?, website=?, payment_terms=? WHERE id=?').run(
        name, contact || '', email, phone || '', JSON.stringify(productsSuppliedList || []), leadTime || 5,
        address1 || '', address2 || '', website || '', payment_terms || '', req.params.id
    );
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `Supplier updated: ${name}`, new Date().toLocaleString());
    res.json({ success: true });
});

router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('alert', 'Supplier deleted', new Date().toLocaleString());
    res.json({ success: true });
});

module.exports = router;