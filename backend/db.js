// db.js - SQLite setup
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'retailx.db');
let db;

function initDB() {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'clerk',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            quantity INTEGER DEFAULT 0,
            reorderLevel INTEGER DEFAULT 5,
            price REAL DEFAULT 0,
            supplier TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            customer TEXT,
            items INTEGER,
            total REAL,
            status TEXT DEFAULT 'Completed',
            cashier TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            contact TEXT,
            email TEXT,
            phone TEXT,
            productsSuppliedList TEXT,
            leadTime INTEGER DEFAULT 5,
            addedDate TEXT
        );

        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            message TEXT,
            time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Seed admin user if none exist
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run('Admin', 'admin@retailx.com', hash, 'administrator');

        // Seed sample products
        const insertProduct = db.prepare('INSERT INTO products (sku, name, category, quantity, reorderLevel, price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const products = [
            ['WIRE123', 'Wireless Mouse', 'Electronics', 5, 5, 15.00, 'ABC Electronics'],
            ['LAP456', 'Laptop Bag', 'Accessories', 3, 5, 30.00, 'Global Accessories'],
            ['SMART789', 'Smartphone', 'Electronics', 12, 8, 399.00, 'Tech Gadgets Inc.'],
            ['HDMI101', 'HDMI Cable', 'Electronics', 24, 10, 10.00, 'ABC Electronics'],
            ['BLU222', 'Bluetooth Speaker', 'Electronics', 0, 5, 30.00, 'Tech Gadgets Inc.'],
            ['WATER345', 'Stainless Water Bottle', 'Accessories', 15, 5, 25.00, 'Global Accessories']
        ];
        products.forEach(p => insertProduct.run(...p));

        // Seed sample suppliers
        const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact, email, phone, productsSuppliedList, leadTime, addedDate) VALUES (?, ?, ?, ?, ?, ?, ?)');
        insertSupplier.run('ABC Electronics', 'John Davis', 'john@abcelectronics.com', '(555) 123-4567', JSON.stringify(['Wireless Mouse', 'HDMI Cable']), 5, new Date().toISOString());
        insertSupplier.run('Global Accessories', 'Sarah Miller', 'sarah@globalacc.com', '(555) 987-6543', JSON.stringify(['Laptop Bag', 'Stainless Water Bottle']), 5, new Date().toISOString());
    }

    return db;
}

function getDB() {
    if (!db) return initDB();
    return db;
}

module.exports = { initDB, getDB };