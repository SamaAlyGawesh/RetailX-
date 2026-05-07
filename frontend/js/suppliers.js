// suppliers.js - Supplier management with filtering, sorting, pagination, categories & documents

let currentSuppliers = [];
let supplierSort = { field: 'name', order: 'asc' };
let currentSupplierPage = 1;
const supplierLimit = 15;
let totalSupplierPages = 1;
let allSuppliersForFilter = []; // للتخزين المؤقت عند الفلترة
let supplierEditingId = null;
let allCategories = [];
let selectedCategories = [];

async function loadInitialProducts() {
    await apiGetProducts(1, 9999);
    allCategories = [...new Set(inventoryData.map(p => p.category).filter(Boolean))].sort();
}

document.addEventListener('DOMContentLoaded', () => {
    if (appState.isAuthenticated) {
        loadInitialProducts();
        loadSupplierPage(1);
    }

    document.getElementById('addNewSupplier').onclick = async () => {
        if (!hasPermission('suppliers')) return;
		if (!hasPermission('addSupplier')) {
			document.getElementById('addNewSupplier').style.display = 'none';
		}
        if (!allCategories.length) await loadInitialProducts();
        clearSupplierForm();
        supplierEditingId = null;
        document.getElementById('addSupplierModal').classList.add('active');
        renderCategoriesCheckboxes();
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
        if (!supplier.name || !supplier.email) return showToast('Name and email required', 'error');
        try {
            if (supplierEditingId) {
                await apiUpdateSupplier(supplierEditingId, supplier);
            } else {
                await apiCreateSupplier(supplier);
            }
            
            // --- رفع المستندات الجديدة (الصفوف التي تحتوي على ملفات) ---
            const docRows = document.querySelectorAll('#supplierDocsBody tr');
            for (const row of docRows) {
                const fileInput = row.querySelector('.doc-file-input');
				if (fileInput && fileInput.files.length > 0) {
                    const type = row.querySelector('.doc-type-input').value.trim();
                    const number = row.querySelector('.doc-number-input').value.trim();
                    const issue = row.querySelector('.doc-issue-input').value;
                    const expiry = row.querySelector('.doc-expiry-input').value;

                    // التحقق من أن جميع الحقول الأساسية مملوءة
                    if (!type || !issue || !expiry) {
                        showToast(`Please fill all fields (type, dates) for the document "${type || 'unknown'}".`, 'error');
                        return; // إيقاف الحفظ بالكامل للفت الانتباه للخطأ
                    }
                    if (!fileInput.files[0]) {
                        showToast(`Please select a file for the document "${type}".`, 'error');
                        return;
                    }

                    const formData = new FormData();
                    formData.append('file', fileInput.files[0]);
                    formData.append('document_type', type);
                    formData.append('document_number', number);
                    formData.append('issue_date', issue);
                    formData.append('expiry_date', expiry);
                    try {
                        await apiUploadSupplierDocument(supplierEditingId || supplier.id, formData);
                    } catch (err) {
                        console.error('Failed to upload doc', err);
                    }
                }
            }
            // --------------------------------------------

            await loadSupplierPage(currentSupplierPage);
            document.getElementById('addSupplierModal').classList.remove('active');
            clearSupplierForm();
        } catch (err) { showToast(err.message, 'error'); }
    };

    // Filter events
    const debouncedLoadSuppliers = debounce(() => {
		allSuppliersForFilter = [];
		currentSupplierPage = 1;
		loadSupplierPage(1);
	}, 400);

	['filterSupplierName','filterContact','filterSupplierEmail','filterSupplierPhone','filterSupplierAddress','filterProductsSupplied','filterLeadTime'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('input', debouncedLoadSuppliers);
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

    // Search categories
    document.querySelector('.multi-select-search')?.addEventListener('input', function(e) {
        renderCategoriesCheckboxes(e.target.value);
    });


    // إضافة فئة جديدة
    document.getElementById('addNewCategoryBtn')?.addEventListener('click', async () => {
        const input = document.getElementById('newCategoryInput');
        const newCat = input.value.trim();
        if (!newCat) return;
        if (allCategories.includes(newCat)) {
            showToast('Category already exists.', 'error');
            return;
        }
        try {
            await apiCreateProduct({
                name: '__category_placeholder__',
                sku: 'CAT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                category: newCat,
                quantity: 0,
                reorderLevel: 0,
                price: 0,
                supplier: 'System'
            });
            allCategories.push(newCat);
            allCategories.sort();
            if (!selectedCategories.includes(newCat)) selectedCategories.push(newCat);
            renderCategoriesCheckboxes(document.querySelector('.multi-select-search')?.value || '');
            input.value = '';
        } catch (err) {
            showToast('Failed to save category: ' + err.message, 'error');
        }
    });

    // زر إضافة صف مستند جديد
    document.getElementById('addDocRowBtn')?.addEventListener('click', () => addDocRow());

    // حذف مستند موجود
    document.getElementById('supplierDocsBody')?.addEventListener('click', async (e) => {
        if (e.target.closest('.delete-existing-doc-btn')) {
            const btn = e.target.closest('.delete-existing-doc-btn');
            const docId = btn.dataset.docId;
            if (!confirm('Delete this document?')) return;
            try {
                await apiDeleteSupplierDocument(docId);
                btn.closest('tr').remove();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    });

    if (appState.isAuthenticated) loadSupplierPage(1);
});

function isAnySupplierFilterActive() {
    const fields = ['filterSupplierName','filterContact','filterSupplierEmail','filterSupplierPhone','filterSupplierAddress','filterProductsSupplied','filterLeadTime'];
    return fields.some(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.tagName === 'SELECT') return el.value !== '';
        return el.value.trim() !== '';
    });
}

// ========== دوال تحميل وعرض الجدول ==========
async function loadSupplierPage(page) {
	showLoader();
    currentSupplierPage = page;
    if (isAnySupplierFilterActive()) {
        if (allSuppliersForFilter.length === 0) {
            const data = await apiGetSuppliers(1, 9999);
            allSuppliersForFilter = data.suppliers;
        }
        currentSuppliers = allSuppliersForFilter;
        applySupplierFilters();
    } else {
        const data = await apiGetSuppliers(page, supplierLimit);
        currentSuppliers = data.suppliers;
        totalSupplierPages = data.pages;
        applySupplierFilters();
    }
	hideLoader();
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
    const realProducts = inventoryData.filter(p => p.category === category && p.name !== '__category_placeholder__');
    if (realProducts.length > 0) {
        showToast(`Cannot delete category "${category}". It is used by ${realProducts.length} real product(s).`, 'error');
        return;
    }
    if (confirm(`Are you sure you want to delete the category "${category}"?`)) {
        const placeholder = inventoryData.find(p => p.category === category && p.name === '__category_placeholder__');
        if (placeholder) {
            apiDeleteProduct(placeholder.id).then(() => {
                allCategories = allCategories.filter(c => c !== category);
                selectedCategories = selectedCategories.filter(c => c !== category);
                renderCategoriesCheckboxes(document.querySelector('.multi-select-search')?.value || '');
            }).catch(err => showToast('Failed to delete category: ' + err.message, 'error'));
        } else {
            allCategories = allCategories.filter(c => c !== category);
            selectedCategories = selectedCategories.filter(c => c !== category);
            renderCategoriesCheckboxes(document.querySelector('.multi-select-search')?.value || '');
        }
    }
};

// ========== دوال المستندات ==========
function addDocRow(doc = null) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="form-control doc-type-input" value="${doc?.document_type || ''}" placeholder="e.g. Tax Card" list="docTypesList"></td>
        <td><input type="text" class="form-control doc-number-input" value="${doc?.document_number || ''}" placeholder="Registration number"></td>
        <td><input type="date" class="form-control doc-issue-input" value="${doc?.issue_date || ''}"></td>
        <td><input type="date" class="form-control doc-expiry-input" value="${doc?.expiry_date || ''}"></td>
        <td><input type="file" class="form-control doc-file-input" accept="image/*,.pdf"></td>
        <td><button class="btn btn-sm btn-danger remove-doc-row"><i class="fas fa-times"></i></button></td>
    `;
    document.getElementById('supplierDocsBody').appendChild(row);

    if (doc) {
        const fileCell = row.querySelector('.doc-file-input').parentElement;
        if (doc.file_path) {
            fileCell.innerHTML = `<a href="/files/${doc.file_path}" target="_blank">View</a> <input type="hidden" class="doc-existing-file" value="${doc.file_path}">`;
        }
        if (doc.id) {
            const actionsCell = row.querySelector('td:last-child');
            actionsCell.innerHTML += `<button class="btn btn-sm btn-danger delete-existing-doc-btn" data-doc-id="${doc.id}"><i class="fas fa-trash"></i></button>`;
        }
    }

    row.querySelector('.remove-doc-row').onclick = () => row.remove();
}

async function loadAndRenderSupplierDocs(supplierId) {
    try {
        const docs = await apiGetSupplierDocuments(supplierId);
        const body = document.getElementById('supplierDocsBody');
        body.innerHTML = '';
        docs.forEach(doc => addDocRow(doc));
    } catch (err) {
        console.error('Failed to load documents', err);
    }
}

// ========== دوال النموذج ==========
function clearSupplierForm() {
    document.getElementById('supplierNameInput').value = '';
    document.getElementById('supplierCodeDisplay').value = '';
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
    document.getElementById('supplierDocsBody').innerHTML = '';
    supplierEditingId = null;
}

window.editSupplier = async function(id) {
    if (!hasPermission('suppliers')) return;
    const s = suppliersData.find(s => s.id === id);
    if (!s) return;
    if (!allCategories.length) await loadInitialProducts();
    
    document.getElementById('supplierNameInput').value = s.name;
    document.getElementById('supplierCodeDisplay').value = s.supplier_code || '';
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
    loadAndRenderSupplierDocs(id);
};

window.deleteSupplier = async function(id) {
    if (!hasPermission('suppliers')) return;
    if (!confirm('Delete this supplier?')) return;
    try {
        await apiDeleteSupplier(id);
        await loadSupplierPage(currentSupplierPage);
    } catch (err) { showToast(err.message, 'error'); }
};

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

    const filterActive = isAnySupplierFilterActive();
    if (filterActive) {
        totalSupplierPages = Math.ceil(filtered.length / supplierLimit);
        if (currentSupplierPage > totalSupplierPages) currentSupplierPage = 1;
        const start = (currentSupplierPage - 1) * supplierLimit;
        const pageItems = filtered.slice(start, start + supplierLimit);
        renderSuppliersTableHTML(pageItems);
    } else {
        renderSuppliersTableHTML(filtered);
    }

    renderPagination(currentSupplierPage, totalSupplierPages, 'supplierPagination', (page) => {
        loadSupplierPage(page);
    });
}

function renderSuppliersTableHTML(suppliers) {
    const tbody = document.getElementById('suppliersTable');
    if (!tbody) return;
    if (suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No suppliers found.</td></tr>';
        return;
    }
    const startNumber = (currentSupplierPage - 1) * supplierLimit + 1;
    tbody.innerHTML = suppliers.map((s, index) => {
        const categoriesHtml = (s.productsSuppliedList || []).map(c => `<span class="supplier-product-badge">${c}</span>`).join('') || '<span class="supplier-product-badge">No Categories</span>';
        return `<tr>
            <td>${startNumber + index}</td>
            <td style="font-family:monospace;">${s.supplier_code || '-'}</td>
            <td>${s.name}</td>
            <td>${s.contact || '-'}</td>
            <td>${s.email}</td>
            <td>${s.phone || '-'}</td>
            <td><div class="supplier-products-list">${categoriesHtml}</div></td>
            <td>
                ${hasPermission('editSupplier') ? `<button class="btn btn-sm btn-primary" onclick="editSupplier(${s.id})"><i class="fas fa-edit"></i></button>` : ''}
				${hasPermission('deleteSupplier') ? `<button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id})"><i class="fas fa-trash"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function updateSupplierSortArrows() {
    document.querySelectorAll('#suppliersTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#suppliersTableMain th[data-sort="${supplierSort.field}"] .sort-arrow`);
    if (active) active.textContent = supplierSort.order === 'asc' ? ' ▲' : ' ▼';
}

function renderSuppliersTable() {
    loadSupplierPage(currentSupplierPage);
}