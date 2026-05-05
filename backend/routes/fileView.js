const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/:filename', (req, res) => {
    const filePath = path.join(__dirname, '..', 'uploads', 'supplier_docs', req.params.filename);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).json({ error: 'File not found' });
    });
});
module.exports = router;