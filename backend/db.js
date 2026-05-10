// db.js - SQLite setup & seeding
const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function getDB() {
    if (db) return db;
    db = new Database(path.join(__dirname, 'retailx.db'));
    db.pragma('journal_mode = WAL');
    return db;
}

function initDB() {
    const db = getDB();

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login TEXT,
            branch TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            quantity INTEGER DEFAULT 0,
            reorderLevel INTEGER DEFAULT 5,
            price REAL DEFAULT 0,
			total_cost REAL DEFAULT 0,
            supplier TEXT,
            supplier_id INTEGER REFERENCES suppliers(id),
            product_code TEXT,
            description TEXT,
            image TEXT,
            location TEXT,
            expiry_date TEXT,
            received_date TEXT,
            active INTEGER DEFAULT 1,
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
            productId INTEGER REFERENCES products(id),
            category TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_code TEXT,
            name TEXT NOT NULL,
            contact TEXT,
            email TEXT,
            phone TEXT,
            productsSuppliedList TEXT,
            leadTime INTEGER DEFAULT 5,
            addedDate TEXT,
            address1 TEXT,
            address2 TEXT,
            website TEXT,
            payment_terms TEXT
        );

        CREATE TABLE IF NOT EXISTS supplier_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER REFERENCES suppliers(id),
            document_type TEXT,
            document_number TEXT,
            file_path TEXT,
            issue_date TEXT,
            expiry_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            message TEXT,
            time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // إنشاء حساب الأدمن الافتراضي إن لم يكن موجوداً
    const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@retailx.com');
    if (!admin) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (name, email, password, role, status) VALUES (?,?,?,?,?)')
          .run('Administrator', 'admin@retailx.com', hash, 'administrator', 'active');
    }
	// إضافة أعمدة user_id و user_name لجدول activity إن لم تكن موجودة
	const activityCols = db.pragma('table_info(activity)').map(c => c.name);
	if (!activityCols.includes('user_id')) {
		db.prepare('ALTER TABLE activity ADD COLUMN user_id INTEGER REFERENCES users(id)').run();
	}
	if (!activityCols.includes('user_name')) {
		db.prepare('ALTER TABLE activity ADD COLUMN user_name TEXT').run();
	}
    console.log('Database initialized');
}

module.exports = { getDB, initDB };