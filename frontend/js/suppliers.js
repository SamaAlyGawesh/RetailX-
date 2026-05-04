// suppliers.js - Supplier management with filtering, sorting & pagination

let currentSuppliers = [];
let supplierSort = { field: 'name', order: 'asc' };
let currentSupplierPage = 1;
const supplierLimit = 15;
let totalSupplierPages = 1;
let supplierEditingId = null;          // <-- تم تغيير الاسم لتجنب التعارض
let allCategories = [];
let selectedCategories = [];

document.addEventListener('DOMContentLoaded', () => {
    if (appState.isAuthenticated) {
        loadInitialProducts();
        loadSupplierPage(1);
    }
	
    document.getElementById('addNewSupplier').onclick = async () => {
		if (!hasPermission('suppliers')) return;
		if (!allCategories.length) await loadInitialProducts();
		clearSupplierForm();
		supplierEditingId = null;
		document.getElementById('addSupplierModal').classList.add('active');
		renderCategoriesCheckboxes(); // الآن مضمون أن allCategories ليست فارغة
	};

    document.getElementById('submitSupplier').onclick = async () => {
        if (!hasPermission('suppliers')) return;
        const supplier = {
            name: document.getElementById('supplierNameInput').value.trim(),
            contact: document.getElementById('supplierContactInput').value.trim(),
            email: document.getElementById('supplierEmailInput').value.trim(),
            phone: document.getElementById('supplierPhoneInput').value.trim(),
            address1: document.getElementById('supplierAddress1').value.trim(),
            address2: document.getElementById('supplierAddress2').value.trim(),
            website: document.getElementById('supplierWebsite').value.trim(),
            payment_terms: document.getElementById('supplierPaymentTerms').value.trim(),
            leadTime: parseInt(document.getElementById('supplierLeadTimeInput').value) || 5,
            productsSuppliedList: selectedCategories
        };
        if (!supplier.name || !supplier.email) return alert('Name and email required');
        try {
            if (supplierEditingId) {
                await apiUpdateSupplier(supplierEditingId, supplier);
            } else {
                await apiCreateSupplier(supplier);
            }
            await loadSupplierPage(currentSupplierPage);
            document.getElementById('addSupplierModal').classList.remove('active');
            clearSupplierForm();
        } catch (err) { alert(err.message); }
    };

    // Filter events
    ['filterSupplierName','filterContact','filterSupplierEmail','filterSupplierPhone','filterSupplierAddress','filterProductsSupplied','filterLeadTime'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { currentSupplierPage = 1; loadSupplierPage(1); });
    });

    // Sorting
    document.querySelectorAll('#suppliersTableMain th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            supplierSort.order = (supplierSort.field === field && supplierSort.order === 'asc') ? 'desc' : 'asc';
            supplierSort.field = field;
            updateSupplierSortArrows();
            loadSupplierPage(currentSupplierPage);
        });
    });

    // Search products
    document.querySelector('.multi-select-search')?.addEventListener('input', function(e) {
		renderCategoriesCheckboxes(e.target.value);
	});

    if (appState.isAuthenticated) loadSupplierPage(1);
	
	// إضافة فئة جديدة
	document.getElementById('addNewCategoryBtn')?.addEventListener('click', async () => {
		const input = document.getElementById('newCategoryInput');
		const newCat = input.value.trim();
		if (!newCat) return;
		if (allCategories.includes(newCat)) {
			alert('Category already exists.');
			return;
		}
		try {
			// إنشاء منتج وهمي (placeholder) لحفظ الفئة
			await apiCreateProduct({
				name: '__category_placeholder__',
				sku: 'CAT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
				category: newCat,
				quantity: 0,
				reorderLevel: 0,
				price: 0,
				supplier: 'System'
			});
			// أضف الفئة محلياً
			allCategories.push(newCat);
			allCategories.sort();
			if (!selectedCategories.includes(newCat)) {
				selectedCategories.push(newCat);
			}
			renderCategoriesCheckboxes(document.querySelector('.multi-select-search')?.value || '');
			input.value = '';
		} catch (err) {
			alert('Failed to save category: ' + err.message);
		}
	});
});

async function loadInitialProducts() { // احتفظنا بالاسم لتجنب تغيير الاستدعاءات
    if (allCategories.length) return;
    try {
        const data = await apiGetProducts(1, 9999);
        const products = data.products;
        allCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    } catch (err) {
        console.error('Failed to load categories', err);
        allCategories = [];
    }
}

function renderCategoriesCheckboxes(filter = '') {
    const container = document.getElementById('categoriesSuppliedOptions');
    if (!container) return;
    const filterLower = filter.toLowerCase();
    const filtered = allCategories.filter(cat => cat.toLowerCase().includes(filterLower));
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:var(--dark-text-lighter);">No categories found</div>';
        return;
    }
    container.innerHTML = filtered.map(cat => `
        <label class="multi-select-item">
			<input type="checkbox" value="${cat}" ${selectedCategories.includes(cat) ? 'checked' : ''} onchange="toggleCategorySelect('${cat}', this.checked)">
			<span>${cat}</span>
			<span style="margin-left:auto; color:var(--danger); cursor:pointer; font-size:14px;" onclick="event.preventDefault(); deleteCategoryFromList('${cat}');"> <i class="fas fa-trash-alt"></i> </span>
		</label>
    `).join('');
}

window.toggleCategorySelect = function(category, isChecked) {
    if (isChecked) {
        if (!selectedCategories.includes(category)) selectedCategories.push(category);
    } else {
        selectedCategories = selectedCategories.filter(c => c !== category);
    }
};

window.deleteCategoryFromList = function(category) {
    // تحقق من وجود منتجات حقيقية بهذه الفئة (غير العناصر الوهمية)
    const realProducts = inventoryData.filter(p => p.category === category && p.name !== '__category_placeholder__');
    if (realProducts.length > 0) {
        alert(`Cannot delete category "${category}". It is used by ${realProducts.length} real product(s).`);
        return;
    }
    if (confirm(`Are you sure you want to delete the category "${category}"?`)) {
        // ابحث عن المنتج الوهمي لهذه الفئة واحذفه
        const placeholder = inventoryData.find(p => p.category === category && p.name === '__category_placeholder__');
        if (placeholder) {
            apiDeleteProduct(placeholder.id).then(() => {
                // إزالة الفئة من القوائم
                allCategories = allCategories.filter(c => c !== category);
                selectedCategories = selectedCategories.filter(c => c !== category);
                const searchInput = document.querySelector('.multi-select-search');
                renderCategoriesCheckboxes(searchInput?.value || '');
            }).catch(err => alert('Failed to delete category: ' + err.message));
        } else {
            // إذا لم يوجد منتج وهمي (حالة نادرة)، فقط أزل من الواجهة
            allCategories = allCategories.filter(c => c !== category);
            selectedCategories = selectedCategories.filter(c => c !== category);
            const searchInput = document.querySelector('.multi-select-search');
            renderCategoriesCheckboxes(searchInput?.value || '');
        }
    }
};

function clearSupplierForm() {
    document.getElementById('supplierNameInput').value = '';
    document.getElementById('supplierContactInput').value = '';
    document.getElementById('supplierEmailInput').value = '';
    document.getElementById('supplierPhoneInput').value = '';
    document.getElementById('supplierAddress1').value = '';
    document.getElementById('supplierAddress2').value = '';
    document.getElementById('supplierWebsite').value = '';
    document.getElementById('supplierPaymentTerms').value = '';
    document.getElementById('supplierLeadTimeInput').value = '5';
    selectedCategories = [];
    renderCategoriesCheckboxes();
    supplierEditingId = null;
}

window.editSupplier = function(id) {
    if (!hasPermission('suppliers')) return;
    const s = suppliersData.find(s => s.id === id);
    if (!s) return;
    document.getElementById('supplierNameInput').value = s.name;
    document.getElementById('supplierContactInput').value = s.contact || '';
    document.getElementById('supplierEmailInput').value = s.email;
    document.getElementById('supplierPhoneInput').value = s.phone || '';
    document.getElementById('supplierAddress1').value = s.address1 || '';
    document.getElementById('supplierAddress2').value = s.address2 || '';
    document.getElementById('supplierWebsite').value = s.website || '';
    document.getElementById('supplierPaymentTerms').value = s.payment_terms || '';
    document.getElementById('supplierLeadTimeInput').value = s.leadTime;
    selectedCategories = s.productsSuppliedList || [];
    renderCategoriesCheckboxes();
    supplierEditingId = id;
    document.getElementById('addSupplierModal').classList.add('active');
};

window.deleteSupplier = async function(id) {
    if (!hasPermission('suppliers')) return;
    if (!confirm('Delete this supplier?')) return;
    try {
        await apiDeleteSupplier(id);
        await loadSupplierPage(currentSupplierPage);
    } catch (err) { alert(err.message); }
};

// ========== جدول الموردين ==========
async function loadSupplierPage(page) {
    currentSupplierPage = page;
    const data = await apiGetSuppliers(page, supplierLimit);
    currentSuppliers = data.suppliers;
    totalSupplierPages = data.pages;
    applySupplierFilters();
}

function applySupplierFilters() {
    const name = (document.getElementById('filterSupplierName')?.value || '').toLowerCase();
    const contact = (document.getElementById('filterContact')?.value || '').toLowerCase();
    const email = (document.getElementById('filterSupplierEmail')?.value || '').toLowerCase();
    const phone = (document.getElementById('filterSupplierPhone')?.value || '').toLowerCase();
    const address = (document.getElementById('filterSupplierAddress')?.value || '').toLowerCase();
    const product = (document.getElementById('filterProductsSupplied')?.value || '').toLowerCase();
    const leadTime = document.getElementById('filterLeadTime')?.value;

    let filtered = currentSuppliers.filter(s => {
        const matchName = name ? s.name.toLowerCase().includes(name) : true;
        const matchContact = contact ? (s.contact || '').toLowerCase().includes(contact) : true;
        const matchEmail = email ? s.email.toLowerCase().includes(email) : true;
        const matchPhone = phone ? (s.phone || '').toLowerCase().includes(phone) : true;
        const matchAddress = address ? `${s.address1||''} ${s.address2||''}`.toLowerCase().includes(address) : true;
        const matchProduct = product ? (s.productsSuppliedList || []).some(p => p.toLowerCase().includes(product)) : true;
        const matchLeadTime = leadTime ? s.leadTime == leadTime : true;
        return matchName && matchContact && matchEmail && matchPhone && matchAddress && matchProduct && matchLeadTime;
    });

    filtered.sort((a, b) => {
        let valA = a[supplierSort.field];
        let valB = b[supplierSort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return supplierSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return supplierSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    renderSuppliersTableHTML(filtered);
    renderPagination(currentSupplierPage, totalSupplierPages, 'supplierPagination', (page) => loadSupplierPage(page));
}

function renderSuppliersTableHTML(suppliers) {
    const tbody = document.getElementById('suppliersTable');
    if (!tbody) return;
    if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No suppliers found.</td></tr>';
        return;
    }
    const startNumber = (currentSupplierPage - 1) * supplierLimit + 1;
    tbody.innerHTML = suppliers.map((s, index) => {
        const categoriesHtml = (s.productsSuppliedList || []).map(c => `<span class="supplier-product-badge">${c}</span>`).join('') || '<span class="supplier-product-badge">No Categories</span>';
        const addressStr = [s.address1, s.address2].filter(Boolean).join(', ') || '-';
        return `<tr>
            <td>${startNumber + index}</td>
            <td>${s.name}</td>
            <td>${s.contact || '-'}</td>
            <td>${s.email}</td>
            <td>${s.phone || '-'}</td>
            <td>${addressStr}</td>
            <td>${s.website ? `<a href="${s.website}" target="_blank">Link</a>` : '-'}</td>
            <td>${s.payment_terms || '-'}</td>
            <td><div class="supplier-products-list">${categoriesHtml}</div></td>
            <td>${s.leadTime} days</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editSupplier(${s.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function updateSupplierSortArrows() {
    document.querySelectorAll('#suppliersTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#suppliersTableMain th[data-sort="${supplierSort.field}"] .sort-arrow`);
    if (active) active.textContent = supplierSort.order === 'asc' ? ' ▲' : ' ▼';
}

// دالة متوافقة مع الملفات القديمة التي تنادي renderSuppliersTable
function renderSuppliersTable() {
    loadSupplierPage(currentSupplierPage);
}