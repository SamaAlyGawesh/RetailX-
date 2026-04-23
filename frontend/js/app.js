// app.js - Main application init

document.addEventListener('DOMContentLoaded', async () => {
    // Load initial data from backend
    try {
        await apiGetProducts();
        await apiGetSales();
        await apiGetSuppliers();
        await apiGetActivity();
    } catch (err) {
        console.log('Backend not available – using empty data');
    }

    // Theme toggle
    document.getElementById('themeToggle').onclick = () => {
        document.body.classList.toggle('light-theme');
        document.getElementById('themeToggle').querySelector('i').className =
            document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
    };

    // Language toggle
    document.getElementById('languageToggle').onclick = () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        applyLanguage();
        renderInventoryTable();
        renderSuppliersTable();
        renderSalesTable();
        updateDashboardStats();
    };

    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn =>
        btn.onclick = function() { this.closest('.modal').classList.remove('active'); }
    );
    window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };

    // Quick Access buttons
    document.getElementById('quickDashboardBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('dashboard')) navigateToPage('dashboardPage'); };
    document.getElementById('quickInventoryBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('inventory')) navigateToPage('inventoryPage'); };
    document.getElementById('quickAddProductBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('addProduct')) document.getElementById('addProductModal').classList.add('active'); };
    document.getElementById('quickSalesReportBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('reports')) navigateToPage('reportsPage'); };
    document.getElementById('quickSettingsBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('settings')) navigateToPage('settingsPage'); };
    document.getElementById('quickSuppliersBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('suppliers')) navigateToPage('suppliersPage'); };
    document.getElementById('quickReportsBtn').onclick = (e) => { e.preventDefault(); if (hasPermission('reports')) navigateToPage('reportsPage'); };

    document.getElementById('quickLowStockBtn').onclick = (e) => {
        e.preventDefault();
        const low = inventoryData.filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel);
        const out = inventoryData.filter(p => p.quantity === 0);
        alert(`Low Stock (${low.length}):\n${low.map(p => `${p.name}: ${p.quantity}`).join('\n')}\n\nOut of Stock (${low.length}):\n${out.map(p => p.name).join('\n')}`);
    };

    document.getElementById('quickProfileBtn').onclick = (e) => {
        e.preventDefault();
        if (appState.currentUser) alert(`Name: ${appState.currentUser.name}\nEmail: ${appState.currentUser.email}\nRole: ${appState.currentUser.role}`);
    };

    // Feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.onclick = (e) => {
            if (e.target.classList.contains('btn')) return;
            const feature = card.getAttribute('data-feature');
            if (!appState.isAuthenticated || !hasPermission(feature)) return;
            navigateToPage(feature + 'Page');
        };
    });

    // Settings link in dropdown
    document.getElementById('settingsLink').onclick = (e) => {
        e.preventDefault();
        if (hasPermission('settings')) navigateToPage('settingsPage');
    };

    applyLanguage();
    updateDashboardStats();
    renderDashboardInventory();
    renderRecentActivity();

    console.log('RetailX frontend initialized');
});

function navigateToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (pageId === 'dashboardPage') { updateDashboardStats(); renderDashboardInventory(); renderRecentActivity(); }
    if (pageId === 'inventoryPage') renderInventoryTable();
    if (pageId === 'salesPage') renderSalesTable();
    if (pageId === 'suppliersPage') renderSuppliersTable();
    window.scrollTo(0, 0);
}

function applyRoleBasedAccess() {
    if (!appState.isAuthenticated) return;
    ['dashboard', 'inventory', 'sales', 'reports', 'suppliers', 'settings'].forEach(page => {
        const el = document.getElementById(`nav${page.charAt(0).toUpperCase() + page.slice(1)}`);
        if (el) el.style.display = hasPermission(page) ? 'flex' : 'none';
    });
}