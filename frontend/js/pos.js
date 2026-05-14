// pos.js - POS shift management and cashier dashboard

let posShift = null;
let posSales = [];
window.checkShift = async function() {
    try {
        const res = await fetch(`${API_BASE}/shifts/my-shift`, {
            headers: { 'Authorization': `Bearer ${appState.token}` }
        });
        if (!res.ok) return;
        const shift = await res.json();
        posShift = shift;
        const startBtn = document.getElementById('posStartShift');
        const endBtn = document.getElementById('posEndShift');
        const statusSpan = document.getElementById('posShiftStatus');
        
        if (shift) {
            if(startBtn) startBtn.style.display = 'none';
            if(endBtn) endBtn.style.display = 'inline-flex';
            if(statusSpan) statusSpan.innerHTML = `<i class="fas fa-circle" style="color:#10b981;"></i> Shift active • ${shift.start_time}`;
            if (typeof window.refreshLiveCashiers === 'function') {
                window.refreshLiveCashiers();
            }
            loadPOSData();
            window.updateShiftStatus(shift);
        } else {
            if(startBtn) startBtn.style.display = 'inline-flex';
            if(endBtn) endBtn.style.display = 'none';
            if(statusSpan) statusSpan.innerText = '';
            clearPOSTable();
            window.updateShiftStatus(null);
        }
    } catch (e) {
        console.error('Shift check failed', e);
    }
};
document.addEventListener('DOMContentLoaded', () => {
    // عناصر الـ DOM
    const startBtn = document.getElementById('posStartShift');
    const endBtn = document.getElementById('posEndShift');
    const statusSpan = document.getElementById('posShiftStatus');
    const newSaleBtn = document.getElementById('posNewSale');

    

    if (startBtn) {
        startBtn.onclick = async () => {
            try {
                const res = await fetch(`${API_BASE}/shifts/start`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${appState.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ branch: 'Main Branch', department: 'General' })
                });
                if (!res.ok) throw new Error((await res.json()).error);
                showToast('Shift started!', 'success');
                updateShiftStatus({ start_time: new Date().toLocaleString() });
                checkShift();
            } catch (err) { showToast(err.message, 'error'); }
        };
    }

    if (endBtn) {
        endBtn.onclick = async () => {
            if (!confirm('End your shift?')) return;
            try {
                const res = await fetch(`${API_BASE}/shifts/end`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${appState.token}` }
                });
                if (!res.ok) throw new Error((await res.json()).error);
                showToast('Shift ended.', 'success');
                updateShiftStatus(null);
                checkShift();
            } catch (err) { showToast(err.message, 'error'); }
        };
    }

    if (newSaleBtn) {
        newSaleBtn.onclick = () => {
            // فتح نافذة البيع الجديد (نفس زرار New Sale في صفحة المبيعات)
            document.getElementById('addNewSale')?.click();
        };
    }

    // أول ما تفتح الصفحة افحص الشيفت
    if (appState.isAuthenticated) window.checkShift();

    // استمع لحدث "salesDataReady" لتحديث POS فقط عندما تكون البيانات جاهزة
    document.addEventListener('salesDataReady', () => {
        window.checkShift();
    });

    // احتياط: لو البيانات جاهزة بالفعل (عند تنفيذ pos.js متأخراً)
    if (typeof window.checkShift === 'function' && DataStore.getSales().length > 0) {
        window.checkShift();
    }
});

// تحميل وعرض فواتير الشيفت الحالي
function loadPOSData() {
    if (!posShift) return;
    const allSales = DataStore.getSales();
    const shiftStart = new Date(posShift.start_time);
    const myName = appState.currentUser.name;

    // فواتير الكاشير الحالي فقط بعد بداية الشيفت
    posSales = allSales.filter(s => s.cashier === myName && new Date(s.date) >= shiftStart);

    // تحديث الإحصائيات
    const totalSales = posSales.reduce((sum, s) => sum + s.total, 0);
    const groupedPOS = groupSales(posSales); // تجميع الفواتير
    const totalItems = groupedPOS.reduce((sum, g) => sum + g.items, 0);
    const totalInvoices = groupedPOS.length;
    document.getElementById('posTotalSales').innerText = formatPrice(totalSales);
    document.getElementById('posTotalInvoices').innerText = totalInvoices;
    document.getElementById('posTotalItems').innerText = totalItems;

    // عرض جدول الفواتير
    const tbody = document.getElementById('posSalesTable');
    if (!tbody) return;
    const grouped = groupSales(posSales); // دالة من sales.js
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
// تصدير الدالة لاستخدامها من sales.js
window.loadPOSData = loadPOSData;

function clearPOSTable() {
    document.getElementById('posTotalSales').innerText = '$0.00';
    document.getElementById('posTotalInvoices').innerText = '0';
    document.getElementById('posTotalItems').innerText = '0';
    const tbody = document.getElementById('posSalesTable');
    if (tbody) tbody.innerHTML = '';
}

// دالة يتم استدعاؤها بعد كل عملية بيع ناجحة من sales.js
window.refreshPOS = function() {
    if (document.getElementById('posPage') && document.getElementById('posPage').classList.contains('active')) {
        checkShift();
    }
};

// function updateShiftStatus(shift) {
//     const statusEl = document.getElementById('shiftStatusText');
//     if (!statusEl) return;
//     if (shift) {
//         statusEl.innerHTML = `<i class="fas fa-circle" style="color:#10b981; font-size:10px;"></i> Shift active · ${shift.start_time}`;
//     } else {
//         statusEl.innerHTML = `<i class="fas fa-circle" style="color:#94a3b8; font-size:10px;"></i> No shift`;
//     }
// }