// inventory.js - Product management with filtering, sorting & pagination

let currentInventory = [];
let inventorySort = { field: 'name', order: 'asc' };
let currentInventoryPage = 1;
const inventoryLimit = 15;
let totalInventoryPages = 1;
let allInventoryForFilter = []; // يُستخدم فقط عند وجود فلتر نشط

document.addEventListener('DOMContentLoaded', () => {
    // Add product button
    document.getElementById('addNewProduct').onclick = async () => {
		if (!hasPermission('addProduct')) {
			document.getElementById('addNewProduct').style.display = 'none';
			//return;
		}
		resetProductForm(); // <-- ينظف كل الحقول
		await loadSuppliersAndCategories();
		document.getElementById('addProductModal').classList.add('active');
	};

    document.getElementById('submitProduct').onclick = async () => {
		if (!hasPermission('addProduct')) return;

		const formData = new FormData();
		// التحقّقات
		const name = document.getElementById('productName').value.trim();
		const sku = document.getElementById('productSKU').value.trim();
		const qty = parseInt(document.getElementById('productQuantity').value);
		if (!name || !sku || isNaN(qty)) {
			showToast('Please fill in Product Name, SKU, and a valid Quantity.', 'error');
			return;
		}

		formData.append('name', name);
		formData.append('sku', sku);
		formData.append('category', document.getElementById('productCategory').value);
		formData.append('supplier_id', document.getElementById('productSupplier').value);
		formData.append('quantity', qty);
		formData.append('reorderLevel', document.getElementById('reorderLevel').value);
		formData.append('price', document.getElementById('productPrice').value);
		formData.append('description', document.getElementById('productDescription').value);
		formData.append('location', document.getElementById('productLocation').value);
		formData.append('received_date', document.getElementById('productReceivedDate').value);
		formData.append('expiry_date', document.getElementById('productExpiryDate').value);
		formData.append('active', document.getElementById('productActive').checked ? 1 : 0);

		const imageFile = document.getElementById('productImage').files[0];
		if (imageFile) formData.append('image', imageFile);

		try {
			const res = await fetch(`${API_BASE}/products`, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${appState.token}` },
				body: formData
			});
			if (!res.ok) throw new Error((await res.json()).error || 'Failed');

			await loadInventoryPage(currentInventoryPage);
			renderDashboardInventory();
			updateDashboardStats();
			document.getElementById('addProductModal').classList.remove('active');
			resetProductForm(); // يمسح الحقول بعد الإغلاق
			showToast('Product added successfully!', 'success');
		} catch (err) { showToast(err.message, 'error'); }
	};

    document.getElementById('saveProductChanges').onclick = async () => {
		if (!hasPermission('addProduct')) return;
		const id = document.getElementById('editProductId').value;
		const formData = new FormData();
		
		formData.append('name', document.getElementById('editProductName').value.trim());
		formData.append('sku', document.getElementById('editProductSKU').value.trim());
		formData.append('category', document.getElementById('editProductCategory').value);
		formData.append('supplier_id', document.getElementById('editProductSupplier').value);
		formData.append('price', document.getElementById('editProductPrice').value);
		formData.append('unit_cost', document.getElementById('editUnitCost').value);
		formData.append('reorderLevel', document.getElementById('editReorderLevel').value);
		const newQty = parseInt(document.getElementById('editNewStock').value);
		formData.append('quantity', isNaN(newQty) ? 0 : newQty);
		formData.append('description', document.getElementById('editProductDescription').value);
		formData.append('location', document.getElementById('editProductLocation').value);
		formData.append('received_date', document.getElementById('editProductReceivedDate').value);
		formData.append('expiry_date', document.getElementById('editProductExpiryDate').value);
		formData.append('active', document.getElementById('editProductActive').checked ? 1 : 0);

		const imageFile = document.getElementById('editProductImage').files[0];
		if (imageFile) formData.append('image', imageFile);

		try {
			const res = await fetch(`${API_BASE}/products/${id}`, {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${appState.token}` },
				body: formData
			});
			if (!res.ok) throw new Error((await res.json()).error || 'Failed');
			await loadInventoryPage(currentInventoryPage);
			renderDashboardInventory();
			updateDashboardStats();
			document.getElementById('editProductModal').classList.remove('active');
			showToast('Product updated successfully!', 'success');
		} catch (err) { showToast(err.message, 'error'); }
	};

    // Filter events: reset to page 1 and reload
    const debouncedLoadInventory = debounce(() => {
		allInventoryForFilter = [];
		currentInventoryPage = 1;
		loadInventoryPage(1);
	}, 400);

	['filterProductName','filterSKU','filterCategory','filterQuantity','filterReorder','filterPrice'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('input', debouncedLoadInventory);
	});
	document.getElementById('filterStatus')?.addEventListener('change', () => {
		allInventoryForFilter = [];
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
		allInventoryForFilter = [];
		loadInventoryPage(1);
	}
});

async function loadInventoryPage(page) {
	showLoader();
    currentInventoryPage = page;
    const search = document.getElementById('inventorySearch')?.value || '';

    if (isAnyFilterActive()) {
        // نجلب جميع المنتجات مرة واحدة فقط إذا لم تكن قد حُملت بعد
        if (allInventoryForFilter.length === 0) {
            const data = await api('GET', `/products?page=1&limit=9999&search=${encodeURIComponent(search)}`);
            allInventoryForFilter = data.products;
        }
        currentInventory = allInventoryForFilter;
        applyInventoryFilters(); // ستتولى التقسيم والعرض محليًا
    } else {
        // السير العادي: Pagination من الخادم
        const data = await api('GET', `/products?page=${page}&limit=${inventoryLimit}&search=${encodeURIComponent(search)}`);
        currentInventory = data.products;
        totalInventoryPages = data.pages;
        applyInventoryFilters(); // بدون فلترة، تعرض الصفحة وتُحدّث الـ Pagination
    }
	hideLoader();
}

function isAnyFilterActive() {
    const fields = ['filterProductName','filterSKU','filterCategory','filterQuantity','filterReorder','filterPrice','filterStatus'];
    return fields.some(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.tagName === 'SELECT') return el.value !== '';
        return el.value.trim() !== '';
    });
}


function applyInventoryFilters() {
    // إخفاء المنتجات الوهمية
    let workingSet = currentInventory.filter(p => p.name !== '__category_placeholder__');
    
    // الحصول على قيم الفلاتر
    const name = (document.getElementById('filterProductName')?.value || '').toLowerCase();
    const sku = (document.getElementById('filterSKU')?.value || '').toLowerCase();
    const category = (document.getElementById('filterCategory')?.value || '').toLowerCase();
    const quantity = document.getElementById('filterQuantity')?.value;
    const reorder = document.getElementById('filterReorder')?.value;
    const price = document.getElementById('filterPrice')?.value;
    const status = document.getElementById('filterStatus')?.value;

    // تطبيق الفلاتر
    let filtered = workingSet.filter(p => {
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

    // ترتيب
    filtered.sort((a, b) => {
        let valA = a[inventorySort.field];
        let valB = b[inventorySort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return inventorySort.order === 'asc' ? -1 : 1;
        if (valA > valB) return inventorySort.order === 'asc' ? 1 : -1;
        return 0;
    });

    const filterActive = isAnyFilterActive();
    
    if (filterActive) {
        // فلترة نشطة: نحسب الصفحات محليًا
        totalInventoryPages = Math.ceil(filtered.length / inventoryLimit);
        if (currentInventoryPage > totalInventoryPages) {
            currentInventoryPage = 1;
        }
        const start = (currentInventoryPage - 1) * inventoryLimit;
        const pageItems = filtered.slice(start, start + inventoryLimit);
        renderInventoryTableHTML(pageItems);
    } else {
        // لا يوجد فلتر: نعرض الصفحة الحالية كما جلبها الخادم (مع المحافظة على الترتيب)
        renderInventoryTableHTML(filtered);
    }

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
		if (hasPermission('editProduct')) {
			actions += `<button class="btn btn-sm btn-warning" onclick="updateStock(${p.id})"><i class="fas fa-edit"></i></button> `;
		}
		if (hasPermission('deleteProduct')) {
			actions += `<button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>`;
		}
        const imgSrc = p.image ? `/uploads/${p.image}` : null;
		const isActive = p.active == 1;
		const avgCost = p.quantity > 0 ? (p.total_cost / p.quantity).toFixed(2) : '0.00';
		const totalValue = (p.total_cost || 0).toFixed(2);
		return `<tr>
					<td>${startNumber + index}</td>
					<td>${imgSrc ? `<img src="${imgSrc}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : '—'}</td>
					<td>${p.name}</td>
					<td style="font-family:monospace;">${p.supplier_code || '—'}</td>   <!-- خلية Supplier Code -->
					<td>${p.sku}</td>
					<td>${p.category}</td>
					<td>${p.quantity}</td>
					<td>${p.reorderLevel}</td>
					<td>${formatPrice(p.price)}</td>
					<td>${formatPrice(avgCost)}</td>
					<td>${formatPrice(totalValue)}</td>
					<td>${p.location || '—'}</td>
					<td>${p.received_date || '—'}</td>
					<td>${p.expiry_date || '—'}</td>
					<td><span class="stock-status ${statusClass}">${statusText}</span></td>
					<td>${isActive ? '<span style="color:var(--secondary)">Active</span>' : '<span style="color:var(--danger)">Inactive</span>'}</td>
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
let currentProduct = null; // لتخزين المنتج الحالي مؤقتاً

window.updateStock = async function(id) {
    if (!hasPermission('inventory')) return;
    
    // ابحث عن المنتج في currentInventory
    const p = currentInventory.find(p => p.id === id);
    if (!p) return;
    currentProduct = p; // حفظ مرجع

    // تعبئة الحقول الأساسية
    document.getElementById('editProductId').value = p.id;
    document.getElementById('editProductName').value = p.name;
    document.getElementById('editProductSKU').value = p.sku || '';
    document.getElementById('editProductPrice').value = p.price;
    document.getElementById('editReorderLevel').value = p.reorderLevel;
    document.getElementById('editCurrentStock').value = p.quantity;
    document.getElementById('editNewStock').value = p.quantity;
    document.getElementById('editProductDescription').value = p.description || '';
    document.getElementById('editProductLocation').value = p.location || '';
    document.getElementById('editProductReceivedDate').value = p.received_date || '';
    document.getElementById('editProductExpiryDate').value = p.expiry_date || '';
    document.getElementById('editProductActive').checked = p.active == 1;
    document.getElementById('editUnitCost').value = p.quantity > 0 ? (p.total_cost / p.quantity).toFixed(2) : p.price.toFixed(2);

    // حالة المخزون
    const stockStatusEl = document.getElementById('editStockStatus');
    if (stockStatusEl) {
        const statusText = p.quantity === 0 ? 'Out of Stock' : (p.quantity <= p.reorderLevel ? 'Low Stock' : 'In Stock');
        stockStatusEl.textContent = statusText;
        stockStatusEl.style.color = p.quantity === 0 ? 'var(--danger)' : (p.quantity <= p.reorderLevel ? 'var(--warning)' : 'var(--secondary)');
    }

    // ملء قوائم الموردين والفئات (اختياري لكن يفيد)
    await loadSuppliersAndCategoriesForEdit();
    
    // ضبط القيم المختارة
    setTimeout(() => {
        document.getElementById('editProductCategory').value = p.category || '';
        document.getElementById('editProductSupplier').value = p.supplier_id || '';
    }, 100);

    document.getElementById('editProductModal').classList.add('active');
};

// دالة مساعدة لتحميل الموردين والفئات دون تفريغ باقي الحقول
async function loadSuppliersAndCategoriesForEdit() {
    const suppliersData = await apiGetSuppliers(1, 9999);
    const supplierSelect = document.getElementById('editProductSupplier');
    if (supplierSelect) {
        supplierSelect.innerHTML = '';
        suppliersData.suppliers.forEach(s => {
            supplierSelect.innerHTML += `<option value="${s.id}">${s.name} (${s.supplier_code})</option>`;
        });
    }

    const catSelect = document.getElementById('editProductCategory');
    if (catSelect) {
        const cats = [...new Set(
            inventoryData
                .filter(p => p.name !== '__category_placeholder__')
                .map(p => p.category)
                .filter(Boolean)
        )].sort();
        catSelect.innerHTML = '<option value="">Select category</option>';
        cats.forEach(c => {
            catSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }
}

window.deleteProduct = async function(id) {
    if (!hasPermission('addProduct')) return;
    if (!confirm('Delete this product?')) return;
    try {
        await apiDeleteProduct(id);
        await loadInventoryPage(currentInventoryPage);
        renderDashboardInventory();
        updateDashboardStats();
    } catch (err) { showToast(err.message, 'error'); }
};

// تحميل قائمة الموردين والفئات
async function loadSuppliersAndCategories() {
    const suppliersData = await apiGetSuppliers(1, 9999);
    const supplierSelect = document.getElementById('productSupplier');
    if (supplierSelect) {
        supplierSelect.innerHTML = '';
        suppliersData.suppliers.forEach(s => {
            supplierSelect.innerHTML += `<option value="${s.id}">${s.name} (${s.supplier_code})</option>`;
        });
    }

        const catSelect = document.getElementById('productCategory');
    if (catSelect) {
        const cats = [...new Set(
            inventoryData
                .filter(p => p.name !== '__category_placeholder__')
                .map(p => p.category)
                .filter(Boolean)
        )].sort();
        catSelect.innerHTML = '<option value="">Select category</option>';
        cats.forEach(c => {
            catSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
    }
    if (supplierSelect.options.length > 0) supplierSelect.selectedIndex = 0;
    if (catSelect && catSelect.options.length > 0) catSelect.selectedIndex = 0;
}

function resetProductForm() {
    document.getElementById('productName').value = '';
    document.getElementById('productSKU').value = '';
    document.getElementById('productCategory').value = '';
    const supSel = document.getElementById('productSupplier');
	if (supSel && supSel.options.length > 0) supSel.selectedIndex = 0;
    document.getElementById('productQuantity').value = 10;
    document.getElementById('reorderLevel').value = 5;
    document.getElementById('productPrice').value = 15.00;
    document.getElementById('productDescription').value = '';
    document.getElementById('productLocation').value = '';
    document.getElementById('productReceivedDate').value = '';
    document.getElementById('productExpiryDate').value = '';
    document.getElementById('productActive').checked = true;
    document.getElementById('productImage').value = ''; // يمسح الملف المختار
}