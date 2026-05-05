const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

router.get('/:filename', (req, res) => {
    const filePath = path.join(__dirname, '..', 'uploads', 'supplier_docs', req.params.filename);
    
    // سجل للتأكد من المسار
    console.log('Trying to serve:', filePath);
    if (!fs.existsSync(filePath)) {
        console.error('File does not exist:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
});