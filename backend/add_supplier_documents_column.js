const db = require('./db').getDB();
const cols = db.prepare("PRAGMA table_info('supplier_documents')").all().map(c => c.name);
if (!cols.includes('document_number')) {
    db.exec('ALTER TABLE supplier_documents ADD COLUMN document_number TEXT');
    console.log('Column added.');
} else {
    console.log('Column already exists.');
}
