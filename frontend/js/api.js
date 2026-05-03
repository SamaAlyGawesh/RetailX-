// api.js - All backend API calls

async function api(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (appState.token) headers['Authorization'] = `Bearer ${appState.token}`;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// ========== AUTH ==========
async function apiLogin(email, password) {
    const data = await api('POST', '/auth/login', { email, password });
    appState.token = data.token;
    appState.currentUser = data.user;
    appState.isAuthenticated = true;
    return data;
}

async function apiRegister(name, email, password, role) {
    return api('POST', '/auth/register', { name, email, password, role });
}

// ========== PRODUCTS (Pagination) ==========
async function apiGetProducts(page = 1, limit = 15, search = '') {
    const data = await api('GET', `/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    // البيانات تأتي كـ { products, total, page, pages }
    inventoryData = data.products;  // نضع المصفوفة فقط للتوافق مع الكود القديم
    return data;                    // نعيد الكائن كاملاً لاستعماله في pagination
}

async function apiCreateProduct(product) {
    return api('POST', '/products', product);
}

async function apiUpdateStock(id, quantity) {
    return api('PATCH', `/products/${id}/stock`, { quantity });
}

async function apiDeleteProduct(id) {
    return api('DELETE', `/products/${id}`);
}

// ========== SALES (Pagination) ==========
async function apiGetSales(page = 1, limit = 15) {
    const data = await api('GET', `/sales?page=${page}&limit=${limit}`);
    salesData = data.sales;
    return data;
}

async function apiCreateSale(customer, productId, quantity, cashier) {
    return api('POST', '/sales', { customer, productId, quantity, cashier });
}

async function apiDeleteSale(id) {
    return api('DELETE', `/sales/${id}`);
}

// ========== SUPPLIERS (Pagination) ==========
async function apiGetSuppliers(page = 1, limit = 15) {
    const data = await api('GET', `/suppliers?page=${page}&limit=${limit}`);
    suppliersData = data.suppliers;
    return data;
}

async function apiCreateSupplier(supplier) {
    return api('POST', '/suppliers', supplier);
}

async function apiUpdateSupplier(id, supplier) {
    return api('PUT', `/suppliers/${id}`, supplier);
}

async function apiDeleteSupplier(id) {
    return api('DELETE', `/suppliers/${id}`);
}

// ========== ACTIVITY ==========
async function apiGetActivity() {
    const data = await api('GET', '/activity');
    activityLog = data;
    return data;
}

// ========== BACKUP ==========
async function apiGetBackup() {
    return api('GET', '/backup');
}

// ========== USERS (Pagination) ==========
async function apiGetUsers(page = 1, limit = 15) {
    const data = await api('GET', `/users?page=${page}&limit=${limit}`);
    return data;  // { users, total, page, pages }
}

async function apiUpdateUserRole(userId, newRole) {
    return api('PATCH', `/users/${userId}/role`, { role: newRole });
}

async function apiCreateMultiSale(customer, items, discount, paymentMethod, notes, cashier, saleDate) {
    return api('POST', '/sales/multi', { customer, items, discount, paymentMethod, notes, cashier, saleDate });
}

async function apiDeleteInvoice(baseId) {
    return api('DELETE', `/sales/group/${baseId}`);
}