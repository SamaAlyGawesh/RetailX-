// backend/seed_v2.js - مصنفات دقيقة وإنتاج بيانات عالية الجودة
const db = require('./db').getDB();

// --- قوائم البيانات ---
const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Food & Drinks', 'Books', 'Toys', 'Automotive', 'Health', 'Office'];
const subcategories = {
  Electronics: ['Phones', 'Laptops', 'Audio', 'Cameras'],
  Clothing: ['Men', 'Women', 'Kids', 'Shoes'],
  'Home & Garden': ['Furniture', 'Decor', 'Kitchen'],
  Sports: ['Exercise', 'Outdoor', 'Team Sports'],
  'Food & Drinks': ['Snacks', 'Beverages', 'Organic'],
  Books: ['Fiction', 'Non-Fiction', 'Children'],
  Toys: ['Action Figures', 'Board Games', 'Puzzles'],
  Automotive: ['Parts', 'Accessories', 'Tools'],
  Health: ['Supplements', 'Personal Care', 'Medical'],
  Office: ['Stationery', 'Furniture', 'Electronics']
};
const adjectives = ['Premium', 'Ultra', 'Smart', 'Eco', 'Classic', 'Modern', 'Pro'];
const nouns = {
  Electronics: ['Phone', 'Laptop', 'Headphones', 'Speaker'],
  Clothing: ['Jacket', 'Sneakers', 'T-Shirt', 'Dress'],
  'Home & Garden': ['Sofa', 'Lamp', 'Blender', 'Plant Pot'],
  Sports: ['Treadmill', 'Yoga Mat', 'Bicycle', 'Football'],
  'Food & Drinks': ['Coffee', 'Protein Bar', 'Tea', 'Olive Oil'],
  Books: ['Novel', 'Biography', 'Coloring Book', 'Encyclopedia'],
  Toys: ['Action Figure', 'Board Game', 'Puzzle', 'Doll'],
  Automotive: ['Tire', 'Phone Mount', 'Wax Kit', 'Jump Starter'],
  Health: ['Vitamin C', 'Face Cream', 'Thermometer', 'Bandage'],
  Office: ['Notebook', 'Chair', 'Printer Ink', 'Desk Lamp']
};
const supplierNames = ['TechGear', 'FashionHub', 'HomePlus', 'SportLife', 'BookWorld', 'ToyPlanet', 'AutoZone', 'HealthMax', 'OfficeDepot', 'GlobalGoods'];
const firstNames = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Sam', 'Taylor', 'Cameron', 'Jamie', 'Avery'];
const lastNames = ['Smith', 'Lee', 'Garcia', 'Martinez', 'Brown', 'Williams', 'Johnson', 'Davis', 'Miller', 'Wilson'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function randomPrice(min = 5, max = 500) { return (Math.random() * (max - min) + min).toFixed(2); }

console.log('🌱 Seeding V2 ...');

// 1. Suppliers (20)
console.log('Inserting 20 suppliers...');
const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact, email, phone, productsSuppliedList, leadTime, addedDate) VALUES (?,?,?,?,?,?,?)');
for (let i = 0; i < 20; i++) {
  const name = pick(supplierNames) + ' ' + (i + 1);
  const contact = pick(firstNames) + ' ' + pick(lastNames);
  const email = name.toLowerCase().replace(/\s/g, '') + '@supply.com';
  const phone = '+1-' + rand(200,999) + '-' + rand(1000,9999);
  const cat = pick(categories);
  const products = JSON.stringify([
    pick(adjectives) + ' ' + pick(nouns[cat]),
    pick(adjectives) + ' ' + pick(nouns[cat])
  ]);
  const leadTime = rand(2,14);
  insertSupplier.run(name, contact, email, phone, products, leadTime, new Date().toISOString());
}

// 2. Products (150) - موزعة على الفئات
console.log('Inserting 150 products...');
const insertProduct = db.prepare('INSERT INTO products (name, sku, category, quantity, reorderLevel, price, supplier) VALUES (?,?,?,?,?,?,?)');
for (let i = 1; i <= 150; i++) {
  const cat = pick(categories);
  const sub = pick(subcategories[cat]);
  const adj = pick(adjectives);
  const noun = pick(nouns[cat]);
  const name = `${adj} ${noun} ${i}`;
  const sku = (cat.substring(0,3) + sub.substring(0,3) + String(i).padStart(4,'0')).toUpperCase();
  const category = cat; // تخزين الفئة الرئيسية
  const quantity = rand(0, 100);
  const reorderLevel = rand(5, 20);
  const price = randomPrice();
  const supplier = pick(supplierNames);
  insertProduct.run(name, sku, category, quantity, reorderLevel, price, supplier);
}

// 3. Sales (5000) - على مدار 12 شهرًا
console.log('Inserting 5000 sales...');
const insertSale = db.prepare('INSERT INTO sales (id, date, customer, items, total, status, cashier, productId, category) VALUES (?,?,?,?,?,?,?,?,?)');
const productsAll = db.prepare('SELECT id, name, price, category FROM products').all();
const now = new Date();
for (let i = 1; i <= 5000; i++) {
  const product = pick(productsAll);
  const qty = rand(1, 5);
  const total = (product.price * qty).toFixed(2);
  // توليد تاريخ عشوائي خلال آخر 12 شهرًا
  const saleDate = new Date(now - rand(0, 365) * 24 * 60 * 60 * 1000);
  const date = saleDate.toLocaleString();
  const id = 'TXN-' + Date.now() + '-' + i;
  const customer = pick(firstNames) + ' ' + pick(lastNames);
  insertSale.run(id, date, customer, qty, total, 'Completed', 'Admin', product.id, product.category);
}

// 4. Activity
console.log('Adding activities...');
db.prepare('INSERT INTO activity (type, message, time) VALUES (?,?,?)').run('system', 'Seeding V2 completed', new Date().toLocaleString());

console.log('✅ Done! 150 products, 5000 categorized sales.');