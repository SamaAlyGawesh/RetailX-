// backend/seed_v3.js - Realistic data with weighted cost & proper relationships
const db = require('./db').getDB();

const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Food & Drinks', 'Books', 'Toys', 'Automotive', 'Health', 'Office'];
const supplierNames = ['TechPro', 'FashionHub', 'HomeStyle', 'SportMax', 'BookWorld', 'ToyPlanet', 'AutoZone', 'HealthMax', 'OfficeDepot', 'GlobalGoods', 'PrimeSupply', 'AlphaGoods', 'MegaStore', 'QuickShip', 'SmartVendor', 'EcoSource', 'TopTier', 'ApexSupply', 'ZenithGoods', 'BrightTrade', 'OmniSource', 'SuperVend', 'MaxStock', 'DirectDeal', 'SwiftGoods'];
const firstNames = ['John', 'Jane', 'Mike', 'Emily', 'Chris', 'Sarah', 'David', 'Laura', 'James', 'Linda', 'Robert', 'Mary', 'William', 'Patricia', 'Richard', 'Jennifer', 'Joseph', 'Michael', 'Charles', 'Elizabeth'];
const lastNames = ['Smith', 'Johnson', 'Brown', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall'];
const adjectives = ['Wireless', 'Smart', 'Premium', 'Eco', 'Classic', 'Modern', 'Pro', 'Ultra', 'Deluxe', 'Advanced'];
const nouns = ['Mouse', 'Keyboard', 'Headphones', 'Speaker', 'Charger', 'Cable', 'Lamp', 'Backpack', 'Watch', 'Camera', 'Shirt', 'Shoes', 'Blender', 'Treadmill', 'Novel', 'Action Figure', 'Tire', 'Vitamin', 'Notebook', 'Desk Lamp'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function randomPrice() { return (Math.random() * 500 + 5).toFixed(2); }

console.log('🌱 Seed V3 started...');

// 1. Suppliers (25)
console.log('Inserting 25 suppliers...');
const insertSupplier = db.prepare('INSERT INTO suppliers (supplier_code, name, contact, email, phone, productsSuppliedList, leadTime, addedDate, address1, address2, website, payment_terms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
const suppliersIds = [];
for (let i = 1; i <= 25; i++) {
    const name = pick(supplierNames) + ' ' + i;
    const code = 'sup' + String(i).padStart(6, '0');
    const contact = pick(firstNames) + ' ' + pick(lastNames);
    const email = name.toLowerCase().replace(/\s/g, '') + '@supply.com';
    const phone = '+1-' + rand(200, 999) + '-' + rand(1000, 9999);
    const productsList = JSON.stringify([pick(adjectives) + ' ' + pick(nouns), pick(adjectives) + ' ' + pick(nouns)]);
    const leadTime = rand(2, 14);
    const addedDate = new Date();
    const address1 = rand(100, 999) + ' ' + pick(['Main St', 'Oak Ave', 'Pine Rd', 'Elm Blvd', 'Cedar Ln']);
    const address2 = pick(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix']) + ', ' + pick(['NY', 'CA', 'IL', 'TX', 'AZ']);
    const website = 'https://' + name.toLowerCase().replace(/\s/g, '') + '.com';
    const paymentTerms = pick(['Net 30', 'Net 60', 'Due on Receipt', 'Net 15']);
    
    insertSupplier.run(code, name, contact, email, phone, productsList, leadTime, addedDate.toISOString(), address1, address2, website, paymentTerms);
    suppliersIds.push(i); // id starts from 1
}

// 2. Products (200) with realistic stock & cost
console.log('Inserting 200 products...');
const insertProduct = db.prepare('INSERT INTO products (sku, name, category, quantity, reorderLevel, price, total_cost, supplier_id, product_code, description, image, location, expiry_date, received_date, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
const productSkus = [];
for (let i = 1; i <= 200; i++) {
    const adj = pick(adjectives);
    const noun = pick(nouns);
    const name = `${adj} ${noun} ${i}`;
    const sku = (adj.substring(0,3) + noun.substring(0,3) + String(i).padStart(4,'0')).toUpperCase();
    const category = pick(categories);
    const quantity = rand(0, 100);
    const reorderLevel = rand(5, 20);
    const price = parseFloat(randomPrice());
    const totalCost = price * quantity;
    const supplierId = rand(1, 25);
    const productCode = sku; // Fixed code = SKU
    const description = `High-quality ${adj.toLowerCase()} ${noun.toLowerCase()} for daily use.`;
    const location = 'Aisle ' + rand(1, 12) + ', Shelf ' + rand(1, 4);
    const expiryDate = rand(0, 10) > 7 ? new Date(Date.now() + rand(30, 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null;
    const receivedDate = new Date(Date.now() - rand(0, 60) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const active = rand(0, 10) > 1 ? 1 : 0; // 10% inactive
    
    insertProduct.run(sku, name, category, quantity, reorderLevel, price, totalCost, supplierId, productCode, description, null, location, expiryDate, receivedDate, active);
    productSkus.push({ id: i, sku, price });
}

// 3. Sales (5000) using weighted average cost deduction
console.log('Inserting 5000 sales...');
const insertSale = db.prepare('INSERT INTO sales (id, date, customer, items, total, status, cashier, productId, category) VALUES (?,?,?,?,?,?,?,?,?)');
const now = new Date();
const cashiers = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];

for (let i = 1; i <= 5000; i++) {
    const product = pick(productSkus);
    const qty = rand(1, 5);
    const productDetails = db.prepare('SELECT price, quantity, total_cost, category FROM products WHERE id = ?').get(product.id);
    const currentQty = productDetails.quantity;
    const currentTotalCost = productDetails.total_cost || 0;
    const avgCost = currentQty > 0 ? currentTotalCost / currentQty : productDetails.price;
    const newQty = currentQty - qty;
    const newTotalCost = currentTotalCost - (avgCost * qty);
    const saleTotal = productDetails.price * qty; // Selling price (not cost)
    
    const saleId = 'TXN-' + Date.now() + '-' + i;
    const date = new Date(now - rand(0, 365) * 24 * 60 * 60 * 1000).toLocaleString();
    const customer = pick(firstNames) + ' ' + pick(lastNames);
    
    // Update product stock with weighted average
    db.prepare('UPDATE products SET quantity = ?, total_cost = ? WHERE id = ?').run(newQty < 0 ? 0 : newQty, newTotalCost < 0 ? 0 : newTotalCost, product.id);
    insertSale.run(saleId, date, customer, qty, saleTotal, 'Completed', pick(cashiers), product.id, productDetails.category);
}

// 4. Activity logs
console.log('Adding activities...');
for (let i = 0; i < 20; i++) {
    db.prepare('INSERT INTO activity (type, message, time) VALUES (?,?,?)').run('system', `Seed activity ${i+1}`, new Date().toLocaleString());
}

console.log('✅ Seed V3 completed! 25 suppliers, 200 products, 5000 sales.');