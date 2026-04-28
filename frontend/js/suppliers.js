// suppliers.js - Supplier management

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
            await apiGetSuppliers();
            renderSuppliersTable();
            document.getElementById('addSupplierModal').classList.remove('active');
            clearSupplierForm();
        } catch (err) { alert(err.message); }
    };
});

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
        await apiGetSuppliers();
        renderSuppliersTable();
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

async function renderSuppliersTable() {
    const tbody = document.getElementById('suppliersTable');
    if (!tbody) return;
    if (suppliersData.length === 0) await apiGetSuppliers();
    if (suppliersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No suppliers found.</td></tr>';
        return;
    }
    tbody.innerHTML = suppliersData.map(s => {
        const productsHtml = (s.productsSuppliedList || []).map(p => `<span class="supplier-product-badge">${p}</span>`).join('') || '<span class="supplier-product-badge">No products</span>';
        return `<tr>
            <td>${s.name}</td><td>${s.contact || '-'}</td><td>${s.email}</td><td>${s.phone || '-'}</td>
            <td><div class="supplier-products-list">${productsHtml}</div></td><td>${s.leadTime} days</td>
            <td><button class="btn btn-sm btn-primary" onclick="editSupplier(${s.id})"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }).join('');
}