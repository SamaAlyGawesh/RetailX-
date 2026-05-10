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
	let whereClause = '';
	let whereClauseForCount = '';
	let params = [];

	if (search) {
		// جملة البحث للاستعلام الرئيسي (يستخدم الأسماء المستعارة p. لتجنب التعارض)
		whereClause = ' WHERE p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?';
		// جملة البحث لاستعلام العد (جدول products فقط، لا تعارض)
		whereClauseForCount = ' WHERE name LIKE ? OR sku LIKE ? OR category LIKE ?';
		params = [`%${search}%`, `%${search}%`, `%${search}%`];
	}

	const totalRow = db.prepare(`SELECT COUNT(*) as total FROM products ${whereClauseForCount}`).get(...params);
	const total = totalRow?.total || 0;

	const products = db.prepare(`
		SELECT p.*, s.supplier_code
		FROM products p
		LEFT JOIN suppliers s ON p.supplier_id = s.id
		${whereClause}
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
	db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
		'product', `New product: ${name}`, new Date().toLocaleString(), req.user.id, req.user.name
	);

    //db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `New product: ${name}`, new Date().toLocaleString());
    res.status(201).json({ id: result.lastInsertRowid, product_code: productCode });
});

// PATCH /api/products/:id/stock
router.patch('/:id/stock', requireRole('administrator', 'clerk'), (req, res) => {
    const { quantity } = req.body;
    const db = getDB();
    // جلب المنتج لتسجيل الاسم
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
        'product', `Product stock updated: ${product.name}`, new Date().toLocaleString(), req.user.id, req.user.name
    );
    res.json({ success: true });
});

// DELETE /api/products/:id
router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    // جلب المنتج لتسجيل الاسم
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
        'alert', `Product deleted: ${product.name}`, new Date().toLocaleString(), req.user.id, req.user.name
    );
    res.json({ success: true });
});


// PUT /api/products/:id – تحديث كامل للمنتج
router.put('/:id', requireRole('administrator'), upload.single('image'), (req, res) => {
    const db = getDB();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const {
        name, sku, category, quantity, reorderLevel, price,
        supplier_id, description, location, expiry_date, received_date, active, unit_cost
    } = req.body;

    // حساب total_cost الجديد
    const newQty = parseInt(quantity) || 0;
    const unitCost = parseFloat(unit_cost) || product.price;
    const newTotalCost = newQty * unitCost;

    // التعامل مع الصورة الجديدة
    const image = req.file ? req.file.filename : (product.image || null);

    db.prepare(`
        UPDATE products SET
            name = ?, sku = ?, category = ?, quantity = ?, reorderLevel = ?, price = ?,
            supplier_id = ?, description = ?, location = ?, expiry_date = ?, received_date = ?,
            active = ?, total_cost = ?, image = ?
        WHERE id = ?
    `).run(
        name || product.name, sku || product.sku, category || product.category,
        newQty, reorderLevel || product.reorderLevel, price || product.price,
        supplier_id || product.supplier_id, description || product.description,
        location || product.location, expiry_date || product.expiry_date,
        received_date || product.received_date, active !== undefined ? parseInt(active) : product.active,
        newTotalCost, image, req.params.id
    );
	db.prepare('INSERT INTO activity (type, message, time, user_id, user_name) VALUES (?, ?, ?, ?, ?)').run(
		'product', `Product updated: ${name || product.name}`, new Date().toLocaleString(), req.user.id, req.user.name
	);

    //db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('product', `Product updated: ${name || product.name}`, new Date().toLocaleString());
    res.json({ success: true });
});

// استيراد المنتجات من CSV
router.post('/import', requireRole('administrator'), upload.single('file'), (req, res) => {
    const db = getDB();
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No CSV file provided' });

    const fs = require('fs');
    const content = fs.readFileSync(file.path, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return res.status(400).json({ error: 'Empty or invalid CSV' });

    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    const nameIdx = header.indexOf('name');
    const skuIdx = header.indexOf('sku');
    if (nameIdx === -1 || skuIdx === -1) return res.status(400).json({ error: 'CSV must contain Name and SKU columns' });

    let imported = 0;
    const transaction = db.transaction(() => {
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!cols || cols.length < header.length) continue;
            const name = cols[nameIdx]?.replace(/^"|"$/g, '');
            const sku = cols[skuIdx]?.replace(/^"|"$/g, '');
            if (!name || !sku) continue;

            const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
            if (existing) continue;

            const priceIdx = header.indexOf('price');
            const qtyIdx = header.indexOf('quantity');
            const price = priceIdx !== -1 ? parseFloat(cols[priceIdx]?.replace(/^"|"$/g, '')) || 0 : 0;
            const qty = qtyIdx !== -1 ? parseInt(cols[qtyIdx]?.replace(/^"|"$/g, '')) || 0 : 0;
            const totalCost = price * qty;

            db.prepare(`INSERT INTO products (name, sku, price, quantity, total_cost) VALUES (?,?,?,?,?)`).run(name, sku, price, qty, totalCost);
            imported++;
        }
    });
    transaction();
    // تنظيف الملف بعد الاستيراد (اختياري)
    fs.unlinkSync(file.path);
    res.json({ message: `Imported ${imported} products successfully` });
});

module.exports = router;