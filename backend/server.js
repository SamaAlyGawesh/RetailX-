// server.js - Main entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Init database
initDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/users', require('./routes/users'));
// تقديم الملفات المرفوعة
app.use('/uploads', express.static('uploads'));

// راوتر المستندات
app.use('/api/supplier-documents', require('./routes/supplierDocuments'));

// Serve frontend in production
app.use(express.static('../frontend'));

app.use('/files', require('./routes/fileView'));

app.listen(PORT, () => console.log(`RetailX API running on port ${PORT}`));