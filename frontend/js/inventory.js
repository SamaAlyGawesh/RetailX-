// inventory.js - Product management

document.addEventListener('DOMContentLoaded', () => {
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
            await apiGetProducts();
            renderInventoryTable();
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
            await apiGetProducts();
            renderInventoryTable();
            renderDashboardInventory();
            updateDashboardStats();
            document.getElementById('editProductModal').classList.remove('active');
        } catch (err) { alert(err.message); }
    };

    document.getElementById('inventorySearch').addEventListener('input', renderInventoryTable);

    document.getElementById('exportInventory').onclick = async () => {
        if (!hasPermission('importExport')) return;
        if (inventoryData.length === 0) return;
        exportCSV(inventoryData.map(p => ({ Name: p.name, SKU: p.sku, Quantity: p.quantity, Price: p.price })), 'inventory.csv');
    };
});

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
        await apiGetProducts();
        renderInventoryTable();
        renderDashboardInventory();
        updateDashboardStats();
    } catch (err) { alert(err.message); }
};

async function renderInventoryTable() {
    const tbody = document.getElementById('inventoryTable');
    if (!tbody) return;
    const search = document.getElementById('inventorySearch')?.value.toLowerCase() || '';
    if (inventoryData.length === 0) await apiGetProducts();
    const filtered = inventoryData.filter(p => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));
    tbody.innerHTML = filtered.map(p => {
        const statusText = p.quantity === 0 ? 'Out of Stock' : (p.quantity <= p.reorderLevel ? 'Low Stock' : 'In Stock');
        const statusClass = p.quantity === 0 ? 'stock-out' : (p.quantity <= p.reorderLevel ? 'stock-low' : 'stock-in');
        let actions = `<button class="btn btn-sm btn-warning" onclick="updateStock(${p.id})"><i class="fas fa-edit"></i></button>`;
        if (hasPermission('addProduct')) actions += ` <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>`;
        return `<tr><td>${p.name}</td><td>${p.sku}</td><td>${p.category}</td><td>${p.quantity}</td><td>${p.reorderLevel}</td><td>${formatPrice(p.price)}</td><td><span class="stock-status ${statusClass}">${statusText}</span></td><td>${actions}</td></tr>`;
    }).join('');
}