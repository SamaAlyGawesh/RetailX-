// cashiers.js - Cashier performance tracking

let cashierStats = []; // { name, totalSales, totalTransactions, lastSaleDate, sales: [] }

document.addEventListener('DOMContentLoaded', () => {
    // const navCashiers = document.getElementById('navCashiers');
    // if (navCashiers) {
    //     navCashiers.onclick = (e) => {
    //         e.preventDefault();
    //         if (!appState.isAuthenticated || !hasPermission('cashiers')) {
    //             navigateToPage('authPage');
    //             return;
    //         }
    //         navigateToPage('cashiersPage');
    //         loadCashiersPage();
    //     };
    // }

    document.getElementById('refreshCashiers')?.addEventListener('click', () => {
        loadCashiersPage();
        loadLiveCashiers();
    });

    // Delegation for view sales button
    document.getElementById('cashiersTable')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-cashier-sales')) {
            const cashierName = e.target.dataset.cashier;
            showCashierSales(cashierName);
        }
    });

    // setTimeout(() => {
    //     if (typeof loadLiveCashiers === 'function') loadLiveCashiers();
    // }, 500);
});

function computeCashierStats() {
    const sales = DataStore.getSales();
    const cashierMap = {};

    // 1. تجميع كل الفواتير
    const groupedSales = groupSales(sales);

    // 2. حساب الإحصائيات من الفواتير المجمعة
    groupedSales.forEach(g => {
        const name = g.cashier || 'Unknown';
        if (!cashierMap[name]) {
            cashierMap[name] = {
                name,
                totalSales: 0,
                totalTransactions: 0,  // عدد الفواتير
                lastSaleDate: '',
                sales: []
            };
        }
        cashierMap[name].totalSales += g.total || 0;
        cashierMap[name].totalTransactions += 1;  // ✅ كل فاتورة = 1 ترانزاكشن
        if (!cashierMap[name].lastSaleDate || g.date > cashierMap[name].lastSaleDate) {
            cashierMap[name].lastSaleDate = g.date;
        }
        // تخزين الصفوف الأصلية للفاتورة
        const originalSales = sales.filter(s => s.id.startsWith(g.id));
        cashierMap[name].sales.push(...originalSales);
    });

    cashierStats = Object.values(cashierMap).sort((a, b) => b.totalTransactions - a.totalTransactions);
}

async function loadCashiersPage() {
    showLoader();
    try {
        // Ensure fresh sales data
        const res = await apiGetSales(1, 9999);
        DataStore.setSales(res.sales);
        computeCashierStats();
        renderCashiersTable();
    } catch (err) {
        showToast('Error loading cashiers data', 'error');
    } finally {
        hideLoader();
    }
}

function renderCashiersTable() {
    const tbody = document.getElementById('cashiersTable');
    if (!tbody) return;
    const langObj = translations[currentLang] || translations['en'];
    
    if (cashierStats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${langObj.noCashiers || 'No cashiers data found.'}</td></tr>`;
        return;
    }
    tbody.innerHTML = cashierStats.map((c, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${c.name}</td>
            <td>${formatPrice(c.totalSales)}</td>
            <td>${c.totalTransactions}</td>
            <td>${c.lastSaleDate || '—'}</td>
            <td>
                <button class="btn btn-sm btn-primary view-cashier-sales" data-cashier="${c.name}">
                    <i class="fas fa-eye"></i> <span data-translate="viewSalesBtn">${langObj.viewSalesBtn || 'View Sales'}</span>
                </button>
            </td>
        </tr>
    `).join('');
}

function showCashierSales(cashierName) {
    const cashier = cashierStats.find(c => c.name === cashierName);
    if (!cashier) return;
    
    const langObj = translations[currentLang] || translations['en'];

    document.getElementById('cashierSalesModalTitle').innerText = `${langObj.cashierSalesModalTitle || 'Sales of Cashier'}: ${cashierName}`;

    const grouped = groupSales(cashier.sales);
    let html = `
    <table class="inventory-table">
        <thead>
            <tr>
                <th>${langObj.invoiceIDCol || 'Invoice ID'}</th>
                <th>${langObj.invoiceDateLabel || 'Date'}</th>
                <th>${langObj.invoiceCustomerLabel || 'Customer'}</th>
                <th>${langObj.invoiceItemsCol || 'Items'}</th>
                <th>${langObj.invoiceTotalCol || 'Total'}</th>
            </tr>
        </thead>
        <tbody>
    `;
    grouped.forEach(g => {
        html += `
            <tr>
                <td>${g.id}</td>
                <td>${g.date}</td>
                <td>${g.customer}</td>
                <td>${g.items}</td>
                <td>${formatPrice(g.total)}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';

    document.getElementById('cashierSalesContent').innerHTML = html;
    document.getElementById('cashierSalesModal').classList.add('active');
}

// في cashiers.js، أضف هذه الدوال
async function loadLiveCashiers() {
    if (!appState.isAuthenticated) return;  // <-- أضف هذا السطر
    try {
        const res = await fetch(`${API_BASE}/shifts/active`, {
            headers: { 'Authorization': `Bearer ${appState.token}` }
        });
        if (!res.ok) return;
        const shifts = await res.json();
        renderCashierCards(shifts);
        window.refreshLiveCashiers = function() {
            if (document.getElementById('cashiersPage')?.classList.contains('active')) {
                loadLiveCashiers();
            }
        };
    } catch (e) {}
}

function renderCashierCards(shifts) {
    const container = document.getElementById('liveCashiersContainer');
    if (!container) return;
    if (shifts.length === 0) {
        container.innerHTML = `<p data-translate="noActiveCashiers">No active cashiers at the moment.</p>`;
        // ترجمة فورية
        const langObj = translations[currentLang] || translations['en'];
        const el = container.querySelector('[data-translate]');
        if (el && langObj[el.getAttribute('data-translate')]) {
            el.innerText = langObj[el.getAttribute('data-translate')];
        }
        return;
    }

    const allSales = DataStore.getSales();
    const langObj = translations[currentLang] || translations['en'];

    const grouped = {};
    shifts.forEach(s => {
        const key = `${s.branch} - ${s.department}`;
        if (!grouped[key]) grouped[key] = [];
        
        const shiftStart = new Date(s.start_time);
        const cashierSales = allSales.filter(sale => {
            return sale.cashier === s.cashier_name && new Date(sale.date) >= shiftStart;
        });
        
        const totalSalesAmount = cashierSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        const totalInvoices = cashierSales.length;
        const totalItemsSold = cashierSales.reduce((sum, sale) => sum + (sale.items || 0), 0);
        
        s.stats = {
            totalSales: formatPrice(totalSalesAmount),
            invoices: totalInvoices,
            itemsSold: totalItemsSold
        };
        
        grouped[key].push(s);
    });

    let html = '';
    for (const [group, members] of Object.entries(grouped)) {
        html += `<h4 style="margin-top:20px;">${group}</h4><div style="display: flex; flex-wrap: wrap; gap: 20px;">`;
        members.forEach(s => {
            html += `
                <div class="live-cashier-card">
                    <div class="card-icon"><i class="fas fa-user-circle"></i></div>
                    <h5>${s.cashier_name}</h5>
                    <p><span data-translate="startedLabel">Started</span>: ${s.start_time}</p>
                    <div style="text-align:left; margin:10px 0;">
                        <div><strong data-translate="salesLabel">Sales</strong>: ${s.stats.totalSales}</div>
                        <div><strong data-translate="invoicesLabel">Invoices</strong>: ${s.stats.invoices}</div>
                        <div><strong data-translate="itemsSoldLabel">Items sold</strong>: ${s.stats.itemsSold}</div>
                    </div>
                    <span class="badge" data-translate="activeBadge">Active</span>
                </div>
            `;
        });
        html += '</div>';
    }
    container.innerHTML = html;

    // ترجمة فورية للكروت
    container.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if (langObj[key]) {
            el.innerText = langObj[key];
        }
    });
}
// ننشئ حاوية الـ live cashiers في صفحة cashiersPage
// ونداء دوري
// if (document.getElementById('cashiersPage')) {
//     setInterval(loadLiveCashiers, 10000);
//     loadLiveCashiers();
// }