// sales.js - Sales processing

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addNewSale').onclick = async function(e) {
        e.preventDefault();
        if (!appState.isAuthenticated || !hasPermission('sales')) return;
        await apiGetProducts();
        const available = inventoryData.filter(p => p.quantity > 0);
        if (available.length === 0) {
	    alert('No products available with quantity > 0. Please add stock first.');
	    return;
	}

        const select = document.getElementById('saleProduct');
        select.innerHTML = available.map(p =>
            `<option value="${p.id}" data-price="${p.price}">${p.name} - ${formatPrice(p.price)} (Stock: ${p.quantity})</option>`
        ).join('');
        document.getElementById('saleQuantity').value = 1;
        document.getElementById('saleCustomer').value = 'Walk-in Customer';
        const totEl = document.getElementById('saleTotal');
	if (totEl) totEl.innerText = available[0].price.toFixed(2);
        const currEl = document.getElementById('currencySymbolDisplay');
	if (currEl) currEl.innerText = appState.currency;
        document.getElementById('newSaleModal').classList.add('active');
    };

    document.getElementById('saleQuantity').addEventListener('input', updateSaleTotal);
    document.getElementById('saleProduct').addEventListener('change', updateSaleTotal);

    document.getElementById('processSale').onclick = async function(e) {
        e.preventDefault();
        if (!appState.isAuthenticated || !hasPermission('sales')) return;
        const select = document.getElementById('saleProduct');
        const productId = parseInt(select.value);
        const qty = parseInt(document.getElementById('saleQuantity').value);
        const customer = document.getElementById('saleCustomer').value || 'Walk-in Customer';
        if (isNaN(qty) || qty < 1) return alert('Invalid quantity');
        try {
            await apiCreateSale(customer, productId, qty, appState.currentUser.name);
            await apiGetProducts();
            await apiGetSales();
            renderSalesTable();
            renderInventoryTable();
            renderDashboardInventory();
            updateDashboardStats();
            document.getElementById('newSaleModal').classList.remove('active');
            alert('Sale completed!');
        } catch (err) { alert(err.message); }
    };
});

function updateSaleTotal() {
    const select = document.getElementById('saleProduct');
    const qty = parseInt(document.getElementById('saleQuantity').value) || 1;
    const price = parseFloat(select.options[select.selectedIndex]?.getAttribute('data-price') || 0);
    document.getElementById('saleTotal').innerText = (price * qty).toFixed(2);
}

window.deleteSale = async function(id) {
    if (appState.currentUser?.role !== 'administrator') return;
    if (!confirm('Delete this sale?')) return;
    try {
        await apiDeleteSale(id);
        await apiGetSales();
        renderSalesTable();
        updateDashboardStats();
    } catch (err) { alert(err.message); }
};

window.printInvoice = function(id) {
    const sale = salesData.find(s => s.id === id);
    if (!sale) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice ${sale.id}</title><style>body{font-family:Arial;padding:40px} h1{color:#6d28d9} .total{font-size:20px;font-weight:bold;color:#6d28d9}</style></head><body><h1>RetailX</h1><p>Invoice: ${sale.id}</p><p>Date: ${sale.date}</p><p>Customer: ${sale.customer}</p><p>Items: ${sale.items}</p><p class="total">Total: ${formatPrice(sale.total)}</p><button onclick="window.print()">Print</button></body></html>`);
    win.document.close();
};

async function renderSalesTable() {
    const tbody = document.getElementById('salesTable');
    if (!tbody) return;
    if (salesData.length === 0) await apiGetSales();
    const isAdmin = appState.currentUser?.role === 'administrator';
    tbody.innerHTML = salesData.map(s => {
        const deleteBtn = isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteSale('${s.id}')"><i class="fas fa-trash"></i></button> ` : '';
        return `<tr><td>${s.date}</td><td>${s.id}</td><td>${s.customer}</td><td>${s.items}</td><td>${formatPrice(s.total)}</td><td><span class="stock-status stock-in">${s.status}</span></td><td>${deleteBtn}<button class="btn btn-sm btn-primary" onclick="printInvoice('${s.id}')"><i class="fas fa-print"></i></button></td></tr>`;
    }).join('');
}
