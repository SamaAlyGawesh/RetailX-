const db = require('./db').getDB();
const cols = db.prepare("PRAGMA table_info('suppliers')").all().map(c => c.name);
const addCol = (col, type) => {
    if (!cols.includes(col)) {
        db.exec('ALTER TABLE suppliers ADD COLUMN ' + col + ' ' + type);
        console.log('Added column: ' + col);
    } else {
        console.log('Column ' + col + ' already exists');
    }
};
addCol('address1', 'TEXT');
addCol('address2', 'TEXT');
addCol('website', 'TEXT');
addCol('payment_terms', 'TEXT');
console.log('Supplier columns ready.');
