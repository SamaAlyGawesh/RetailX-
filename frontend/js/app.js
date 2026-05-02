// app.js - Main application init

document.addEventListener('DOMContentLoaded', async () => {
    // دالة مساعدة للربط الآمن
    function safeBind(id, callback) {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
        else console.warn(`Element #${id} not found`);
    }

    // ---- أهم شيء: إغلاق المودالات دائماً ----
    document.querySelectorAll('.close-modal').forEach(btn => {
        if (btn) btn.onclick = function() { this.closest('.modal').classList.remove('active'); };
    });
    window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };

    // ---- تحميل بيانات الجلسة ----
    if (typeof appState === 'undefined') {
        console.error('appState not defined - config.js might not be loaded.');
        return;
    }

    // ---- استعادة الجلسة إن وجدت ----
    loadAuthState();
    applyRoleBasedAccess();
    /*if (appState.isAuthenticated) {
        try {
            await apiGetProducts();
            await apiGetSales();
            await apiGetSuppliers();
            await apiGetActivity();
        } catch (err) {
            console.log('Backend not available – using empty data');
        }
    }*/
	if(appState.isAuthenticated){
    try {
        //loadAuthState();
        const allProds = await apiGetProducts(1, 9999);
        inventoryData = allProds.products;
        const allSales = await apiGetSales(1, 9999);
        salesData = allSales.sales;
        await apiGetSuppliers();
        await apiGetActivity();
    } catch (err) {
        console.log('Backend not available – using empty data');
    }
}

    // ========== NAVIGATION BAR (آمنة بالكامل) ==========
    safeBind('homeLink', (e) => { e.preventDefault(); navigateToPage('homePage'); });
    safeBind('navHome', (e) => { e.preventDefault(); navigateToPage('homePage'); });
    safeBind('navDashboard', (e) => {
        e.preventDefault();
        if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
        if (!hasPermission('dashboard')) return;
        navigateToPage('dashboardPage');
    });
    safeBind('navInventory', (e) => {
        e.preventDefault();
        if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
        if (!hasPermission('inventory')) return;
        navigateToPage('inventoryPage');
    });
    safeBind('navSales', (e) => {
        e.preventDefault();
        if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
        if (!hasPermission('sales')) return;
        navigateToPage('salesPage');
    });
    safeBind('navReports', (e) => {
        e.preventDefault();
        if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
        if (!hasPermission('reports')) return;
        navigateToPage('reportsPage');
    });
    safeBind('navSuppliers', (e) => {
        e.preventDefault();
        if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
        if (!hasPermission('suppliers')) return;
        navigateToPage('suppliersPage');
    });
	/*
    safeBind('navSettings', (e) => {
        e.preventDefault();
        if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
        if (!hasPermission('settings')) return;
        navigateToPage('settingsPage');
    });
	*/
    // Get Started button on home page
    safeBind('getStartedBtn', () => {
    if (appState.isAuthenticated) {
        if (hasPermission('dashboard')) {
            navigateToPage('dashboardPage');
        } else {
            navigateToPage('homePage');   // أو صفحة بديلة لو حابب
        }
    } else {
        navigateToPage('authPage');
    }
	});

    // Theme toggle
    safeBind('themeToggle', () => {
        document.body.classList.toggle('light-theme');
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
    });

    // Language toggle
    safeBind('languageToggle', () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        applyRoleBasedAccess();
        applyLanguage();
        renderInventoryTable();
        renderSuppliersTable();
        renderSalesTable();
        updateDashboardStats();
    });

    // ---- Quick Access buttons (طريقة آمنة) ----
    const quickMap = {
        quickDashboardBtn: () => { if (hasPermission('dashboard')) navigateToPage('dashboardPage'); },
        quickInventoryBtn: () => { if (hasPermission('inventory')) navigateToPage('inventoryPage'); },
        quickAddProductBtn: () => { if (hasPermission('addProduct')) document.getElementById('addProductModal')?.classList.add('active'); },
        quickSalesReportBtn: () => { if (hasPermission('reports')) navigateToPage('reportsPage'); },
        quickSettingsBtn: () => { if (hasPermission('settings')) navigateToPage('settingsPage'); },
        quickSuppliersBtn: () => { if (hasPermission('suppliers')) navigateToPage('suppliersPage'); },
        quickReportsBtn: () => { if (hasPermission('reports')) navigateToPage('reportsPage'); },
        quickLowStockBtn: () => {
            if (!appState.isAuthenticated) { navigateToPage('authPage'); return; }
            const low = inventoryData.filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel);
            const out = inventoryData.filter(p => p.quantity === 0);
            alert(`Low Stock (${low.length}):\n${low.map(p => `${p.name}: ${p.quantity}`).join('\n')}\n\nOut of Stock (${out.length}):\n${out.map(p => p.name).join('\n')}`);
        },
        quickProfileBtn: () => {
            if (appState.currentUser) alert(`Name: ${appState.currentUser.name}\nEmail: ${appState.currentUser.email}\nRole: ${appState.currentUser.role}`);
        }
    };

    for (const id in quickMap) {
        safeBind(id, (e) => { e.preventDefault(); quickMap[id](); });
    }

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
    const settingsLink = document.getElementById('settingsLink');
    if (settingsLink) {
        settingsLink.onclick = (e) => {
            e.preventDefault();
            if (hasPermission('settings')) navigateToPage('settingsPage');
        };
    }

    applyLanguage();
    updateDashboardStats();
    renderDashboardInventory();
    renderRecentActivity();

    console.log('RetailX frontend initialized');
    applyRoleBasedAccess();
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
    //const pages = ['dashboard', 'inventory', 'sales', 'reports', 'suppliers', 'users', 'settings'];
	const pages = ['dashboard', 'inventory', 'sales', 'reports', 'suppliers', 'users'];
    const role = appState.isAuthenticated ? appState.currentUser.role : 'guest';
    pages.forEach(page => {
        const el = document.getElementById(`nav${page.charAt(0).toUpperCase() + page.slice(1)}`);
        if (el) {
            if (page === 'users') {
                el.style.display = (role === 'administrator' && permissions.administrator.manageUsers) ? 'flex' : 'none';
            } else {
                const perm = permissions[role]?.[page];
                el.style.display = perm ? 'flex' : 'none';
            }
        }
    });
}