// settings.js - Settings & backup

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.settings-nav').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('.settings-nav').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            document.getElementById(link.dataset.section + 'Settings').classList.add('active');
        };
    });

    document.getElementById('saveSettings').onclick = () => {
        if (!hasPermission('settings')) return;
        const newCurrency = document.getElementById('currencySelect').value;
        if (newCurrency !== appState.currency) {
            appState.currency = newCurrency;
            updateAllPrices();
        }
        alert('Settings saved!');
    };

    document.getElementById('createBackup').onclick = async () => {
        try {
            const data = await apiGetBackup();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `retailx_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            alert('Backup downloaded!');
        } catch (err) { alert(err.message); }
    };
});

function updateAllPrices() {
    updateDashboardStats();
    renderInventoryTable();
    renderDashboardInventory();
    renderSalesTable();
    document.getElementById('currencySymbolDisplay').innerText = appState.currency;
}