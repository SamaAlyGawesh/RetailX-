// reports.js - Report generation & export
let lastReportData = null;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.view-report').forEach(btn => {
        btn.onclick = async () => {
            if (!hasPermission('reports')) return;
            const type = btn.getAttribute('data-report');
            // جلب جميع البيانات (بدون pagination) لتكون متاحة لجميع التقارير
            const [prods, sales, supps] = await Promise.all([
                apiGetProducts(1, 9999),
                apiGetSales(1, 9999),
                apiGetSuppliers(1, 9999)
            ]);
            DataStore.setProducts(prods.products);
            DataStore.setSales(sales.sales);
            DataStore.setSuppliers(supps.suppliers);

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

    document.querySelectorAll('.pdf-report').forEach(btn => {
        btn.onclick = () => {
            if (!hasPermission('reports')) return;
            const type = btn.getAttribute('data-report');
            generateReportPDF(type);
        };
    });

    document.getElementById('generateReport').onclick = async () => {
        if (!hasPermission('reports')) return;
        //await apiGetSales();
        const totalSales = DataStore.getSales().reduce((a, b) => a + b.total, 0);
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
        const title = document.getElementById('reportTitle').innerText;
        let csv = '\uFEFFsep=;\n'; // BOM + تحديد الفاصل فاصلة منقوطة

        if (lastReportData) {
            switch (lastReportData.type) {
                case 'stock':
                    csv += 'Name;SKU;Category;Qty;Price;Total Value\n';
                    lastReportData.data.forEach(p => {
                        csv += `"${p.name}";"${p.sku}";"${p.category || ''}";${p.quantity};${formatPrice(p.price).replace(appState.currency, '')};${(p.price * p.quantity).toFixed(2)}\n`;
                    });
                    break;
                case 'lowstock':
                    csv += 'Name;Current;Reorder\n';
                    lastReportData.data.forEach(p => {
                        csv += `"${p.name}";${p.quantity};${p.reorderLevel}\n`;
                    });
                    break;
                case 'sales':
                    csv += 'ID;Date;Customer;Items;Total;Cashier\n';   // أضف Cashier في الرأس
                    lastReportData.data.forEach(g => {
                        csv += `"${g.id}";"${g.date}";"${g.customer}";${g.items};${g.total};${g.cashier || ''}\n`;   // أضف g.cashier
                    });
                    break;
                case 'value':
                    csv += 'Name;Qty;UnitPrice;TotalValue\n';
                    lastReportData.data.forEach(p => {
                        csv += `"${p.name}";${p.quantity};${formatPrice(p.price).replace(appState.currency, '')};${(p.price * p.quantity).toFixed(2)}\n`;
                    });
                    break;
                case 'supplier':
                    csv += 'Name;Contact;Email;LeadTime\n';
                    lastReportData.data.forEach(s => {
                        csv += `"${s.name}";"${s.contact || ''}";"${s.email}";${s.leadTime}\n`;
                    });
                    break;
                case 'topselling':
                    csv += 'Product;SKU;QuantitySold;TotalRevenue\n';
                    lastReportData.data.forEach(p => {
                        csv += `"${p.name}";"${p.sku}";${p.qty};${p.revenue}\n`;
                    });
                    break;
                default:
                    csv += document.getElementById('reportContent').innerText;
            }
        } else {
            csv += document.getElementById('reportContent').innerText;
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (title || 'report').replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_') + '.csv';
        a.click();
    };

    if (window.location.hash === '#reports' || document.getElementById('reportsPage').classList.contains('active')) {
        renderMonthlySalesChart();
        renderTopProductsChart();
    }

    // Populate category filter on page load
    async function populateStockCategories() {
        if (!appState.isAuthenticated) return;
        
        // نجيب المنتجات إذا مش موجودة
        if (DataStore.getProducts().length === 0) {
            await apiGetProducts(1, 9999);
        }
        
        const stockCatFilter = document.getElementById('stockCategoryFilter');
        if (!stockCatFilter) return;
        
        const cats = [...new Set(
            DataStore.getProducts()
                .filter(p => p.name !== '__category_placeholder__')
                .map(p => p.category)
                .filter(Boolean)
        )].sort();
        
        // حفظ القيمة الحالية قبل إعادة البناء
        const currentValue = stockCatFilter.value;
        
        stockCatFilter.innerHTML = '<option value="">All Categories</option>';
        cats.forEach(cat => {
            stockCatFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        
        // استعادة القيمة المختارة
        if (currentValue && cats.includes(currentValue)) {
            stockCatFilter.value = currentValue;
        }
    }

    // تشغيل عند تحميل الصفحة
    if (document.getElementById('reportsPage')) {
        populateStockCategories();
    }
});

function generateReportView(type, extra) {
    let title = '', html = '';
    const langObj = translations[currentLang] || translations['en'];

    if (type === 'stock') {
        let filteredData = DataStore.getProducts();
        let categoryFilter = extra?.category || document.getElementById('stockCategoryFilter')?.value || '';
        if (categoryFilter) {
            filteredData = DataStore.getProducts().filter(p => p.category === categoryFilter);
            title = (langObj.report1Title || 'Stock Summary') + ' – ' + categoryFilter;
        } else {
            title = (langObj.report1Title || 'Stock Summary') + ' – ' + (langObj.allCategoriesText || 'All Categories');
        }

        const grouped = {};
        filteredData.forEach(p => {
            const cat = p.category || (langObj.uncategorizedText || 'Uncategorized');
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(p);
        });
        const categories = Object.keys(grouped).sort();

        html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:14px;">
            <thead><tr style="background:#6d28d9;color:white;">
                <th>${langObj.reportProductCol || 'Product'}</th>
                <th>${langObj.reportSKUCol || 'SKU'}</th>
                <th>${langObj.reportCategoryCol || 'Category'}</th>
                <th>${langObj.reportQtyCol || 'Qty'}</th>
                <th>${langObj.reportPriceCol || 'Price'}</th>
                <th>${langObj.reportTotalValueCol || 'Total Value'}</th>
            </tr></thead><tbody>`;

        let grandQty = 0, grandValue = 0;
        categories.forEach(cat => {
            const products = grouped[cat];
            html += `<tr style="background:#2d3748;color:#e2e8f0;"><td colspan="6"><strong>${cat}</strong> (${products.length} ${langObj.productsText || 'products'})</td></tr>`;
            let catQty = 0, catValue = 0;
            products.forEach(p => {
                const total = p.price * p.quantity;
                html += `<tr><td>${p.name}</td><td>${p.sku}</td><td>${p.category}</td><td>${p.quantity}</td><td>${formatPrice(p.price)}</td><td>${formatPrice(total)}</td></tr>`;
                catQty += p.quantity;
                catValue += total;
            });
            html += `<tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;"><td colspan="3">${langObj.reportSubtotalLabel || 'Subtotal'} – ${cat}</td><td>${catQty}</td><td></td><td>${formatPrice(catValue)}</td></tr>`;
            grandQty += catQty;
            grandValue += catValue;
        });
        html += `<tr style="background:#6d28d9;color:white;font-weight:bold;"><td colspan="3">${langObj.reportGrandTotalLabel || 'Grand Total'}</td><td>${grandQty}</td><td></td><td>${formatPrice(grandValue)}</td></tr>`;
        html += '</tbody></table>';

        lastReportData = { type: 'stock', data: filteredData };

    } else if (type === 'lowstock') {
        title = langObj.report2Title || 'Low Stock Alert';
        html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#6d28d9;color:white"><th>${langObj.reportProductCol || 'Product'}</th><th>${langObj.reportCurrentCol || 'Current'}</th><th>${langObj.reportReorderCol || 'Reorder'}</th></tr>`;
        DataStore.getProducts().filter(p => p.quantity <= p.reorderLevel).forEach(p => html += `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${p.reorderLevel}</td></tr>`);
        html += '</table>';

        const items = DataStore.getProducts().filter(p => p.quantity <= p.reorderLevel);
        lastReportData = { type: 'lowstock', data: items };

    } else if (type === 'sales') {
        let filteredSales = DataStore.getSales();
        const from = extra?.from || document.getElementById('salesDateFrom')?.value || '';
        const to = extra?.to || document.getElementById('salesDateTo')?.value || '';

        if (from || to) {
            filteredSales = DataStore.getSales().filter(s => {
                const saleDate = new Date(s.date);
                if (isNaN(saleDate.getTime())) return false;
                if (from && saleDate < new Date(from)) return false;
                if (to && saleDate > new Date(to + 'T23:59:59')) return false;
                return true;
            });
            title = langObj.report3Title || 'Sales Report';
            if (from) title += ` ${langObj.reportFromLabel || 'from'} ${from}`;
            if (to) title += ` ${langObj.reportToLabel || 'to'} ${to}`;
        } else {
            title = (langObj.report3Title || 'Sales Report') + ' (' + (langObj.allTimeText || 'All Time') + ')';
        }

        const grouped = groupSales(filteredSales);

        let grandTotal = 0, totalItems = 0;
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
                <td>${g.cashier || '—'}</td>
            </tr>`;
        });

        html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
            <thead><tr style="background:#6d28d9;color:white">
                <th>${langObj.reportIDCol || 'ID'}</th>
                <th>${langObj.reportDateCol || 'Date'}</th>
                <th>${langObj.reportCustomerCol || 'Customer'}</th>
                <th>${langObj.reportItemsCol || 'Items'}</th>
                <th>${langObj.reportTotalCol || 'Total'}</th>
                <th>${langObj.reportCashierCol || 'Cashier'}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;">
                <td colspan="3">${langObj.reportGrandTotalLabel || 'Grand Total'}</td>
                <td>${totalItems}</td>
                <td>${formatPrice(grandTotal)}</td>
                <td></td>
            </tr></tfoot></table>`;

        lastReportData = { type: 'sales', data: grouped };

    } else if (type === 'value') {
        title = langObj.report4Title || 'Inventory Value';
        let totalQty = 0;
        let totalValue = 0;

        html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
            <tr style="background:#6d28d9;color:white"><th>${langObj.reportProductCol || 'Product'}</th><th>${langObj.reportQtyCol || 'Qty'}</th><th>${langObj.reportUnitPriceCol || 'Unit Price'}</th><th>${langObj.reportTotalValueCol || 'Total Value'}</th></tr>`;

        DataStore.getProducts().forEach(p => {
            const val = p.price * p.quantity;
            totalQty += p.quantity;
            totalValue += val;
            html += `<tr><td>${p.name}</td><td>${p.quantity}</td><td>${formatPrice(p.price)}</td><td>${formatPrice(val)}</td></tr>`;
        });

        html += `<tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;">
            <td>${langObj.reportGrandTotalLabel || 'Grand Total'}</td>
            <td>${totalQty}</td>
            <td></td>
            <td>${formatPrice(totalValue)}</td></tr>`;
        html += '</table>';

        lastReportData = { type: 'value', data: DataStore.getProducts() };

    } else if (type === 'supplier') {
        title = langObj.report6Title || 'Supplier Performance';
        html = `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr style="background:#6d28d9;color:white"><th>${langObj.reportNameCol || 'Name'}</th><th>${langObj.reportContactCol || 'Contact'}</th><th>${langObj.reportEmailCol || 'Email'}</th><th>${langObj.reportLeadTimeCol || 'Lead Time'}</th></tr>`;
        DataStore.getSuppliers().forEach(s => html += `<tr><td>${s.name}</td><td>${s.contact||'-'}</td><td>${s.email}</td><td>${s.leadTime} ${langObj.daysText || 'days'}</td></tr>`);
        html += '</table>';

        lastReportData = { type: 'supplier', data: DataStore.getSuppliers() };

    } else if (type === 'topselling') {
        const from = extra?.from || document.getElementById('topSellingDateFrom')?.value || '';
        const to = extra?.to || document.getElementById('topSellingDateTo')?.value || '';

        let filteredSales = DataStore.getSales();
        if (from || to) {
            filteredSales = DataStore.getSales().filter(s => {
                const saleDate = new Date(s.date);
                if (isNaN(saleDate.getTime())) return false;
                if (from && saleDate < new Date(from)) return false;
                if (to && saleDate > new Date(to + 'T23:59:59')) return false;
                return true;
            });
            title = langObj.report5Title || 'Top Selling Products';
            if (from) title += ` ${langObj.reportFromLabel || 'from'} ${from}`;
            if (to) title += ` ${langObj.reportToLabel || 'to'} ${to}`;
        } else {
            title = (langObj.report5Title || 'Top Selling Products') + ' (' + (langObj.allTimeText || 'All Time') + ')';
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
            const product = DataStore.getProducts().find(p => p.id === Number(pid));
            return {
                name: product ? product.name : ('Unknown (ID ' + pid + ')'),
                sku: product ? product.sku : '-',
                qty: stats.qty,
                revenue: stats.revenue
            };
        }).sort((a, b) => b.qty - a.qty);

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
                    <th>${langObj.reportProductCol || 'Product'}</th>
                    <th>${langObj.reportSKUCol || 'SKU'}</th>
                    <th>${langObj.reportQtySoldCol || 'Quantity Sold'}</th>
                    <th>${langObj.reportTotalRevenueCol || 'Total Revenue'}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr style="background:#1a202c;color:#cbd5e0;font-weight:bold;position:sticky;bottom:0;">
                    <td colspan="2">${langObj.reportGrandTotalLabel || 'Grand Total'}</td>
                    <td>${totalQty}</td>
                    <td>${formatPrice(totalRevenue)}</td>
                </tr></tfoot>
            </table>
        </div>`;

        lastReportData = { type: 'topselling', data: productList };
    }

    document.getElementById('reportTitle').innerText = title;
    document.getElementById('reportContent').innerHTML = html;
    document.getElementById('reportViewModal').classList.add('active');
}

function generateReportDownload(type) {
    let csv = '', filename = `${type}_report.csv`;
    const header = '\uFEFFsep=;\n'; // BOM + تعليمات لـExcel

    if (type === 'stock') {
        csv += header + 'Name;SKU;Qty;Price\n';
        DataStore.getProducts().forEach(p => csv += `"${p.name}";"${p.sku}";${p.quantity};${p.price}\n`);
    }
    else if (type === 'lowstock') {
        csv += header + 'Name;Current;Reorder\n';
        DataStore.getProducts().filter(p => p.quantity <= p.reorderLevel).forEach(p => csv += `"${p.name}";${p.quantity};${p.reorderLevel}\n`);
    }
    else if (type === 'sales') {
        csv += header + 'ID;Date;Customer;Items;Total;Cashier\n';
        DataStore.getSales().forEach(s => csv += `"${s.id}";"${s.date}";"${s.customer}";${s.items};${s.total};"${s.cashier || ''}"\n`);
    }
    else if (type === 'value') {
        csv += header + 'Name;Qty;UnitPrice;TotalValue\n';
        DataStore.getProducts().forEach(p => csv += `"${p.name}";${p.quantity};${p.price};${(p.price * p.quantity).toFixed(2)}\n`);
    }
    else if (type === 'supplier') {
        csv += header + 'Name;Contact;Email;LeadTime\n';
        DataStore.getSuppliers().forEach(s => csv += `"${s.name}";"${s.contact || ''}";"${s.email}";${s.leadTime}\n`);
    }
    else if (type === 'topselling') {
        const from = document.getElementById('topSellingDateFrom')?.value || '';
        const to = document.getElementById('topSellingDateTo')?.value || '';

        let filteredSales = DataStore.getSales();
        if (from || to) {
            filteredSales = DataStore.getSales().filter(s => {
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
            const product = DataStore.getProducts().find(p => p.id === Number(pid));
            return {
                name: product ? product.name : 'Unknown (ID ' + pid + ')',
                sku: product ? product.sku : '-',
                qty: stats.qty,
                revenue: stats.revenue
            };
        }).sort((a, b) => b.qty - a.qty);

        csv += header + 'Product;SKU;QuantitySold;TotalRevenue\n';
        productList.forEach(p => csv += `"${p.name}";"${p.sku}";${p.qty};${p.revenue}\n`);
        filename = 'topselling_report.csv';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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

async function renderMonthlySalesChart() {
	await apiGetSales(1, 9999);
    const ctx = document.getElementById('monthlySalesChart')?.getContext('2d');
    if (!ctx) return;

    // تدمير المخطط القديم إذا وُجد
    const existingChart = Chart.getChart('monthlySalesChart');
    if (existingChart) existingChart.destroy();

    const monthly = {};
    DataStore.getSales().forEach(s => {
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

async function renderTopProductsChart() {
	// ❤️ أضف هذا السطر – بيضمن إن المخزون محدث وكامل
    await apiGetProducts(1, 9999);
    const ctx = document.getElementById('topProductsChart')?.getContext('2d');
    if (!ctx) return;

    // تدمير القديم
    const existingChart = Chart.getChart('topProductsChart');
    if (existingChart) existingChart.destroy();

    const from = document.getElementById('salesDateFrom')?.value || '';
    const to = document.getElementById('salesDateTo')?.value || '';

    let filteredSales = DataStore.getSales();
    if (from || to) {
        filteredSales = DataStore.getSales().filter(s => {
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
    const products = DataStore.getProducts().filter(p => productIds.includes(p.id));
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

function generateReportPDF(type) {
    const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let title = '';
    const rows = [];

    switch (type) {
        case 'stock':
            title = 'Stock Summary';
            doc.setFontSize(16);
            doc.text(title, 14, 20);
            DataStore.getProducts().forEach(p => rows.push([p.name, p.sku, p.category || '', p.quantity, formatPrice(p.price), (p.price * p.quantity).toFixed(2)]));
            doc.autoTable({
                head: [['Name', 'SKU', 'Category', 'Qty', 'Price', 'Total Value']],
                body: rows,
                startY: 30
            });
            break;
        case 'lowstock':
            title = 'Low Stock Alert';
            doc.setFontSize(16);
            doc.text(title, 14, 20);
            DataStore.getProducts().filter(p => p.quantity <= p.reorderLevel).forEach(p => rows.push([p.name, p.quantity, p.reorderLevel]));
            doc.autoTable({
                head: [['Product', 'Current', 'Reorder']],
                body: rows,
                startY: 30
            });
            break;
        case 'sales':
            title = 'Sales Report';
            doc.setFontSize(16);
            doc.text(title, 14, 20);
            DataStore.getSales().forEach(s => rows.push([s.id, s.date, s.customer, s.items, formatPrice(s.total), s.cashier || '']));
            doc.autoTable({
                head: [['ID', 'Date', 'Customer', 'Items', 'Total', 'Cashier']],
                body: rows,
                startY: 30
            });
            break;
        case 'value':
            title = 'Inventory Value';
            doc.setFontSize(16);
            doc.text(title, 14, 20);
            DataStore.getProducts().forEach(p => rows.push([p.name, p.quantity, formatPrice(p.price), (p.price * p.quantity).toFixed(2)]));
            doc.autoTable({
                head: [['Product', 'Qty', 'Unit Price', 'Total Value']],
                body: rows,
                startY: 30
            });
            break;
        case 'supplier':
            title = 'Supplier Performance';
            doc.setFontSize(16);
            doc.text(title, 14, 20);
            DataStore.getSuppliers().forEach(s => rows.push([s.name, s.contact || '', s.email, s.leadTime]));
            doc.autoTable({
                head: [['Name', 'Contact', 'Email', 'Lead Time']],
                body: rows,
                startY: 30
            });
            break;
        case 'topselling':
            title = 'Top Selling Products';
            doc.setFontSize(16);
            doc.text(title, 14, 20);
            // نكرر حساب المنتجات الأكثر بيعًا كما في generateReportView
            const from = document.getElementById('topSellingDateFrom')?.value || '';
            const to = document.getElementById('topSellingDateTo')?.value || '';
            let filteredSales = DataStore.getSales();
            if (from || to) {
                filteredSales = DataStore.getSales().filter(s => {
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
                const product = DataStore.getProducts().find(p => p.id === Number(pid));
                return {
                    name: product ? product.name : 'Unknown (ID ' + pid + ')',
                    sku: product ? product.sku : '-',
                    qty: stats.qty,
                    revenue: stats.revenue
                };
            }).sort((a, b) => b.qty - a.qty);
            productList.forEach(p => rows.push([p.name, p.sku, p.qty, formatPrice(p.revenue)]));
            doc.autoTable({
                head: [['Product', 'SKU', 'Quantity Sold', 'Total Revenue']],
                body: rows,
                startY: 30
            });
            break;
    }

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}