// suppliers.js - Supplier management with filtering, sorting & pagination

let currentSuppliers = [];
let supplierSort = { field: 'name', order: 'asc' };
let currentSupplierPage = 1;
const supplierLimit = 15;
let totalSupplierPages = 1;
let editingSupplierId = null;   // <-- مهم يكون معرف

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addNewSupplier').onclick = () => {
        if (!hasPermission('suppliers')) return;
        clearSupplierForm();
        editingSupplierId = null;
        document.getElementById('addSupplierModal').classList.add('active');
    };

    document.getElementById('submitSupplier').onclick = async () => {
        if (!hasPermission('suppliers')) return;
        const supplier = {
            name: document.getElementById('supplierNameInput').value.trim(),
            contact: document.getElementById('supplierContactInput').value.trim(),
            email: document.getElementById('supplierEmailInput').value.trim(),
            phone: document.getElementById('supplierPhoneInput').value.trim(),
            leadTime: parseInt(document.getElementById('supplierLeadTimeInput').value) || 5,
            productsSuppliedList: []
        };
        const select = document.getElementById('supplierProductsSelect');
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].selected) supplier.productsSuppliedList.push(select.options[i].value);
        }
        if (!supplier.name || !supplier.email) return alert('Name and email required');
        try {
            if (editingSupplierId) {
                await apiUpdateSupplier(editingSupplierId, supplier);
            } else {
                await apiCreateSupplier(supplier);
            }
            await loadSupplierPage(currentSupplierPage);
            document.getElementById('addSupplierModal').classList.remove('active');
            clearSupplierForm();
        } catch (err) { alert(err.message); }
    };

    // Filter events
    ['filterSupplierName','filterContact','filterSupplierEmail','filterSupplierPhone','filterProductsSupplied','filterLeadTime'].forEach(id => {
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

    loadSupplierPage(1);
});

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
    const product = (document.getElementById('filterProductsSupplied')?.value || '').toLowerCase();
    const leadTime = document.getElementById('filterLeadTime')?.value;

    let filtered = currentSuppliers.filter(s => {
        const matchName = name ? s.name.toLowerCase().includes(name) : true;
        const matchContact = contact ? (s.contact || '').toLowerCase().includes(contact) : true;
        const matchEmail = email ? s.email.toLowerCase().includes(email) : true;
        const matchPhone = phone ? (s.phone || '').toLowerCase().includes(phone) : true;
        const matchProduct = product ? (s.productsSuppliedList || []).some(p => p.toLowerCase().includes(product)) : true;
        const matchLeadTime = leadTime ? s.leadTime == leadTime : true;
        return matchName && matchContact && matchEmail && matchPhone && matchProduct && matchLeadTime;
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
    renderPagination(currentSupplierPage, totalSupplierPages, 'supplierPagination', (page) => {
        loadSupplierPage(page);
    });
}

async function renderSuppliersTable() {
    await loadSupplierPage(currentSupplierPage);
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
        const productsHtml = (s.productsSuppliedList || []).map(p => `<span class="supplier-product-badge">${p}</span>`).join('') || '<span class="supplier-product-badge">No products</span>';
        return `<tr>
            <td>${startNumber + index}</td>
            <td>${s.name}</td><td>${s.contact || '-'}</td><td>${s.email}</td><td>${s.phone || '-'}</td>
            <td><div class="supplier-products-list">${productsHtml}</div></td><td>${s.leadTime} days</td>
            <td><button class="btn btn-sm btn-primary" onclick="editSupplier(${s.id})"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}

function updateSupplierSortArrows() {
    document.querySelectorAll('#suppliersTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#suppliersTableMain th[data-sort="${supplierSort.field}"] .sort-arrow`);
    if (active) active.textContent = supplierSort.order === 'asc' ? ' ▲' : ' ▼';
}

// ========== دوال المودال ==========
window.editSupplier = function(id) {
    if (!hasPermission('suppliers')) return;
    const s = suppliersData.find(s => s.id === id);
    if (!s) return;
    document.getElementById('supplierNameInput').value = s.name;
    document.getElementById('supplierContactInput').value = s.contact || '';
    document.getElementById('supplierEmailInput').value = s.email;
    document.getElementById('supplierPhoneInput').value = s.phone || '';
    document.getElementById('supplierLeadTimeInput').value = s.leadTime;
    const select = document.getElementById('supplierProductsSelect');
    for (let i = 0; i < select.options.length; i++) {
        select.options[i].selected = s.productsSuppliedList?.includes(select.options[i].value) || false;
    }
    editingSupplierId = id;
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

function clearSupplierForm() {
    document.getElementById('supplierNameInput').value = '';
    document.getElementById('supplierContactInput').value = '';
    document.getElementById('supplierEmailInput').value = '';
    document.getElementById('supplierPhoneInput').value = '';
    document.getElementById('supplierLeadTimeInput').value = '5';
    const select = document.getElementById('supplierProductsSelect');
    for (let i = 0; i < select.options.length; i++) select.options[i].selected = false;
    editingSupplierId = null;
}