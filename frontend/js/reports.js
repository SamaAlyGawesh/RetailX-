// reports.js - Report generation & export

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.view-report').forEach(btn => {
        btn.onclick = async () => {
            if (!hasPermission('reports')) return;
            const type = btn.getAttribute('data-report');
            // جلب جميع البيانات (بدون pagination) لتكون متاحة لجميع التقارير
			await apiGetProducts(1, 9999);
			await apiGetSales(1, 9999);
			await apiGetSuppliers(1, 9999);

            let extra = {};
            if (type === 'stock') {
                extra.category = document.getElementById('stockCategoryFilter')?.value || '';
            } else if (type === 'sales') {
                extra.from = document.getElementById('salesDateFrom')?.value || '';
                extra.to = document.getElementById('salesDateTo')?.value || '';
            }
            generateReportView(type, extra);
        };
    });

    document.querySelectorAll('.download-report').forEach(btn => {
        btn.onclick = async () => {
            if (!hasPermission('reports')) return;
            const type = btn.getAttribute('data-report');
            await apiGetProducts();
            await apiGetSales();
            await apiGetSuppliers();
            generateReportDownload(type);
        };
    });

    document.getElementById('generateReport').onclick = async () => {
        if (!hasPermission('reports')) return;
        await apiGetSales();
        const totalSales = salesData.reduce((a, b) => a + b.total, 0);
        const profit = totalSales * 0.4;
        document.getElementById('reportTitle').innerText = 'Profit & Sales Report';
        document.getElementById('reportContent').innerHTML = `<p><strong>Total Sales:</strong> ${formatPrice(totalSales)}</p><p><strong>Estimated Profit:</strong> ${formatPrice(profit)}</p><canvas id="profitChart" width="400" height="200"></canvas>`;
        document.getElementById('reportViewModal').classList.add('active');
        setTimeout(() => {
            const ctx = document.getElementById('profitChart')?.getContext('2d');
            if (ctx) new Chart(ctx, { type: 'bar', data: { labels: ['Sales', 'Profit'], datasets: [{ label: 'Amount', data: [totalSales, profit], backgroundColor: ['#10b981', '#8b5cf6'] }] } });
        }, 100);
    };

    document.getElementById('exportReportBtn').onclick = () => {
        const content = document.getElementById('reportContent').innerText;
        const blob = new Blob([content], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'report.csv';
        a.click();
    };

    if (window.location.hash === '#reports' || document.getElementById('reportsPage').classList.contains('active')) {
        renderMonthlySalesChart();
        renderTopProductsChart();
    }

    // Populate category filter on page load
    const stockCatFilter = document.getElementById('stockCategoryFilter');
    if (stockCatFilter) {
        const populateCategories = async () => {
            await apiGetProducts(1, 9999);
            const cats = [...new Set(inventoryData.map(p => p.category).filter(Boolean))].sort();
            cats.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                stockCatFilter.appendChild(opt);
            });
        };
        populateCategories();
    }
});

function generateReportView(type, extra) {
    let title = '', html = '';

    if (type === 'stock') {
        let filteredData = inventoryData;
        let categoryFilter = extra?.category || document.getElementById('stockCategoryFilter')?.value || '';
        if (categoryFilter) {
            filteredData = inventoryData.filter(p => p.category === categoryFilter);
            title = 'Stock Summary – ' + categoryFilter;
        } else {
            title = 'Stock Summary – All Categories';
        }

        const grouped = {};
        filteredData.forEach(p => {
            const cat = p.category || 'Uncategorized';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });
        const categories = Object.keys(grouped).sort();

        html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px;">
            <thead><tr style="background:#6d28d9;color:white;">
                <th>Product</th><th>SKU</th><th>Category</th><th>Qty</th><th>Price</th><th>Total Value</th>
            </tr></thead><tbody>`;

        let grandQty = 0, grandValue = 0;
        categories.forEach(cat => {
            const products = grouped[cat];
            html += `<tr style="background:#2d3748;color:#e2e8f0;"><td colspan="6"><strong>${cat}</strong> (${products.length} products)</td></tr>`;
            let catQty = 0, catValue = 0;
            products.forEach(p => {
                const total = p.price * p.quantity;
                html += `<tr><td>${p.name}</td><td>${p.sku}</td><td>${p.category}</td><td>${p.quantity}</td><td>${formatPrice(p.price)}</td><td>${formatPrice(total)}</td></tr>`;
                catQty += p.quantity;
                catValue += total;
            });
            html += `<tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;"><td colspan="3">Subtotal – ${cat}</td><td>${catQty}</td><td></td><td>${formatPrice(catValue)}</td></tr>`;
            grandQty += catQty;
            grandValue += catValue;
        });
        html += `<tr style="background:#6d28d9;color:white;font-weight:bold;"><td colspan="3">Grand Total</td><td>${grandQty}</td><td></td><td>${formatPrice(grandValue)}</td></tr>`;
        html += '</tbody></table>';

    } else if (type === 'lowstock') {
        title = 'Low Stock Alert';
        html = '<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#6d28d9;color:white"><th>Product</th><th>Current</th><th>Reorder</th></tr>';
        inventoryData.filter(p => p.quantity <= p.reorderLevel).forEach(p => html += `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${p.reorderLevel}</td></tr>`);
        html += '</table>';

    } else if (type === 'sales') {
		// فلترة حسب النطاق الزمني
		let filteredSales = salesData;
		const from = extra?.from || document.getElementById('salesDateFrom')?.value || '';
		const to = extra?.to || document.getElementById('salesDateTo')?.value || '';

		if (from || to) {
			filteredSales = salesData.filter(s => {
				const saleDate = new Date(s.date);
				if (isNaN(saleDate.getTime())) return false;
				if (from && saleDate < new Date(from)) return false;
				if (to && saleDate > new Date(to + 'T23:59:59')) return false;
				return true;
			});
			title = 'Sales Report';
			if (from) title += ` from ${from}`;
			if (to) title += ` to ${to}`;
		} else {
			title = 'Sales Report (All Time)';
		}

		// تجميع الفواتير
		const grouped = groupSales(filteredSales);

		let grandTotal = 0;
		let totalItems = 0;
		let rows = '';
		grouped.forEach(g => {
			totalItems += g.items;
			grandTotal += g.total;
			rows += `<tr>
				<td>${g.id}</td>
				<td>${g.date}</td>
				<td>${g.customer}</td>
				<td>${g.items}</td>
				<td>${formatPrice(g.total)}</td>
			</tr>`;
		});

		html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
			<thead><tr style="background:#6d28d9;color:white">
				<th>ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th>
			</tr></thead>
			<tbody>${rows}</tbody>
			<tfoot><tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;">
				<td colspan="3">Grand Total</td>
				<td>${totalItems}</td>
				<td>${formatPrice(grandTotal)}</td>
			</tr></tfoot></table>`;

    } else if (type === 'value') {
		title = 'Inventory Value';
		let totalQty = 0;
		let totalValue = 0;
		
		html = '<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">' +
			   '<tr style="background:#6d28d9;color:white"><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total Value</th></tr>';
		
		inventoryData.forEach(p => {
			const val = p.price * p.quantity;
			totalQty += p.quantity;
			totalValue += val;
			html += `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${formatPrice(p.price)}</td><td>${formatPrice(val)}</td></tr>`;
		});
		
		// صف الإجمالي
		html += `<tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;">
					<td>Grand Total</td>
					<td>${totalQty}</td>
					<td></td>
					<td>${formatPrice(totalValue)}</td>
				 </tr>`;
		html += '</table>';
	} else if (type === 'supplier') {
        title = 'Supplier Performance';
        html = '<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#6d28d9;color:white"><th>Name</th><th>Contact</th><th>Email</th><th>Lead Time</th></tr>';
        suppliersData.forEach(s => html += `<tr><td>${s.name}</td><td>${s.contact||'-'}</td><td>${s.email}</td><td>${s.leadTime} days</td></tr>`);
        html += '</table>';
	} else if (type === 'topselling') {
		// قراءة الفترة من extra
		const from = extra?.from || document.getElementById('topSellingDateFrom')?.value || '';
		const to = extra?.to || document.getElementById('topSellingDateTo')?.value || '';

		// فلترة المبيعات
		let filteredSales = salesData;
		if (from || to) {
			filteredSales = salesData.filter(s => {
				const saleDate = new Date(s.date);
				if (isNaN(saleDate.getTime())) return false;
				if (from && saleDate < new Date(from)) return false;
				if (to && saleDate > new Date(to + 'T23:59:59')) return false;
				return true;
			});
			title = 'Top Selling Products';
			if (from) title += ` from ${from}`;
			if (to) title += ` to ${to}`;
		} else {
			title = 'Top Selling Products (All Time)';
		}

		// حساب الكميات والإيرادات لكل منتج
		const productStats = {};
		filteredSales.forEach(s => {
			const pid = Number(s.productId);
			if (!pid) return;
			if (!productStats[pid]) productStats[pid] = { qty: 0, revenue: 0 };
			productStats[pid].qty += s.items || 0;
			productStats[pid].revenue += s.total || 0;
		});

		const productList = Object.entries(productStats).map(([pid, stats]) => {
			const product = inventoryData.find(p => p.id === Number(pid));
			return {
				name: product ? product.name : 'Unknown (ID ' + pid + ')',
				sku: product ? product.sku : '-',
				qty: stats.qty,
				revenue: stats.revenue
			};
		}).sort((a, b) => b.qty - a.qty);

		// حساب الإجمالي
		let totalQty = 0, totalRevenue = 0;
		let rows = '';
		productList.forEach(p => {
			totalQty += p.qty;
			totalRevenue += p.revenue;
			rows += `<tr><td>${p.name}</td><td>${p.sku}</td><td>${p.qty}</td><td>${formatPrice(p.revenue)}</td></tr>`;
		});

		html = `<div style="max-height: 60vh; overflow-y: auto;">
			<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px;">
				<thead><tr style="background:#6d28d9;color:white;position:sticky;top:0;">
					<th>Product</th><th>SKU</th><th>Quantity Sold</th><th>Total Revenue</th>
				</tr></thead>
				<tbody>${rows}</tbody>
				<tfoot><tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;position:sticky;bottom:0;">
					<td colspan="2">Grand Total</td>
					<td>${totalQty}</td>
					<td>${formatPrice(totalRevenue)}</td>
				</tr></tfoot>
			</table>
		</div>`;
	}
    document.getElementById('reportTitle').innerText = title;
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportViewModal').classList.add('active');
}

function generateReportDownload(type) {
    let csv = '', filename = `${type}_report.csv`;
    if (type === 'stock') { csv = 'Name,SKU,Qty,Price\n'; inventoryData.forEach(p => csv += `"${p.name}","${p.sku}",${p.quantity},${p.price}\n`); }
    else if (type === 'lowstock') { csv = 'Name,Current,Reorder\n'; inventoryData.filter(p => p.quantity <= p.reorderLevel).forEach(p => csv += `"${p.name}",${p.quantity},${p.reorderLevel}\n`); }
    else if (type === 'sales') { csv = 'ID,Date,Customer,Items,Total\n'; salesData.forEach(s => csv += `"${s.id}","${s.date}","${s.customer}",${s.items},${s.total}\n`); }
    else if (type === 'value') { csv = 'Name,Qty,UnitPrice,TotalValue\n'; inventoryData.forEach(p => csv += `"${p.name}",${p.quantity},${p.price},${(p.price*p.quantity).toFixed(2)}\n`); }
    else if (type === 'supplier') { csv = 'Name,Contact,Email,LeadTime\n'; suppliersData.forEach(s => csv += `"${s.name}","${s.contact||''}","${s.email}",${s.leadTime}\n`); }
	else if (type === 'topselling') {
		const from = document.getElementById('topSellingDateFrom')?.value || '';
		const to = document.getElementById('topSellingDateTo')?.value || '';

		let filteredSales = salesData;
		if (from || to) {
			filteredSales = salesData.filter(s => {
				const saleDate = new Date(s.date);
				if (isNaN(saleDate.getTime())) return false;
				if (from && saleDate < new Date(from)) return false;
				if (to && saleDate > new Date(to + 'T23:59:59')) return false;
				return true;
			});
		}

		const productStats = {};
		filteredSales.forEach(s => {
			const pid = Number(s.productId);
			if (!pid) return;
			if (!productStats[pid]) productStats[pid] = { qty: 0, revenue: 0 };
			productStats[pid].qty += s.items || 0;
			productStats[pid].revenue += s.total || 0;
		});
		const productList = Object.entries(productStats).map(([pid, stats]) => {
			const product = inventoryData.find(p => p.id === Number(pid));
			return {
				name: product ? product.name : 'Unknown (ID ' + pid + ')',
				sku: product ? product.sku : '-',
				qty: stats.qty,
				revenue: stats.revenue
			};
		}).sort((a, b) => b.qty - a.qty);

		csv = 'Product,SKU,QuantitySold,TotalRevenue\n';
		productList.forEach(p => csv += `"${p.name}","${p.sku}",${p.qty},${p.revenue}\n`);
		filename = 'topselling_report.csv';
	}
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function exportCSV(data, filename) {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function renderMonthlySalesChart() {
    const ctx = document.getElementById('monthlySalesChart')?.getContext('2d');
    if (!ctx) return;

    // تدمير المخطط القديم إذا وُجد
    const existingChart = Chart.getChart('monthlySalesChart');
    if (existingChart) existingChart.destroy();

    const monthly = {};
    salesData.forEach(s => {
        const d = new Date(s.date);
        if (isNaN(d.getTime())) return;
        const key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthly[key] = (monthly[key] || 0) + s.total;
    });
    const sorted = Object.entries(monthly).sort((a, b) => new Date(a[0]) - new Date(b[0])).slice(-6);
    const labels = sorted.map(e => e[0]);
    const data = sorted.map(e => e[1]);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Sales ($)',
                data,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function renderTopProductsChart() {
    const ctx = document.getElementById('topProductsChart')?.getContext('2d');
    if (!ctx) return;

    // تدمير القديم
    const existingChart = Chart.getChart('topProductsChart');
    if (existingChart) existingChart.destroy();

    const from = document.getElementById('salesDateFrom')?.value || '';
    const to = document.getElementById('salesDateTo')?.value || '';

    let filteredSales = salesData;
    if (from || to) {
        filteredSales = salesData.filter(s => {
            const saleDate = new Date(s.date);
            if (isNaN(saleDate.getTime())) return false;
            if (from && saleDate < new Date(from)) return false;
            if (to && saleDate > new Date(to + 'T23:59:59')) return false;
            return true;
        });
    }

    const productSales = {};
    filteredSales.forEach(s => {
        const pid = Number(s.productId);
        if (!pid) return;
        productSales[pid] = (productSales[pid] || 0) + (s.items || 0);
    });

    const sorted = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (sorted.length === 0) {
        // لا توجد بيانات كافية، نعرض رسالة في المخطط
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['No data available'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#334155']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: true }
                }
            }
        });
        return;
    }

    const productIds = sorted.map(e => Number(e[0]));
    const products = inventoryData.filter(p => productIds.includes(p.id));
    const labels = products.map(p => p.name);
    const data = sorted.map(e => e[1]);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: data.slice(0, labels.length),
                backgroundColor: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'].slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: { enabled: true },
                legend: { position: 'bottom' }
            }
        }
    });
}