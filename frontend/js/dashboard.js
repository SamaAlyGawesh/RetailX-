// dashboard.js - Dashboard rendering & stats

let dashInventorySort = { field: 'name', order: 'asc' };

document.addEventListener('DOMContentLoaded', () => {
    /*document.getElementById('refreshDashboard').onclick = async () => {
        await apiGetProducts();
        await apiGetSales();
        await apiGetActivity();
        updateDashboardStats();
        renderDashboardInventory();
        renderRecentActivity();
    };*/
	document.getElementById('refreshDashboard').onclick = async () => {
		showLoader();
		try {
            const btn = document.getElementById('refreshDashboard');
            setButtonLoading(btn, 'Refreshing...');
			const allProducts = await apiGetProducts(1, 9999);
			const allSales = await apiGetSales(1, 9999);
			DataStore.setProducts(allProducts.products);
            //inventoryData = allProducts.products;
            //salesData = allSales.sales;
			DataStore.setSales(allSales.sales);
			await apiGetActivity();
			updateDashboardStats();
			renderDashboardInventory();
			renderRecentActivity();
            resetButton(btn);
		} catch (err) {
			showToast('Error refreshing dashboard', 'error');
		} finally {
            
			hideLoader();
		}
	};
    document.getElementById('viewAllInventory').onclick = () => navigateToPage('inventoryPage');
	
    // Filter events
    // Debounced filter for text inputs
	const debouncedRenderDashboard = debounce(renderDashboardInventory, 400);

	['filterDashProduct','filterDashSKU','filterDashQuantity'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('input', debouncedRenderDashboard);
	});

	// Select filter remains immediate (no debounce needed)
	document.getElementById('filterDashStatus')?.addEventListener('change', renderDashboardInventory);

    // Sorting
    document.querySelectorAll('#dashboardInventoryTableMain th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            dashInventorySort.order = (dashInventorySort.field === field && dashInventorySort.order === 'asc') ? 'desc' : 'asc';
            dashInventorySort.field = field;
            updateDashboardSortArrows();
            renderDashboardInventory();
        });
    });
});

function updateDashboardStats() {
    document.getElementById('totalProducts').innerText = DataStore.getProducts().length;
    document.getElementById('lowStock').innerText = DataStore.getProducts().filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel).length;
    document.getElementById('outOfStock').innerText = DataStore.getProducts().filter(p => p.quantity === 0).length;
    const todaySales = DataStore.getSales().filter(s => new Date(s.date).toDateString() === new Date().toDateString()).reduce((s, i) => s + i.total, 0);
    document.getElementById('todaySales').innerText = formatPrice(todaySales);
    document.getElementById('todaySalesValue').innerText = formatPrice(todaySales);
    const monthlySales = DataStore.getSales().filter(s => new Date(s.date).getMonth() === new Date().getMonth()).reduce((s, i) => s + i.total, 0);
    document.getElementById('monthlySalesValue').innerText = formatPrice(monthlySales);
    const grouped = groupSales(DataStore.getSales());
    document.getElementById('transactionCount').innerText = grouped.length;
	// تحديث شارة التنبيه في القائمة
	const badge = document.getElementById('dashboardBadge');
	if (badge) {
		const lowStockCount = DataStore.getProducts().filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel).length;
		badge.innerText = lowStockCount;
		badge.style.display = lowStockCount > 0 ? 'flex' : 'none';
	}
}

function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    container.innerHTML = DataStore.getActivity().slice(0, 5).map(a =>
        `<li class="activity-item">
            <div class="activity-icon"><i class="fas ${a.type === 'sale' ? 'fa-shopping-cart' : 'fa-box'}"></i></div>
            <div>
                <strong>${a.message}</strong><br>
                <small>${a.time || a.created_at} ${a.user_name ? 'by ' + a.user_name : ''}</small>
            </div>
        </li>`
    ).join('');
}

function renderDashboardInventory() {
    const tbody = document.getElementById('dashboardInventoryTable');
    if (!tbody) return;

    // Apply filters
    const name = (document.getElementById('filterDashProduct')?.value || '').toLowerCase();
    const sku = (document.getElementById('filterDashSKU')?.value || '').toLowerCase();
    const quantity = document.getElementById('filterDashQuantity')?.value;
    const status = document.getElementById('filterDashStatus')?.value;

    let filtered = DataStore.getProducts().filter(p => {
        const matchName = name ? p.name.toLowerCase().includes(name) : true;
        const matchSKU = sku ? p.sku.toLowerCase().includes(sku) : true;
        const matchQty = quantity ? p.quantity == quantity : true;
        let matchStatus = true;
        if (status === 'in') matchStatus = p.quantity > p.reorderLevel;
        else if (status === 'low') matchStatus = p.quantity > 0 && p.quantity <= p.reorderLevel;
        else if (status === 'out') matchStatus = p.quantity === 0;
        return matchName && matchSKU && matchQty && matchStatus;
    });

    // Sort
    filtered.sort((a, b) => {
        let valA = a[dashInventorySort.field];
        let valB = b[dashInventorySort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return dashInventorySort.order === 'asc' ? -1 : 1;
        if (valA > valB) return dashInventorySort.order === 'asc' ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = filtered.slice(0, 5).map((p, index) => {
    const statusClass = p.quantity === 0 ? 'stock-out' : (p.quantity <= p.reorderLevel ? 'stock-low' : 'stock-in');
    const statusText = p.quantity === 0 ? 'Out of Stock' : (p.quantity <= p.reorderLevel ? 'Low Stock' : 'In Stock');
		return `<tr>
			<td>${index + 1}</td>
			<td>${p.name}</td>
			<td>${p.sku}</td>
			<td>${p.quantity}</td>
			<td><span class="stock-status ${statusClass}">${statusText}</span></td>
			<td><button class="btn btn-sm btn-warning" onclick="updateStock(${p.id})"><i class="fas fa-sync-alt"></i></button></td>
		</tr>`;
	}).join('');
}

function updateDashboardSortArrows() {
    document.querySelectorAll('#dashboardInventoryTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#dashboardInventoryTableMain th[data-sort="${dashInventorySort.field}"] .sort-arrow`);
    if (active) active.textContent = dashInventorySort.order === 'asc' ? ' ▲' : ' ▼';
}