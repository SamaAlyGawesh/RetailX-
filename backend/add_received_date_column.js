const db = require('./db').getDB();
const cols = db.prepare("PRAGMA table_info('products')").all().map(c => c.name);
if (!cols.includes('received_date')) {
    db.exec('ALTER TABLE products ADD COLUMN received_date TEXT');
    console.log('Added column: received_date');
} else {
    console.log('Column received_date already exists');
}
