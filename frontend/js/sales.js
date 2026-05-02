// sales.js - Sales processing with filtering, sorting & pagination

let currentSales = [];
let salesSort = { field: 'date', order: 'desc' };
let currentSalesPage = 1;
const salesLimit = 15;
let totalSalesPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    // New sale button (بدون تغيير)
    document.getElementById('addNewSale').onclick = async function(e) {
        e.preventDefault();
        if (!appState.isAuthenticated || !hasPermission('sales')) return;
        //await apiGetProducts();
		const allProds = await apiGetProducts(1, 9999);
		inventoryData = allProds.products; // نحدث المخزون المحلي بكل المنتجات
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
            await loadSalesPage(currentSalesPage);
            renderInventoryTable();
            renderDashboardInventory();
            updateDashboardStats();
            document.getElementById('newSaleModal').classList.remove('active');
            alert('Sale completed!');
        } catch (err) { alert(err.message); }
    };

    // Filter events (reset page to 1)
    ['filterSaleDate','filterTransID','filterCustomer','filterItems','filterTotal','filterSaleStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { currentSalesPage = 1; loadSalesPage(1); });
    });
    document.getElementById('filterSaleStatus')?.addEventListener('change', () => { currentSalesPage = 1; loadSalesPage(1); });

    // Sorting
    document.querySelectorAll('#salesTableMain th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            salesSort.order = (salesSort.field === field && salesSort.order === 'asc') ? 'desc' : 'asc';
            salesSort.field = field;
            updateSalesSortArrows();
            loadSalesPage(currentSalesPage);
        });
    });

    // Initial load
    if (appState.isAuthenticated) {
    loadSalesPage(1);
	}
});

async function loadSalesPage(page) {
    currentSalesPage = page;
    const data = await apiGetSales(page, salesLimit);
    currentSales = data.sales;
    totalSalesPages = data.pages;
    applySalesFilters();
}

function applySalesFilters() {
    const date = (document.getElementById('filterSaleDate')?.value || '').toLowerCase();
    const transID = (document.getElementById('filterTransID')?.value || '').toLowerCase();
    const customer = (document.getElementById('filterCustomer')?.value || '').toLowerCase();
    const items = (document.getElementById('filterItems')?.value || '').toLowerCase();
    const total = document.getElementById('filterTotal')?.value;
    const status = document.getElementById('filterSaleStatus')?.value;

    let filtered = currentSales.filter(s => {
        const matchDate = date ? (s.date || '').toLowerCase().includes(date) : true;
        const matchID = transID ? (s.id || '').toString().toLowerCase().includes(transID) : true;
        const matchCust = customer ? (s.customer || '').toLowerCase().includes(customer) : true;
        const matchItems = items ? (s.items || '').toString().toLowerCase().includes(items) : true;
        const matchTotal = total ? Math.abs(s.total - total) < 0.001 : true;
        const matchStatus = status ? s.status === status : true;
        return matchDate && matchID && matchCust && matchItems && matchTotal && matchStatus;
    });

    // Sort
    filtered.sort((a, b) => {
        let valA = a[salesSort.field];
        let valB = b[salesSort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return salesSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return salesSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    renderSalesTableHTML(filtered);
    renderPagination(currentSalesPage, totalSalesPages, 'salesPagination', (page) => {
        loadSalesPage(page);
    });
}

async function renderSalesTable() {
    await loadSalesPage(currentSalesPage);
}

function renderSalesTableHTML(sales) {
    const tbody = document.getElementById('salesTable');
    if (!tbody) return;
    const isAdmin = appState.currentUser?.role === 'administrator';
    const startNumber = (currentSalesPage - 1) * salesLimit + 1;

    tbody.innerHTML = sales.map((s, index) => {
        const deleteBtn = isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteSale('${s.id}')"><i class="fas fa-trash"></i></button> ` : '';
        return `<tr>
            <td>${startNumber + index}</td>
            <td>${s.date}</td>
            <td>${s.id}</td>
            <td>${s.customer}</td>
            <td>${s.items}</td>
            <td>${formatPrice(s.total)}</td>
            <td><span class="stock-status stock-in">${s.status}</span></td>
            <td>${deleteBtn}<button class="btn btn-sm btn-primary" onclick="printInvoice('${s.id}')"><i class="fas fa-print"></i></button></td>
        </tr>`;
    }).join('');
}

function updateSalesSortArrows() {
    document.querySelectorAll('#salesTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#salesTableMain th[data-sort="${salesSort.field}"] .sort-arrow`);
    if (active) active.textContent = salesSort.order === 'asc' ? ' ▲' : ' ▼';
}

// Keep existing functions
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
        await loadSalesPage(currentSalesPage);
        updateDashboardStats();
    } catch (err) { alert(err.message); }
};

window.printInvoice = function(id) {
    let sale = salesData.find(s => s.id === id);
    
    // نحاول نجيب اسم المنتج من inventoryData لو productId موجود
    let productName = 'Product Purchase';
    if (sale && sale.productId && inventoryData) {
        const product = inventoryData.find(p => p.id === sale.productId);
        if (product) {
            productName = product.name;
        }
    }

    if (sale) {
        let win = window.open('', '_blank', 'width=800,height=600');
        win.document.write(`
            <html><head><title>Invoice ${sale.id}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                .invoice { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
                .header { text-align: center; border-bottom: 2px solid #6d28d9; padding-bottom: 20px; margin-bottom: 20px; }
                .header h1 { color: #6d28d9; margin: 0; font-size: 32px; }
                .header p { color: #666; margin: 5px 0 0; }
                .details { display: flex; justify-content: space-between; margin-bottom: 30px; }
                .details div { font-size: 14px; line-height: 1.6; }
                .details strong { color: #333; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
                th { background: #f8f8f8; font-weight: 600; }
                .total { text-align: right; font-size: 20px; font-weight: bold; color: #6d28d9; margin-top: 20px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
                .footer p { margin: 5px 0; }
                button { margin-top: 20px; padding: 12px 24px; background: #6d28d9; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
                button:hover { background: #5b21b6; }
                @media print { body { background: white; } .invoice { box-shadow: none; } button { display: none; } }
            </style>
            </head><body>
            <div class="invoice">
                <div class="header">
                    <h1>RetailX</h1>
                    <p>Smart Inventory Management</p>
                </div>
                <div class="details">
                    <div>
                        <strong>Invoice Number:</strong> ${sale.id}<br>
                        <strong>Date:</strong> ${sale.date}<br>
                        <strong>Cashier:</strong> ${sale.cashier || 'N/A'}
                    </div>
                    <div style="text-align: right;">
                        <strong>Customer:</strong> ${sale.customer}<br>
                        <strong>Status:</strong> <span style="color: #10b981;">${sale.status}</span>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${productName}</td>
                            <td>${sale.items}</td>
                            <td>${appState.currency}${(sale.total / sale.items).toFixed(2)}</td>
                            <td>${appState.currency}${sale.total.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="total">
                    Total Amount: ${appState.currency}${sale.total.toFixed(2)}
                </div>
                <div class="footer">
                    <p>Thank you for shopping with RetailX!</p>
                    <p>support@retailx.com | Cairo, Egypt</p>
                </div>
            </div>
            <div style="text-align:center;">
                <button onclick="window.print()">🖨️ Print Invoice</button>
                <button onclick="window.close()" style="background: #f5f5f5; color: #333; margin-left: 10px;">Close</button>
            </div>
            </body></html>
        `);
        win.document.close();
    }
};