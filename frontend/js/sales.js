// sales.js - Multi-product sales with discount, payment method & notes

let currentSales = [];
let salesSort = { field: 'date', order: 'desc' };
let currentSalesPage = 1;
const salesLimit = 15;
let totalSalesPages = 1;

let saleItems = [];
let isProcessingSale = false;
let allSalesForFilter = [];

// ========== دوال تجميع الفواتير ==========
function groupSales(salesArray) {
    const grouped = {};
    salesArray.forEach(s => {
        // استخراج baseId (الجزء قبل آخر "-")
        const parts = s.id.split('-');
        parts.pop(); // إزالة productId الملحق
        const baseId = parts.join('-');
        if (!grouped[baseId]) {
            grouped[baseId] = {
                id: baseId,
                date: s.date,
                customer: s.customer,
                items: 0,
                total: 0,
                status: s.status,
                products: [],
                categories: new Set()
            };
        }
        const group = grouped[baseId];
        group.items += s.items || 0;
        group.total += s.total || 0;
        group.products.push({
            productId: s.productId,
            name: inventoryData.find(p => p.id === s.productId)?.name || 'Unknown',
            category: s.category || '',
            quantity: s.items,
            unitPrice: s.total / s.items,
            total: s.total
        });
        if (s.category) group.categories.add(s.category);
    });
    return Object.values(grouped).map(g => ({
        ...g,
        category: Array.from(g.categories).join(', ')
    }));
}

document.addEventListener('DOMContentLoaded', () => {

    // ========== فتح مودال بيع جديد ==========
    document.getElementById('addNewSale').onclick = async function(e) {
        e.preventDefault();
        if (!appState.isAuthenticated || !hasPermission('sales')) return;

        await apiGetProducts(1, 9999);
        saleItems = [];
        document.getElementById('saleCustomer').value = 'Walk-in Customer';
        document.getElementById('saleDiscount').value = 0;
        document.getElementById('salePaymentMethod').value = 'Cash';
        document.getElementById('saleNotes').value = '';
        document.getElementById('saleItemsBody').innerHTML = '';

        // تاريخ اليوم
        const now = new Date();
        const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('saleDate').value = localDatetime;

        addSaleItemRow();
        updateSaleTotal();
        document.getElementById('newSaleModal').classList.add('active');
    };

    // ========== زر إضافة صف جديد ==========
    document.getElementById('addSaleItemBtn').onclick = () => addSaleItemRow();

    // ========== حذف صف ==========
    document.getElementById('saleItemsBody').addEventListener('click', (e) => {
        if (e.target.closest('.remove-sale-item')) {
            const row = e.target.closest('tr');
            const index = Array.from(row.parentNode.children).indexOf(row);
            saleItems.splice(index, 1);
            row.remove();
            refreshAllRows();
            updateSaleTotal();
        }
    });

    // ========== تغيير المنتج / الكمية ==========
    // تغيير المنتج / الكمية
	document.getElementById('saleItemsBody').addEventListener('input', (e) => {
		const row = e.target.closest('tr');
		if (!row) return;
		const index = Array.from(row.parentNode.children).indexOf(row);
		if (e.target.classList.contains('sale-product-select')) {
			const opt = e.target.selectedOptions[0];
			saleItems[index] = {
				productId: parseInt(e.target.value),
				name: opt.text,
				price: parseFloat(opt.dataset.price),
				category: opt.dataset.category,
				quantity: saleItems[index].quantity || 1
			};
			// تحديث الصف الحالي فقط (لن نعيد بناء الكل، لأن التكرار سيتم التعامل معه لاحقاً)
			refreshSingleRowCategory(row, index);
			// لتحديث تعطيل المنتجات في الصفوف الأخرى، نستدعي refreshAllRows أيضاً (أفضل)
			refreshAllRows(); // أبقها للموثوقية
			updateStockCell(row, saleItems[index].productId);
		} else if (e.target.classList.contains('sale-qty-input')) {
			saleItems[index].quantity = parseInt(e.target.value) || 1;
		}
		updateRowTotal(row, index);
		updateSaleTotal();
	});

    // ========== تنفيذ البيع ==========
    document.getElementById('processSale').onclick = async function(e) {
        e.preventDefault();
        if (isProcessingSale) return;
        if (!appState.isAuthenticated || !hasPermission('sales')) return;

        if (saleItems.length === 0) { alert('Add at least one product.'); return; }

        for (let i = 0; i < saleItems.length; i++) {
            const item = saleItems[i];
            if (!item.productId) { alert(`Please select a product for row ${i + 1}.`); return; }
            if (!item.quantity || item.quantity < 1) { alert(`Quantity for row ${i + 1} must be at least 1.`); return; }
            const product = inventoryData.find(p => p.id === item.productId);
            if (product && item.quantity > product.quantity) {
                alert(`${product.name} has only ${product.quantity} in stock. Please reduce the quantity.`);
                return;
            }
        }

        const customer = document.getElementById('saleCustomer').value.trim() || 'Walk-in Customer';
        if (!customer) { alert('Please enter a customer name.'); return; }

        const discount = parseFloat(document.getElementById('saleDiscount').value) || 0;
        if (discount < 0 || discount > 100) { alert('Discount must be between 0 and 100.'); return; }

        const paymentMethod = document.getElementById('salePaymentMethod').value;
        const notes = document.getElementById('saleNotes').value;
        const localDateStr = document.getElementById('saleDate').value;
        if (!localDateStr) { alert('Please select a date.'); return; }

        const selectedDate = new Date(localDateStr);
        const utcDateStr = selectedDate.toISOString();
        const now = new Date();
        if (selectedDate.getTime() > now.getTime() + 60000) {
            alert('Future date is not allowed for sales.');
            return;
        }

        isProcessingSale = true;
        const btn = document.getElementById('processSale');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        const items = saleItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            category: item.category || '' // إرسال الفئة مع كل منتج
        }));

        try {
            await apiCreateMultiSale(customer, items, discount, paymentMethod, notes, appState.currentUser.name, utcDateStr);
            await apiGetProducts(1, 9999);
            await loadSalesPage(currentSalesPage);
            renderInventoryTable();
            renderDashboardInventory();
            updateDashboardStats();
            document.getElementById('newSaleModal').classList.remove('active');
            alert('Sale completed!');
        } catch (err) {
            alert(err.message);
        } finally {
            isProcessingSale = false;
            btn.disabled = false;
            btn.innerHTML = 'Process Sale';
        }
    };

    // ========== أحداث الفلاتر ==========
        ['filterSaleDate','filterTransID','filterCustomer','filterItems','filterTotal','filterSaleStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            allSalesForFilter = [];
            currentSalesPage = 1;
            loadSalesPage(1);
        });
    });
    document.getElementById('filterSaleStatus')?.addEventListener('change', () => {
        allSalesForFilter = [];
        currentSalesPage = 1;
        loadSalesPage(1);
    });

    // ========== الفرز ==========
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

    if (appState.isAuthenticated) loadSalesPage(1);

    // ========== زر Today ==========
    document.getElementById('fillTodayBtn').onclick = () => {
        const n = new Date();
        n.setMinutes(n.getMinutes() - 1);
        const local = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('saleDate').value = local;
    };
	
		// ملء فلتر الفئة في جدول المبيعات (فقط إذا كان المستخدم مسجلاً)
	if (appState.isAuthenticated) {
		const populateSaleCategoryFilter = async () => {
			await apiGetProducts(1, 9999);
			const categories = [...new Set(inventoryData.map(p => p.category).filter(Boolean))].sort();
			const select = document.getElementById('filterSaleCategory');
			if (select) {
				select.innerHTML = '<option value="">All</option>';
				categories.forEach(c => {
					select.innerHTML += `<option value="${c}">${c}</option>`;
				});
			}
		};
		populateSaleCategoryFilter();
	}
	document.getElementById('filterSaleCategory').addEventListener('change', () => {
		currentSalesPage = 1;
		loadSalesPage(1);
	});
});

function isAnySalesFilterActive() {
    const fields = ['filterSaleDate','filterTransID','filterCustomer','filterItems','filterTotal','filterSaleStatus'];
    return fields.some(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.tagName === 'SELECT') return el.value !== '';
        return el.value.trim() !== '';
    });
}

function addSaleItemRow() {
    const row = document.createElement('tr');
    const categories = [...new Set(inventoryData.map(p => p.category).filter(Boolean))].sort();
    const catOptions = ['<option value="">All</option>', ...categories.map(c => `<option value="${c}">${c}</option>`)].join('');

    row.innerHTML = `
        <td><select class="form-control sale-product-select" style="width:100%;"></select></td>
        <td><select class="form-control sale-category-select" style="width:100%;">${catOptions}</select></td>
        <td class="stock-info" style="text-align:center; font-weight:600;">-</td>
        <td><input type="number" class="form-control sale-qty-input" value="1" min="1"></td>
        <td class="unit-price">$0.00</td>
        <td class="row-total">$0.00</td>
        <td><button class="btn btn-sm btn-danger remove-sale-item"><i class="fas fa-times"></i></button></td>
    `;
    document.getElementById('saleItemsBody').appendChild(row);

    saleItems.push({ productId: null, name: '', price: 0, quantity: 1, category: '' });
    refreshSingleRowCategory(row, saleItems.length - 1);

    const select = row.querySelector('.sale-product-select');
    if (select.options.length > 0) {
        select.selectedIndex = 0;
        const opt = select.options[0];
        const idx = saleItems.length - 1;
        saleItems[idx] = {
            productId: parseInt(opt.value),
            name: opt.text,
            price: parseFloat(opt.dataset.price),
            category: opt.dataset.category,
            quantity: 1
        };
        row.querySelector('.unit-price').innerText = formatPrice(saleItems[idx].price);
        row.querySelector('.row-total').innerText = formatPrice(saleItems[idx].price);
        updateStockCell(row, saleItems[idx].productId);
    }

    const catSelect = row.querySelector('.sale-category-select');
    catSelect.addEventListener('change', () => {
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        refreshSingleRowCategory(row, rowIndex);
        const prodSelect = row.querySelector('.sale-product-select');
        if (prodSelect.options.length > 0) {
            prodSelect.selectedIndex = 0;
            prodSelect.dispatchEvent(new Event('input'));
        }
    });

    updateSaleTotal();
}

function updateRowTotal(row, index) {
    const item = saleItems[index];
    if (!item || !item.price) return;
    const total = item.price * item.quantity;
    row.querySelector('.row-total').innerText = formatPrice(total);
    row.querySelector('.unit-price').innerText = formatPrice(item.price);
}

function updateSaleTotal() {
    let subtotal = saleItems.reduce((sum, item) => sum + (item.price * item.quantity || 0), 0);
    const discount = parseFloat(document.getElementById('saleDiscount')?.value) || 0;
    const grandTotal = subtotal - (subtotal * discount / 100);
    document.getElementById('saleGrandTotal').innerText = formatPrice(grandTotal > 0 ? grandTotal : 0);
}

// ========== دوال الصفحة والجدول (باقية دون تغيير كبير) ==========
async function loadSalesPage(page) {
    currentSalesPage = page;
    if (isAnySalesFilterActive()) {
        if (allSalesForFilter.length === 0) {
            const data = await api('GET', `/sales?page=1&limit=9999`);
            allSalesForFilter = data.sales;
        }
        currentSales = allSalesForFilter;
        applySalesFilters();
    } else {
        const data = await api('GET', `/sales?page=${page}&limit=${salesLimit}`);
        currentSales = data.sales;
        totalSalesPages = data.pages;
        applySalesFilters();
    }
}

function applySalesFilters() {
    const date = (document.getElementById('filterSaleDate')?.value || '').toLowerCase();
    const transID = (document.getElementById('filterTransID')?.value || '').toLowerCase();
    const customer = (document.getElementById('filterCustomer')?.value || '').toLowerCase();
    const items = document.getElementById('filterItems')?.value;
    const total = document.getElementById('filterTotal')?.value;
    const status = document.getElementById('filterSaleStatus')?.value;
    const filterCategory = document.getElementById('filterSaleCategory')?.value || '';

    // تجميع الفواتير أولاً
    let grouped = groupSales(currentSales);

    // تطبيق الفلاتر على المجموعات
    let filtered = grouped.filter(g => {
        const matchDate = date ? (g.date || '').toLowerCase().includes(date) : true;
        const matchID = transID ? g.id.toLowerCase().includes(transID) : true;
        const matchCust = customer ? g.customer.toLowerCase().includes(customer) : true;
        const matchItems = items ? g.items == items : true;
        const matchTotal = total ? Math.abs(g.total - total) < 0.001 : true;
        const matchStatus = status ? g.status === status : true;
        const matchCategory = filterCategory ? g.category.toLowerCase().includes(filterCategory.toLowerCase()) : true;
        return matchDate && matchID && matchCust && matchItems && matchTotal && matchCategory && matchStatus;
    });

    // ترتيب
    filtered.sort((a, b) => {
        let valA = a[salesSort.field];
        let valB = b[salesSort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return salesSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return salesSort.order === 'asc' ? 1 : -1;
        return 0;
    });

	const filterActive = isAnySalesFilterActive();
    if (filterActive) {
        totalSalesPages = Math.ceil(filtered.length / salesLimit);
        if (currentSalesPage > totalSalesPages) currentSalesPage = 1;
        const start = (currentSalesPage - 1) * salesLimit;
        const pageItems = filtered.slice(start, start + salesLimit);
        renderSalesTableHTML(pageItems);
    } else {
        renderSalesTableHTML(filtered);
    }

    renderPagination(currentSalesPage, totalSalesPages, 'salesPagination', (page) => {
        loadSalesPage(page);
    });
}

function renderSalesTableHTML(groups) {
    const tbody = document.getElementById('salesTable');
    if (!tbody) return;
    const isAdmin = appState.currentUser?.role === 'administrator';
    const startNumber = (currentSalesPage - 1) * salesLimit + 1;

    tbody.innerHTML = groups.map((g, index) => {
        const deleteBtn = isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteInvoice('${g.id}')"><i class="fas fa-trash"></i></button> ` : '';
        return `<tr>
            <td>${startNumber + index}</td>
            <td>${g.date}</td>
            <td>${g.id}</td>
            <td>${g.customer}</td>
            <td>${g.items}</td>
            <td>${formatPrice(g.total)}</td>
            <td>${g.category || '-'}</td>
            <td><span class="stock-status stock-in">${g.status}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewInvoice('${g.id}')"><i class="fas fa-eye"></i></button>
                ${deleteBtn}
            </td>
        </tr>`;
    }).join('');
}

function updateSalesSortArrows() {
    document.querySelectorAll('#salesTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#salesTableMain th[data-sort="${salesSort.field}"] .sort-arrow`);
    if (active) active.textContent = salesSort.order === 'asc' ? ' ▲' : ' ▼';
}

async function renderSalesTable() {
    await loadSalesPage(currentSalesPage);
}

// ========== دوال أخرى ==========
window.deleteSale = async function(id) {
    if (appState.currentUser?.role !== 'administrator') return;
    if (!confirm('Delete this sale?')) return;
    try {
        await apiDeleteSale(id);
        await loadSalesPage(currentSalesPage);
        updateDashboardStats();
    } catch (err) { alert(err.message); }
};

// طباعة الفاتورة (سيتم تحسينها لاحقاً)
window.printInvoice = function(id) {
    const sale = salesData.find(s => s.id === id);
    if (!sale) return;
    const win = window.open('', '_blank');
    win.document.write(`<h1>Invoice ${sale.id}</h1><pre>${JSON.stringify(sale, null, 2)}</pre><button onclick="window.print()">Print</button>`);
    win.document.close();
};

function refreshSingleRowCategory(row, index) {
    const catSelect = row.querySelector('.sale-category-select');
    const selectedCategory = catSelect.value;
    const prodSelect = row.querySelector('.sale-product-select');
    const currentValue = prodSelect.value; // القيمة الحالية (قبل التحديث)

    // المنتجات المختارة في الصفوف الأخرى
    const selectedIds = new Set(
        saleItems
            .filter((item, idx) => idx !== index && item.productId)
            .map(item => item.productId)
    );

    let available = inventoryData;
    if (selectedCategory) {
        available = available.filter(p => p.category === selectedCategory);
    }

    const optionsHtml = available
        .map(p => {
            const disabledAttr = selectedIds.has(p.id) ? 'disabled' : '';
            const selectedAttr = p.id == currentValue ? 'selected' : '';
            return `<option value="${p.id}" data-price="${p.price}" data-category="${p.category}" ${selectedAttr} ${disabledAttr}>
                ${p.name} - ${formatPrice(p.price)} (${p.quantity} in stock)
            </option>`;
        })
        .join('');

    prodSelect.innerHTML = optionsHtml;
    
    // إعادة تعيين القيمة المختارة يدوياً (تأكيد)
    if (currentValue && prodSelect.querySelector(`option[value="${currentValue}"]`)) {
        prodSelect.value = currentValue;
    }

    // تحديث خلية المخزون بناءً على المنتج المستقر
    const finalProductId = prodSelect.value ? parseInt(prodSelect.value) : null;
    updateStockCell(row, finalProductId);
    
    // تحديث بيانات السلة إذا كان المنتج قد تغير (اختياري لضمان التزامن)
    if (finalProductId && saleItems[index]) {
        const opt = prodSelect.selectedOptions[0];
        saleItems[index].productId = finalProductId;
        saleItems[index].price = parseFloat(opt.dataset.price) || 0;
        saleItems[index].category = opt.dataset.category || '';
        saleItems[index].name = opt.text;
    }
}

function refreshAllRows() {
    const rows = document.querySelectorAll('#saleItemsBody tr');
    rows.forEach((row, index) => {
        refreshSingleRowCategory(row, index);
    });
}

function updateStockCell(row, productId) {
    const stockCell = row.querySelector('.stock-info');
    if (!stockCell) return;
    const product = inventoryData.find(p => p.id === productId);
    if (product) {
        stockCell.textContent = product.quantity;
        if (product.quantity === 0) stockCell.style.color = 'var(--danger)';
        else if (product.quantity <= product.reorderLevel) stockCell.style.color = 'var(--warning)';
        else stockCell.style.color = 'var(--secondary)';
    } else {
        stockCell.textContent = '-';
    }
}

// ========== دوال الفاتورة ==========
window.viewInvoice = function(baseId) {
    const group = groupSales(currentSales).find(g => g.id === baseId);
    if (!group) return;

    const productsHtml = group.products.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.category || '-'}</td>
            <td>${p.quantity}</td>
            <td>${formatPrice(p.unitPrice)}</td>
            <td>${formatPrice(p.total)}</td>
        </tr>
    `).join('');

    document.getElementById('invoiceDetailContent').innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
            <div><strong>Invoice:</strong> ${group.id}<br><strong>Date:</strong> ${group.date}<br><strong>Customer:</strong> ${group.customer}</div>
            <div><strong>Status:</strong> ${group.status}</div>
        </div>
        <table class="inventory-table">
            <thead><tr><th>Product</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
            <tbody>${productsHtml}</tbody>
            <tfoot><tr style="font-weight:bold;"><td colspan="4">Grand Total</td><td>${formatPrice(group.total)}</td></tr></tfoot>
        </table>
    `;

    // تخزين baseId لزر الطباعة
    document.getElementById('printInvoiceBtn').onclick = () => {
        printInvoiceFromGroup(group);
    };

    document.getElementById('invoiceDetailModal').classList.add('active');
};

function printInvoiceFromGroup(group) {
    const win = window.open('', '_blank');
    const productsRows = group.products.map(p => `
        <tr><td>${p.name}</td><td>${p.quantity}</td><td>${formatPrice(p.unitPrice)}</td><td>${formatPrice(p.total)}</td></tr>
    `).join('');
    win.document.write(`
        <html><head><title>Invoice ${group.id}</title>
        <style>
            body { font-family: 'Segoe UI', Arial; padding: 20px; background: #f5f5f5; }
            .invoice { max-width: 800px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
            .header { text-align: center; border-bottom: 2px solid #6d28d9; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { color: #6d28d9; margin:0; font-size: 32px; }
            .details { display: flex; justify-content: space-between; margin-bottom: 30px; font-size:14px; }
            table { width:100%; border-collapse: collapse; margin-bottom:20px; }
            th, td { padding:12px; text-align:left; border-bottom:1px solid #eee; }
            th { background:#f8f8f8; }
            .total { text-align:right; font-size:20px; font-weight:bold; color:#6d28d9; margin-top:20px; }
            .footer { text-align:center; margin-top:30px; padding-top:20px; border-top:1px solid #eee; font-size:12px; color:#999; }
            button { margin-top:20px; padding:12px 24px; background: #6d28d9; color:white; border:none; border-radius:6px; cursor:pointer; }
            @media print { body { background:white; } .invoice { box-shadow:none; } button { display:none; } }
        </style>
        </head><body>
        <div class="invoice">
            <div class="header"><h1>RetailX</h1><p>Smart Inventory Management</p></div>
            <div class="details">
                <div><strong>Invoice:</strong> ${group.id}<br><strong>Date:</strong> ${group.date}<br><strong>Customer:</strong> ${group.customer}</div>
                <div><strong>Status:</strong> ${group.status}</div>
            </div>
            <table>
                <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>${productsRows}</tbody>
                <tfoot><tr style="font-weight:bold;"><td colspan="3">Grand Total</td><td>${formatPrice(group.total)}</td></tr></tfoot>
            </table>
            <div class="total">Total Amount: ${formatPrice(group.total)}</div>
            <div class="footer"><p>Thank you for shopping with RetailX!</p><p>support@retailx.com | Cairo, Egypt</p></div>
        </div>
        <div style="text-align:center;"><button onclick="window.print()">Print Invoice</button></div>
        </body></html>
    `);
    win.document.close();
}

window.deleteInvoice = async function(baseId) {
    if (appState.currentUser?.role !== 'administrator') return;
    if (!confirm('Delete this invoice and restore stock?')) return;
    try {
        // استدعاء مسار الحذف الجديد
        const res = await fetch(`${API_BASE}/sales/group/${baseId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${appState.token}` }
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
        await loadSalesPage(currentSalesPage);
        updateDashboardStats();
    } catch (err) { alert(err.message); }
};