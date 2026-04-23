// routes/suppliers.js
const express = require('express');
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
    const db = getDB();
    const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
    const result = suppliers.map(s => ({
        ...s,
        productsSuppliedList: JSON.parse(s.productsSuppliedList || '[]')
    }));
    res.json(result);
});

router.post('/', requireRole('administrator'), (req, res) => {
    const { name, contact, email, phone, productsSuppliedList, leadTime } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    const db = getDB();
    const result = db.prepare('INSERT INTO suppliers (name, contact, email, phone, productsSuppliedList, leadTime, addedDate) VALUES (?, ?, ?, ?, ?, ?, ?)').run(name, contact || '', email, phone || '', JSON.stringify(productsSuppliedList || []), leadTime || 5, new Date().toISOString());
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `New supplier: ${name}`, new Date().toLocaleString());
    res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireRole('administrator'), (req, res) => {
    const { name, contact, email, phone, productsSuppliedList, leadTime } = req.body;
    const db = getDB();
    db.prepare('UPDATE suppliers SET name=?, contact=?, email=?, phone=?, productsSuppliedList=?, leadTime=? WHERE id=?').run(name, contact || '', email, phone || '', JSON.stringify(productsSuppliedList || []), leadTime || 5, req.params.id);
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