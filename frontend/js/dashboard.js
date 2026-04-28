// dashboard.js - Dashboard rendering & stats

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('refreshDashboard').onclick = async () => {
        await apiGetProducts();
        await apiGetSales();
        await apiGetActivity();
        updateDashboardStats();
        renderDashboardInventory();
        renderRecentActivity();
    };
    document.getElementById('viewAllInventory').onclick = () => navigateToPage('inventoryPage');
});

function updateDashboardStats() {
    document.getElementById('totalProducts').innerText = inventoryData.length;
    document.getElementById('lowStock').innerText = inventoryData.filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel).length;
    document.getElementById('outOfStock').innerText = inventoryData.filter(p => p.quantity === 0).length;
    const todaySales = salesData.filter(s => new Date(s.date).toDateString() === new Date().toDateString()).reduce((s, i) => s + i.total, 0);
    document.getElementById('todaySales').innerText = formatPrice(todaySales);
    document.getElementById('todaySalesValue').innerText = formatPrice(todaySales);
    const monthlySales = salesData.filter(s => new Date(s.date).getMonth() === new Date().getMonth()).reduce((s, i) => s + i.total, 0);
    document.getElementById('monthlySalesValue').innerText = formatPrice(monthlySales);
    document.getElementById('transactionCount').innerText = salesData.length;
}

function renderDashboardInventory() {
    const tbody = document.getElementById('dashboardInventoryTable');
    if (!tbody) return;
    tbody.innerHTML = inventoryData.slice(0, 5).map(p => {
        const statusClass = p.quantity === 0 ? 'stock-out' : (p.quantity <= p.reorderLevel ? 'stock-low' : 'stock-in');
        const statusText = p.quantity === 0 ? 'Out of Stock' : (p.quantity <= p.reorderLevel ? 'Low Stock' : 'In Stock');
        return `<tr><td>${p.name}</td><td>${p.sku}</td><td>${p.quantity}</td><td><span class="stock-status ${statusClass}">${statusText}</span></td><td><button class="btn btn-sm btn-warning" onclick="updateStock(${p.id})"><i class="fas fa-sync-alt"></i></button></td></tr>`;
    }).join('');
}

function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    container.innerHTML = activityLog.slice(0, 5).map(a =>
        `<li class="activity-item"><div class="activity-icon"><i class="fas ${a.type === 'sale' ? 'fa-shopping-cart' : 'fa-box'}"></i></div><div><strong>${a.message}</strong><br><small>${a.time || a.created_at}</small></div></li>`
    ).join('');
}