// backend/routes/supplierDocuments.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getDB } = require('../db');
const { authenticate, requireRole } = require('../authMiddleware');

// إعداد multer
const storage = multer.diskStorage({
    destination: 'uploads/supplier_docs/',
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, unique);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB

router.use(authenticate);

// جلب كل مستندات مورد معين
router.get('/:supplierId', (req, res) => {
    const db = getDB();
    const docs = db.prepare('SELECT * FROM supplier_documents WHERE supplier_id = ? ORDER BY id DESC').all(req.params.supplierId);
    res.json(docs);
});

// إضافة مستند جديد
router.post('/:supplierId', requireRole('administrator'), upload.single('file'), (req, res) => {
    const { document_type, document_number, issue_date, expiry_date } = req.body;
    const supplierId = req.params.supplierId;
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const db = getDB();
    const result = db.prepare('INSERT INTO supplier_documents (supplier_id, document_type, document_number, file_path, issue_date, expiry_date) VALUES (?,?,?,?,?,?)').run(
        supplierId, document_type, document_number || '', req.file.filename, issue_date, expiry_date
    );
    res.status(201).json({ id: result.lastInsertRowid, file_path: req.file.filename });
});

// حذف مستند
router.delete('/:docId', requireRole('administrator'), (req, res) => {
    const db = getDB();
    const doc = db.prepare('SELECT * FROM supplier_documents WHERE id = ?').get(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    // حذف الملف من القرص
    const fs = require('fs');
    const filePath = 'uploads/supplier_docs/' + doc.file_path;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM supplier_documents WHERE id = ?').run(req.params.docId);
    res.json({ success: true });
});

module.exports = router;