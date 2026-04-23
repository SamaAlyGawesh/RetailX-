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

// ========== PRODUCTS ==========
async function apiGetProducts(search = '') {
    const data = await api('GET', `/products${search ? `?search=${encodeURIComponent(search)}` : ''}`);
    inventoryData = data;
    return data;
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

// ========== SALES ==========
async function apiGetSales() {
    const data = await api('GET', '/sales');
    salesData = data;
    return data;
}

async function apiCreateSale(customer, productId, quantity, cashier) {
    return api('POST', '/sales', { customer, productId, quantity, cashier });
}

async function apiDeleteSale(id) {
    return api('DELETE', `/sales/${id}`);
}

// ========== SUPPLIERS ==========
async function apiGetSuppliers() {
    const data = await api('GET', '/suppliers');
    suppliersData = data;
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