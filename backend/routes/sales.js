// backend/routes/sales.js
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
    const totalRow = db.prepare('SELECT COUNT(*) as total FROM sales').get();
    const total = totalRow?.total || 0;

    const sales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);

    res.json({
        sales,
        total,
        page,
        pages: Math.ceil(total / limit)
    });
});

// POST, DELETE تبقى كما هي
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
    db.prepare('INSERT INTO sales (id, date, customer, items, total, status, cashier, productId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, date, customer || 'Walk-in Customer', quantity, total, 'Completed', cashier, productId);
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run('sale', `New sale: ${quantity}x ${product.name} for ${total}`, date);

    res.status(201).json({ id, total });
});

// الجديد – يرجع الكمية للمنتج إذا كان ProductId موجود
router.delete('/:id', requireRole('administrator'), (req, res) => {
    const db = getDB();
    const saleId = req.params.id;

    // 1. نجيب الفاتورة
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) {
        return res.status(404).json({ error: 'Sale not found' });
    }

    // 2. لو الفاتورة فيها productId، نرجع الكمية للمنتج
    if (sale.productId) {
        db.prepare('UPDATE products SET quantity = quantity + ? WHERE id = ?')
          .run(sale.items, sale.productId);
    }

    // 3. نحذف الفاتورة
    db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);

    // 4. تسجيل نشاط
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)')
      .run('alert', `Sale ${saleId} deleted and stock restored`, new Date().toLocaleString());

    res.json({ success: true });
});


// POST /api/sales/multi
router.post('/multi', requireRole('administrator', 'cashier', 'sales'), (req, res) => {
    const { customer, items, discount, paymentMethod, notes, cashier } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: 'Items array required' });

    const db = getDB();
    let saleDate = req.body.saleDate || new Date().toLocaleString();
	// إذا أُرسل تاريخ مخصص، تأكد من أنه صالح
	if (req.body.saleDate) {
		const parsed = new Date(req.body.saleDate);
		if (!isNaN(parsed.getTime())) {
			saleDate = parsed.toLocaleString(); // تحويله لنفس الصيغة المستخدمة
		}
	}
    const saleId = 'TXN-' + Date.now();

    let subtotal = 0;
    let totalItemsCount = 0;

    for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
        if (!product) return res.status(404).json({ error: `Product ${item.productId} not found` });
        if (product.quantity < item.quantity) {
            return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
        }
        subtotal += product.price * item.quantity;
        totalItemsCount += item.quantity;
    }

    const discountAmount = (subtotal * (discount || 0)) / 100;
    const grandTotal = subtotal - discountAmount;

    // تسجيل كل منتج على حدة في جدول sales
    const insertSale = db.prepare('INSERT INTO sales (id, date, customer, items, total, status, cashier, productId) VALUES (?,?,?,?,?,?,?,?)');
    for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
        db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(item.quantity, item.productId);
        insertSale.run(saleId + '-' + item.productId, saleDate, customer, item.quantity, product.price * item.quantity, 'Completed', cashier, item.productId);
    }

    // نشاط
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)').run(
        'sale',
        `Multi-sale ${saleId}: ${totalItemsCount} items, total ${grandTotal}`,
        saleDate
    );

    res.status(201).json({ id: saleId, total: grandTotal });
});

module.exports = router;