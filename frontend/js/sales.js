// sales.js - Multi-product sales with discount, payment method & notes

let currentSales = [];
let salesSort = { field: 'date', order: 'desc' };
let currentSalesPage = 1;
const salesLimit = 15;
let totalSalesPages = 1;

// سلة المنتجات المؤقتة للفاتورة الحالية
let saleItems = []; // [{ productId, name, price, quantity }]
let isProcessingSale = false; // مانع تكرار الضغط

document.addEventListener('DOMContentLoaded', () => {

    // ========== فتح مودال بيع جديد ==========
    document.getElementById('addNewSale').onclick = async function(e) {
        e.preventDefault();
        if (!appState.isAuthenticated || !hasPermission('sales')) return;

        await apiGetProducts(1, 9999);   // جميع المنتجات
        saleItems = [];                  // تفريغ السلة القديمة
        document.getElementById('saleCustomer').value = 'Walk-in Customer';
        document.getElementById('saleDiscount').value = 0;
        document.getElementById('salePaymentMethod').value = 'Cash';
        document.getElementById('saleNotes').value = '';

        // أفرغ الجدول وأضف أول صف
        document.getElementById('saleItemsBody').innerHTML = '';
        // تعبئة التاريخ الحالي تلقائياً
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
            updateSaleTotal();
        }
    });

    // ========== تغيير المنتج / الكمية ==========
    document.getElementById('saleItemsBody').addEventListener('input', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const index = Array.from(row.parentNode.children).indexOf(row);
        if (e.target.classList.contains('sale-product-select')) {
            const opt = e.target.selectedOptions[0];
            saleItems[index].productId = parseInt(e.target.value);
            saleItems[index].name = opt.text;
            saleItems[index].price = parseFloat(opt.dataset.price);
        } else if (e.target.classList.contains('sale-qty-input')) {
            saleItems[index].quantity = parseInt(e.target.value) || 1;
        }
        updateRowTotal(row, index);
        updateSaleTotal();
    });

    // ========== تنفيذ البيع ==========
    document.getElementById('processSale').onclick = async function(e) {
        e.preventDefault();
		// منع الضغط المتكرر
		if (isProcessingSale) return;
        if (!appState.isAuthenticated || !hasPermission('sales')) return;

        // ---------- التحققات ----------
        // 1. التأكد من وجود عنصر واحد على الأقل في السلة
        if (saleItems.length === 0) {
            alert('Add at least one product.');
            return;
        }

        // 2. التحقق من صحة كل عنصر
        for (let i = 0; i < saleItems.length; i++) {
            const item = saleItems[i];
            if (!item.productId) {
                alert(`Please select a product for row ${i + 1}.`);
                return;
            }
            if (!item.quantity || item.quantity < 1) {
                alert(`Quantity for row ${i + 1} must be at least 1.`);
                return;
            }
            // التأكد من وجود مخزون كافٍ
            const product = inventoryData.find(p => p.id === item.productId);
            if (product && item.quantity > product.quantity) {
                alert(`${product.name} has only ${product.quantity} in stock. Please reduce the quantity.`);
                return;
            }
        }

        // 3. تجهيز القيم مع التحقق منها
        const customer = document.getElementById('saleCustomer').value.trim() || 'Walk-in Customer';
        if (!customer) {
            alert('Please enter a customer name.');
            return;
        }

        const discount = parseFloat(document.getElementById('saleDiscount').value) || 0;
        if (discount < 0 || discount > 100) {
            alert('Discount must be between 0 and 100.');
            return;
        }

        const paymentMethod = document.getElementById('salePaymentMethod').value;
        const notes = document.getElementById('saleNotes').value;
        // قراءة القيمة المحلية من الحقل
		const localDateStr = document.getElementById('saleDate').value;
		if (!localDateStr) {
			alert('Please select a date.');
			return;
		}

		const selectedDate = new Date(localDateStr); // كائن تاريخ محلي

		// تحويل إلى ISO UTC لإرساله إلى السيرفر
		const utcDateStr = selectedDate.toISOString(); // مثال: "2026-05-03T13:30:00.000Z"

		// فحص التاريخ المستقبلي (باستخدام الوقت المحلي، بتسامح دقيقة)
		const now = new Date();
		if (selectedDate.getTime() > now.getTime() + 60000) {
			alert('Future date is not allowed for sales.');
			return;
		}
		// تعطيل الزر وتغيير النص
		isProcessingSale = true;
		const btn = document.getElementById('processSale');
		btn.disabled = true;
		btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
		
        const items = saleItems.map(item => ({ productId: item.productId, quantity: item.quantity }));
    
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
			// إعادة الزر لحالته الأصلية مهما حدث
			isProcessingSale = false;
			btn.disabled = false;
			btn.innerHTML = 'Process Sale';
		}
    };

    // ========== أحداث الفلاتر ==========
    ['filterSaleDate','filterTransID','filterCustomer','filterItems','filterTotal','filterSaleStatus'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { currentSalesPage = 1; loadSalesPage(1); });
    });
    document.getElementById('filterSaleStatus')?.addEventListener('change', () => { currentSalesPage = 1; loadSalesPage(1); });

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
		// طرح دقيقة واحدة لضمان أن التاريخ ليس مستقبليًا أبدًا
		n.setMinutes(n.getMinutes() - 1);
		const local = new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
		document.getElementById('saleDate').value = local;
	};
});

// ========== دوال السلة ==========
function addSaleItemRow() {
    const productOptions = inventoryData
        .map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} - ${formatPrice(p.price)} (${p.quantity} in stock)</option>`)
        .join('');

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><select class="form-control sale-product-select" style="width:100%;">${productOptions}</select></td>
        <td><input type="number" class="form-control sale-qty-input" value="1" min="1"></td>
        <td class="unit-price">$0.00</td>
        <td class="row-total">$0.00</td>
        <td><button class="btn btn-sm btn-danger remove-sale-item"><i class="fas fa-times"></i></button></td>
    `;
    document.getElementById('saleItemsBody').appendChild(row);

    const select = row.querySelector('.sale-product-select');
    const opt = select.selectedOptions[0];
    const price = parseFloat(opt?.dataset.price) || 0;

    saleItems.push({
        productId: parseInt(select.value),
        name: opt?.text || '',
        price: price,
        quantity: 1
    });

    row.querySelector('.unit-price').innerText = formatPrice(price);
    row.querySelector('.row-total').innerText = formatPrice(price);
    if (saleItems.length === 1) updateSaleTotal();
}

function updateRowTotal(row, index) {
    const item = saleItems[index];
    if (!item) return;
    const total = item.price * item.quantity;
    row.querySelector('.row-total').innerText = formatPrice(total);
    row.querySelector('.unit-price').innerText = formatPrice(item.price);
}

function updateSaleTotal() {
    let subtotal = saleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = parseFloat(document.getElementById('saleDiscount')?.value) || 0;
    const grandTotal = subtotal - (subtotal * discount / 100);
    document.getElementById('saleGrandTotal').innerText = formatPrice(grandTotal > 0 ? grandTotal : 0);
}

// ========== دوال الصفحة والجدول (باقية دون تغيير كبير) ==========
async function loadSalesPage(page) {
    currentSalesPage = page;
    const data = await api('GET', `/sales?page=${page}&limit=${salesLimit}`);
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
    renderPagination(currentSalesPage, totalSalesPages, 'salesPagination', (page) => loadSalesPage(page));
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