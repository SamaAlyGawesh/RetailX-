const db = require('./db').getDB();
const cols = db.prepare("PRAGMA table_info('products')").all().map(c => c.name);
const addCol = (col, type) => {
    if (!cols.includes(col)) {
        db.exec('ALTER TABLE products ADD COLUMN ' + col + ' ' + type);
        console.log('Added column: ' + col);
    } else {
        console.log('Column ' + col + ' already exists');
    }
};
addCol('supplier_id', 'INTEGER');
addCol('product_code', 'TEXT');
addCol('description', 'TEXT');
addCol('image', 'TEXT');
addCol('location', 'TEXT');
addCol('expiry_date', 'TEXT');
addCol('active', 'INTEGER DEFAULT 1');
console.log('Products table updated.');
