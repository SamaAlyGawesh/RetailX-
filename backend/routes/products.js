// backend/routes/products.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');
const multer = require('multer');
const path = require('path');

// إعداد multer لرفع الصور
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, unique);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

// GET /api/products?page=&limit=&search=
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

    const totalRow = db.prepare(`SELECT COUNT(*) as total FROM products ${where}`).get(...params);
    const total = totalRow?.total || 0;

    // جلب المنتجات مع معلومات المورد (supplier_code)
    const products = db.prepare(`
        SELECT p.*, s.supplier_code
        FROM products p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${where}
        ORDER BY p.id DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({
        products,
        total,
        page,
        pages: Math.ceil(total / limit)
    });
});

// POST /api/products (مع رفع صورة)
router.post('/', requireRole('administrator'), upload.single('image'), (req, res) => {
    const {
        name, sku, category, quantity, reorderLevel, price,
        supplier_id, description, location, expiry_date, active
    } = req.body;

    if (!name || !sku) return res.status(400).json({ error: 'Name and SKU required' });

    const db = getDB();

    // توليد product_code: supplier_code + "-" + sku (أو رقم تسلسلي)
    productCode = sku; // الكود الثابت هو SKU فقط

    const image = req.file ? req.file.filename : null;

    const result = db.prepare(`
		INSERT INTO products (name, sku, category, quantity, reorderLevel, price, supplier_id, product_code, description, image, location, expiry_date, received_date, active, total_cost)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
	`).run(
		name, sku, category || '', quantity || 0, reorderLevel || 5, price || 0,
		supplier_id || null, productCode, description || '', image, location || '', expiry_date || null,
		req.body.received_date || null, active ?? 1,
		(price || 0) * (quantity || 0)   // total_cost = price * quantity
	);

    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `New product: ${name}`, new Date().toLocaleString());
    res.status(201).json({ id: result.lastInsertRowid, product_code: productCode });
});

// PATCH /api/products/:id/stock
router.patch('/:id/stock', requireRole('administrator', 'clerk'), (req, res) => {
    const { quantity } = req.body;
    const db = getDB();
    db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    res.json({ success: true });
});

// DELETE /api/products/:id
router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;