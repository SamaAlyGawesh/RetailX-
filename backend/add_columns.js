cat > ~/retailx/backend/add_columns.js << 'EOF'
const db = require('./db').getDB();
const cols = db.prepare("PRAGMA table_info('users')").all().map(c => c.name);
const addCol = (col, type) => {
    if (!cols.includes(col)) {
        db.exec('ALTER TABLE users ADD COLUMN ' + col + ' ' + type);
        console.log('Added column: ' + col);
    } else {
        console.log('Column ' + col + ' already exists');
    }
};
addCol('status', "TEXT DEFAULT 'active'");
addCol('created_at', 'TEXT');
addCol('last_login', 'TEXT');
addCol('branch', 'TEXT');
db.exec("UPDATE users SET status = 'active' WHERE status IS NULL");
console.log('All columns are now present.');
EOF