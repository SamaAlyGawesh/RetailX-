// pos.js - POS shift management and cashier dashboard

let posShift = null;
let posSales = [];

window.checkShift = async function() {
    try {
        const res = await fetch(`${API_BASE}/shifts/my-shift`, {
            headers: { 'Authorization': `Bearer ${appState.token}` }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to fetch shift');
        }
        const shift = await res.json();
        posShift = shift;
        const startBtn = document.getElementById('posStartShift');
        const endBtn = document.getElementById('posEndShift');
        const statusSpan = document.getElementById('posShiftStatus');
        const newSaleBtn = document.getElementById('posNewSale');

        if (shift) {
            if (startBtn) startBtn.style.display = 'none';
            if (endBtn) endBtn.style.display = 'inline-flex';
            if (statusSpan) statusSpan.innerHTML = `<i class="fas fa-circle" style="color:#10b981;"></i> Shift active • ${shift.start_time}`;
            if (newSaleBtn) newSaleBtn.disabled = false;  // ✅ تفعيل الزر
            if (typeof window.refreshLiveCashiers === 'function') {
                window.refreshLiveCashiers();
            }
            loadPOSData();
            window.updateShiftStatus(shift);
        } else {
            if (startBtn) startBtn.style.display = 'inline-flex';
            if (endBtn) endBtn.style.display = 'none';
            if (statusSpan) statusSpan.innerText = '';
            if (newSaleBtn) newSaleBtn.disabled = true;   // ✅ تعطيل الزر
            clearPOSTable();
            window.updateShiftStatus(null);
        }
    } catch (e) {
        console.error('Shift check failed:', e);
        showToast('Shift check failed: ' + e.message, 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('posStartShift');
    const endBtn = document.getElementById('posEndShift');
    const newSaleBtn = document.getElementById('posNewSale');

    if (startBtn) {
        startBtn.onclick = async () => {
            // ✅ تعطيل زر New Sale فوراً لمنع أي ضغط قبل ما checkShift تخلص
            if (newSaleBtn) newSaleBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE}/shifts/start`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${appState.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ branch: 'Main Branch', department: 'General' })
                });
                if (!res.ok) throw new Error((await res.json()).error);
                showToast('Shift started!', 'success');
                window.updateShiftStatus({ start_time: new Date().toLocaleString() });
                await checkShift(); // هيفعّل الزر تلقائيًا بعد ما posShift تتعين
            } catch (err) {
                showToast(err.message, 'error');
                checkShift(); // يعيد ضبط الحالة
            }
        };
    }

    if (endBtn) {
        endBtn.onclick = async () => {
            if (!confirm('End your shift?')) return;
            // ✅ تعطيل الزر مؤقتًا
            if (newSaleBtn) newSaleBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE}/shifts/end`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${appState.token}` }
                });
                if (!res.ok) throw new Error((await res.json()).error);
                showToast('Shift ended.', 'success');
                window.updateShiftStatus(null);
                await checkShift(); // ✅ انتظر التحديث (هيعطل الزر لأن مفيش شيفت)
            } catch (err) {
                showToast(err.message, 'error');
                checkShift();
            }
        };
    }

    if (newSaleBtn) {
        newSaleBtn.onclick = () => {
            // ✅ حماية إضافية: لو لسه مفيش posShift، بلّغ المستخدم
            if (!posShift) {
                showToast('Please wait, shift is loading...', 'warning');
                return;
            }
            document.getElementById('addNewSale')?.click();
        };
    }

    if (appState.isAuthenticated) window.checkShift();

    document.addEventListener('salesDataReady', () => {
        window.checkShift();
    });

    if (typeof window.checkShift === 'function' && DataStore.getSales().length > 0) {
        window.checkShift();
    }
});

function loadPOSData() {
    if (!posShift) {
        console.warn('loadPOSData called but posShift is null');
        return;
    }
    const allSales = DataStore.getSales();
    const shiftStart = new Date(posShift.start_time);
    const myName = appState.currentUser.name;

    posSales = allSales.filter(s => s.cashier === myName && new Date(s.date) >= shiftStart);

    const totalSales = posSales.reduce((sum, s) => sum + s.total, 0);
    const groupedPOS = groupSales(posSales);
    const totalItems = groupedPOS.reduce((sum, g) => sum + g.items, 0);
    const totalInvoices = groupedPOS.length;

    const posTotalSales = document.getElementById('posTotalSales');
    const posTotalInvoices = document.getElementById('posTotalInvoices');
    const posTotalItems = document.getElementById('posTotalItems');
    if (posTotalSales) posTotalSales.innerText = formatPrice(totalSales);
    if (posTotalInvoices) posTotalInvoices.innerText = totalInvoices;
    if (posTotalItems) posTotalItems.innerText = totalItems;

    const tbody = document.getElementById('posSalesTable');
    if (!tbody) return;
    const grouped = groupSales(posSales);
    tbody.innerHTML = grouped.map((g, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${g.id}</td>
            <td>${g.date}</td>
            <td>${g.customer}</td>
            <td>${g.items}</td>
            <td>${formatPrice(g.total)}</td>
            <td><button class="btn btn-sm btn-primary" onclick="viewInvoice('${g.id}')"><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
}
window.loadPOSData = loadPOSData;

function clearPOSTable() {
    const posTotalSales = document.getElementById('posTotalSales');
    const posTotalInvoices = document.getElementById('posTotalInvoices');
    const posTotalItems = document.getElementById('posTotalItems');
    if (posTotalSales) posTotalSales.innerText = '$0.00';
    if (posTotalInvoices) posTotalInvoices.innerText = '0';
    if (posTotalItems) posTotalItems.innerText = '0';
    const tbody = document.getElementById('posSalesTable');
    if (tbody) tbody.innerHTML = '';
}

window.refreshPOS = function() {
    if (document.getElementById('posPage')?.classList.contains('active')) {
        checkShift();
    }
};