// backend/seed.js
const db = require('./db').getDB();

const categories = ['Electronics', 'Accessories', 'Clothing', 'Home', 'Sports'];
const supplierNames = ['TechPro', 'GadgetWorld', 'FashionHub', 'HomeStyle', 'SportMax', 'GlobalTrade', 'PrimeSupply', 'AlphaGoods', 'MegaStore', 'QuickShip'];
const firstNames = ['John', 'Jane', 'Mike', 'Emily', 'Chris', 'Sarah', 'David', 'Laura', 'James', 'Linda'];
const lastNames = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin'];
const productAdjectives = ['Wireless', 'Smart', 'Premium', 'Classic', 'Modern', 'Portable', 'Rechargeable', 'Bluetooth', 'LED', 'USB'];
const productNouns = ['Mouse', 'Keyboard', 'Headphones', 'Speaker', 'Charger', 'Cable', 'Lamp', 'Backpack', 'Watch', 'Camera'];

function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomPrice() { return (Math.random() * 200 + 5).toFixed(2); }
function pick(arr) { return arr[random(0, arr.length - 1)]; }

console.log('Seeding database...');

// 1. Suppliers (20)
console.log('Inserting suppliers...');
const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact, email, phone, productsSuppliedList, leadTime, addedDate) VALUES (?, ?, ?, ?, ?, ?, ?)');
for (let i = 0; i < 20; i++) {
    const name = pick(supplierNames) + ' ' + (i + 1);
    const contact = pick(firstNames) + ' ' + pick(lastNames);
    const email = name.toLowerCase().replace(/\s/g, '') + '@supply.com';
    const phone = '+1-' + random(200, 999) + '-' + random(1000, 9999);
    const productsList = JSON.stringify([pick(productAdjectives) + ' ' + pick(productNouns), pick(productAdjectives) + ' ' + pick(productNouns)]);
    const leadTime = random(2, 14);
    insertSupplier.run(name, contact, email, phone, productsList, leadTime, new Date().toISOString());
}

// 2. Products (1000)
console.log('Inserting 1000 products...');
const insertProduct = db.prepare('INSERT INTO products (name, sku, category, quantity, reorderLevel, price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?)');
for (let i = 1; i <= 1000; i++) {
    const adj = pick(productAdjectives);
    const noun = pick(productNouns);
    const name = `${adj} ${noun} ${i}`;
    const sku = 'SKU-' + String(i).padStart(6, '0');
    const category = pick(categories);
    const quantity = random(0, 100);
    const reorderLevel = random(5, 20);
    const price = randomPrice();
    const supplier = pick(supplierNames);
    insertProduct.run(name, sku, category, quantity, reorderLevel, price, supplier);
}

// 3. Sales (5000)
console.log('Inserting 5000 sales...');
const insertSale = db.prepare('INSERT INTO sales (id, date, customer, items, total, status, cashier) VALUES (?, ?, ?, ?, ?, ?, ?)');
const productIds = db.prepare('SELECT id, price FROM products').all();
for (let i = 1; i <= 5000; i++) {
    const product = pick(productIds);
    const qty = random(1, 5);
    const total = (product.price * qty).toFixed(2);
    const id = 'TXN-' + Date.now() + '-' + i;
    const date = new Date(Date.now() - random(0, 90 * 24 * 60 * 60 * 1000)).toLocaleString(); // خلال آخر 90 يوم
    const customer = pick(firstNames) + ' ' + pick(lastNames);
    insertSale.run(id, date, customer, qty, total, 'Completed', 'Admin');
}

// 4. Activity logs
console.log('Adding activities...');
const insertActivity = db.prepare('INSERT INTO activity (type, message, time) VALUES (?, ?, ?)');
insertActivity.run('system', 'Database seeded with sample data', new Date().toLocaleString());

console.log('Seeding completed!');