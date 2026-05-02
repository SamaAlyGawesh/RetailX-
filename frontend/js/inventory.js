// inventory.js - Product management with filtering, sorting & pagination

let currentInventory = [];
let inventorySort = { field: 'name', order: 'asc' };
let currentInventoryPage = 1;
const inventoryLimit = 15;
let totalInventoryPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    // Add product button
    document.getElementById('addNewProduct').onclick = () => {
        if (!hasPermission('addProduct')) return;
        document.getElementById('addProductModal').classList.add('active');
    };

    document.getElementById('submitProduct').onclick = async () => {
        if (!hasPermission('addProduct')) return;
        const name = document.getElementById('productName').value;
        const sku = document.getElementById('productSKU').value;
        const category = document.getElementById('productCategory').value;
        const quantity = parseInt(document.getElementById('productQuantity').value);
        const reorderLevel = parseInt(document.getElementById('reorderLevel').value);
        const price = parseFloat(document.getElementById('productPrice').value);
        const supplier = document.getElementById('productSupplier').value;

        if (!name || !sku || isNaN(quantity)) return alert('Fill all required fields');
        try {
            await apiCreateProduct({ name, sku, category, quantity, reorderLevel, price, supplier });
            await loadInventoryPage(currentInventoryPage);
            renderDashboardInventory();
            updateDashboardStats();
            document.getElementById('addProductModal').classList.remove('active');
            alert('Product added successfully!');
        } catch (err) { alert(err.message); }
    };

    document.getElementById('submitStockUpdate').onclick = async () => {
        if (!hasPermission('inventory')) return;
        const id = parseInt(document.getElementById('editProductId').value);
        const newQty = parseInt(document.getElementById('editNewStock').value);
        if (isNaN(newQty) || newQty < 0) return alert('Invalid quantity');
        try {
            await apiUpdateStock(id, newQty);
            await loadInventoryPage(currentInventoryPage);
            renderDashboardInventory();
            updateDashboardStats();
            document.getElementById('editProductModal').classList.remove('active');
        } catch (err) { alert(err.message); }
    };

    // Filter events: reset to page 1 and reload
    ['filterProductName','filterSKU','filterCategory','filterQuantity','filterReorder','filterPrice','filterStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            currentInventoryPage = 1;
            loadInventoryPage(1);
        });
    });
    document.getElementById('filterStatus')?.addEventListener('change', () => {
        currentInventoryPage = 1;
        loadInventoryPage(1);
    });

    // Sorting on headers (reload current page with sort)
    document.querySelectorAll('#inventoryTableMain th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            inventorySort.order = (inventorySort.field === field && inventorySort.order === 'asc') ? 'desc' : 'asc';
            inventorySort.field = field;
            updateInventorySortArrows();
            loadInventoryPage(currentInventoryPage);
        });
    });

    document.getElementById('exportInventory').onclick = async () => {
        if (!hasPermission('importExport')) return;
        // تصدير كل المنتجات (افتح كل الصفحات) – مبسط
        const allData = await apiGetProducts(1, 9999); // نجيب كل المنتجات
        if (allData.products.length === 0) return;
        exportCSV(allData.products.map(p => ({ Name: p.name, SKU: p.sku, Quantity: p.quantity, Price: p.price })), 'inventory.csv');
    };

    // Initial load
    if (appState.isAuthenticated) {
    loadInventoryPage(1);
	}
});

async function loadInventoryPage(page) {
    currentInventoryPage = page;
    const search = document.getElementById('inventorySearch')?.value || '';
    const data = await apiGetProducts(page, inventoryLimit, search);
    currentInventory = data.products;
    totalInventoryPages = data.pages;
    applyInventoryFilters();
}

function applyInventoryFilters() {
    // الفلترة المحلية بعد جلب الصفحة (لأن السيرفر يدعم البحث فقط، لكن الفلاتر الأخرى نطبقها هنا)
    const name = (document.getElementById('filterProductName')?.value || '').toLowerCase();
    const sku = (document.getElementById('filterSKU')?.value || '').toLowerCase();
    const category = (document.getElementById('filterCategory')?.value || '').toLowerCase();
    const quantity = document.getElementById('filterQuantity')?.value;
    const reorder = document.getElementById('filterReorder')?.value;
    const price = document.getElementById('filterPrice')?.value;
    const status = document.getElementById('filterStatus')?.value;

    let filtered = currentInventory.filter(p => {
        const matchName = name ? p.name.toLowerCase().includes(name) : true;
        const matchSKU = sku ? p.sku.toLowerCase().includes(sku) : true;
        const matchCat = category ? p.category.toLowerCase().includes(category) : true;
        const matchQty = quantity ? p.quantity == quantity : true;
        const matchReorder = reorder ? p.reorderLevel == reorder : true;
        const matchPrice = price ? Math.abs(p.price - price) < 0.001 : true;
        let matchStatus = true;
        if (status === 'in') matchStatus = p.quantity > p.reorderLevel;
        else if (status === 'low') matchStatus = p.quantity > 0 && p.quantity <= p.reorderLevel;
        else if (status === 'out') matchStatus = p.quantity === 0;
        return matchName && matchSKU && matchCat && matchQty && matchReorder && matchPrice && matchStatus;
    });

    // ترتيب (لأن البيانات قد لا تكون مرتبة حسب حقل الفرز من الخادم)
    filtered.sort((a, b) => {
        let valA = a[inventorySort.field];
        let valB = b[inventorySort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return inventorySort.order === 'asc' ? -1 : 1;
        if (valA > valB) return inventorySort.order === 'asc' ? 1 : -1;
        return 0;
    });

    renderInventoryTableHTML(filtered);
    renderPagination(currentInventoryPage, totalInventoryPages, 'inventoryPagination', (page) => {
        loadInventoryPage(page);
    });
}
async function renderInventoryTable() {
    await loadInventoryPage(currentInventoryPage);
}

function renderInventoryTableHTML(products) {
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;
    const startNumber = (currentInventoryPage - 1) * inventoryLimit + 1;

    tbody.innerHTML = products.map((p, index) => {
        const statusText = p.quantity === 0 ? 'Out of Stock' : (p.quantity <= p.reorderLevel ? 'Low Stock' : 'In Stock');
        const statusClass = p.quantity === 0 ? 'stock-out' : (p.quantity <= p.reorderLevel ? 'stock-low' : 'stock-in');
        let actions = '';
        if (hasPermission('addProduct')) {
            actions += `<button class="btn btn-sm btn-warning" onclick="updateStock(${p.id})"><i class="fas fa-edit"></i></button> `;
            actions += `<button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>`;
        }
        return `<tr>
            <td>${startNumber + index}</td>
            <td>${p.name}</td>
            <td>${p.sku}</td>
            <td>${p.category}</td>
            <td>${p.quantity}</td>
            <td>${p.reorderLevel}</td>
            <td>${formatPrice(p.price)}</td>
            <td><span class="stock-status ${statusClass}">${statusText}</span></td>
            <td>${actions}</td>
        </tr>`;
    }).join('');
}

function updateInventorySortArrows() {
    document.querySelectorAll('#inventoryTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#inventoryTableMain th[data-sort="${inventorySort.field}"] .sort-arrow`);
    if (active) active.textContent = inventorySort.order === 'asc' ? ' ▲' : ' ▼';
}

// Existing functions
window.updateStock = function(id) {
    if (!hasPermission('inventory')) return;
    const p = inventoryData.find(p => p.id === id);
    if (!p) return;
    document.getElementById('editProductId').value = p.id;
    document.getElementById('editProductName').value = p.name;
    document.getElementById('editCurrentStock').value = p.quantity;
    document.getElementById('editNewStock').value = p.quantity;
    document.getElementById('editProductModal').classList.add('active');
};

window.deleteProduct = async function(id) {
    if (!hasPermission('addProduct')) return;
    if (!confirm('Delete this product?')) return;
    try {
        await apiDeleteProduct(id);
        await loadInventoryPage(currentInventoryPage);
        renderDashboardInventory();
        updateDashboardStats();
    } catch (err) { alert(err.message); }
};