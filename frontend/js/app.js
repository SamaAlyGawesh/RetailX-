// app.js - Main application init

document.addEventListener('DOMContentLoaded', async () => {
    // دالة مساعدة للربط الآمن
    function safeBind(id, callback) {
        const el = document.getElementById(id);
        if (el) el.onclick = callback;
        else console.warn(`Element #${id} not found`);
    }

    // ========== SIDEBAR NAVIGATION ==========
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = item.getAttribute('data-page');
            navigateToPage(pageId);
            document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // ========== HAMBURGER & SIDEBAR ==========
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener('click', () => {
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                // وضع الموبايل: فتح/قفل Overlay
                sidebar.classList.toggle('open');
                hamburgerBtn.classList.toggle('active', sidebar.classList.contains('open'));
            } else {
                // وضع الديسكتوب: توسيع/طيّ الشريط الجانبي
                sidebar.classList.toggle('collapsed');
                hamburgerBtn.classList.toggle('active', sidebar.classList.contains('collapsed'));
            }
        });
    }

    // ========== USER DROPDOWN TOGGLE ==========
    const userBtn = document.querySelector('.user-btn');
    const userDropdown = document.getElementById('userDropdown');

    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // يمنع انتشار الحدث للـ document
            userDropdown.classList.toggle('active');
        });

        // إغلاق الـ Dropdown عند الضغط على أي مكان براه
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }

    // ---- أهم شيء: إغلاق المودالات دائماً ----
    document.querySelectorAll('.close-modal').forEach(btn => {
        if (btn) btn.onclick = function() { this.closest('.modal').classList.remove('active'); };
    });

    // ---- تحميل بيانات الجلسة ----
    if (typeof appState === 'undefined') {
        console.error('appState not defined - config.js might not be loaded.');
        return;
    }

    // ---- استعادة الجلسة إن وجدت ----
    loadAuthState();
    applyRoleBasedAccess();

    if (appState.isAuthenticated) {
        try {
            const [allProds, allSales, allSuppliersRes] = await Promise.all([
                apiGetProducts(1, 9999),
                apiGetSales(1, 9999),
                apiGetSuppliers(1, 9999)
            ]);
            DataStore.setProducts(allProds.products);
            DataStore.setSales(allSales.sales);
            DataStore.setSuppliers(allSuppliersRes.suppliers);
            
            document.dispatchEvent(new CustomEvent('salesDataReady'));

            const activity = await apiGetActivity();
            DataStore.setActivity(activity);
            fetchAndDisplayShiftStatus(); // أول مرة
            // تحديث الحالة كل دقيقة لو حابب (اختياري)
            // setInterval(fetchAndDisplayShiftStatus, 60000);
            // ✅ تحديث واجهة POS الآن بعد توفر بيانات المبيعات
            if (typeof window.checkShift === 'function') {
                window.checkShift();
            }
            //mainContent.style.marginLeft = '250px';
        } catch (err) {
            console.log('Backend not available – clearing auth');
            appState.isAuthenticated = false;
            appState.token = null;
            appState.currentUser = null;
            clearAuthState();
            updateAuthUI();
            applyRoleBasedAccess();
            //mainContent.style.marginLeft = '0';
        }
    }else{
        //mainContent.style.marginLeft = '0';
    }
    

    // ========== NAVIGATION (روابط أساسية فقط) ==========
    safeBind('homeLink', (e) => { e.preventDefault(); navigateToPage('homePage'); });

    // Get Started button
    safeBind('getStartedBtn', () => {
        if (appState.isAuthenticated) {
            if (hasPermission('dashboard')) {
                navigateToPage('dashboardPage');
            } else {
                navigateToPage('homePage');
            }
        } else {
            navigateToPage('authPage');
        }
    });

    // ---- Quick Access buttons ----
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
            const low = DataStore.getProducts().filter(p => p.quantity > 0 && p.quantity <= p.reorderLevel);
            const out = DataStore.getProducts().filter(p => p.quantity === 0);
            showToast(`Low Stock (${low.length}):\n${low.map(p => `${p.name}: ${p.quantity}`).join('\n')}\n\nOut of Stock (${out.length}):\n${out.map(p => p.name).join('\n')}`, 'info');
        },
        quickProfileBtn: () => {
            if (appState.currentUser) showToast(`Name: ${appState.currentUser.name}\nEmail: ${appState.currentUser.email}\nRole: ${appState.currentUser.role}`, 'info');
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

    updateDashboardStats();
    renderDashboardInventory();
    renderRecentActivity();
    // استعادة اللغة من localStorage
    const savedLang = localStorage.getItem('retailx_lang');
    if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
        currentLang = savedLang;
    } else {
        // لو مفيش لغة محفوظة، استخدم الافتراضية
        currentLang = 'en';
    }
    applyLanguage();

    console.log('RetailX frontend initialized');
    applyRoleBasedAccess();
    // ========== LANGUAGE TOGGLE ==========
    const languageToggle = document.getElementById('languageToggle');
    if (languageToggle) {
        languageToggle.onclick = () => {
            currentLang = currentLang === 'en' ? 'ar' : 'en';
            applyLanguage();
            localStorage.setItem('retailx_lang', currentLang);
        };
    }

    // ========== THEME TOGGLE ==========
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        // استعادة الثيم
        const savedTheme = localStorage.getItem('retailx_theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            const icon = themeToggleBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-sun';
        }

        themeToggleBtn.onclick = () => {
            document.body.classList.toggle('light-theme');
            const icon = themeToggleBtn.querySelector('i');
            if (icon) {
                icon.className = document.body.classList.contains('light-theme') ? 'fas fa-sun' : 'fas fa-moon';
            }
            localStorage.setItem('retailx_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
        };
    }

    // if (typeof window.loadPOSData === 'function' && typeof posShift !== 'undefined' && posShift) {
    //     window.loadPOSData();
    // }
});

function navigateToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    
    if (pageId === 'dashboardPage') { 
        updateDashboardStats(); 
        renderDashboardInventory(); 
        renderRecentActivity(); 
    }
    if (pageId === 'inventoryPage') renderInventoryTable();
    if (pageId === 'salesPage') renderSalesTable();
    if (pageId === 'suppliersPage') renderSuppliersTable();
    if (pageId === 'reportsPage') {
        const monthlyChart = Chart.getChart('monthlySalesChart');
        if (monthlyChart) monthlyChart.destroy();
        const topChart = Chart.getChart('topProductsChart');
        if (topChart) topChart.destroy();
        setTimeout(() => {
            if (typeof renderMonthlySalesChart === 'function') renderMonthlySalesChart();
            if (typeof renderTopProductsChart === 'function') renderTopProductsChart();
        }, 200);
    }

    // ✅ الصفحات الجديدة:
    if (pageId === 'usersPage') {
        if (typeof loadUserPage === 'function') loadUserPage(1);
    }
    // if (pageId === 'posPage') {
    // if (typeof window.checkShift === 'function') {
    //     window.checkShift();
    //     } else {
    //         // احتياط: جرب بعد 100ms لو لسه مش متعرفة
    //         setTimeout(() => {
    //             if (typeof window.checkShift === 'function') window.checkShift();
    //         }, 100);
    //     }
    // }   
    if (pageId === 'cashiersPage') {
        if (typeof loadCashiersPage === 'function') loadCashiersPage();
        if (typeof loadLiveCashiers === 'function') loadLiveCashiers();
    }
    
    window.scrollTo(0, 0);
}

function applyRoleBasedAccess() {
    const role = appState.isAuthenticated ? appState.currentUser.role : 'guest';
    const userPermissions = permissions[role] || {};

    // التحكم في عناصر الـ Sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        const page = item.getAttribute('data-page')?.replace('Page', ''); // dashboardPage -> dashboard
        if (!page) return;

        if (page === 'users') {
            item.style.display = (role === 'administrator' && permissions.administrator.manageUsers) ? 'flex' : 'none';
        } else if (page === 'cashiers') {
            item.style.display = userPermissions.cashiers ? 'flex' : 'none';
        } else if (page === 'pos') {
            item.style.display = userPermissions.sales ? 'flex' : 'none';
        } else {
            const perm = userPermissions[page];
            item.style.display = perm ? 'flex' : 'none';
        }
    });
}

// ========== تحديث مؤشر حالة الشيفت في الشريط العلوي ==========
window.updateShiftStatus = function(shift) {
    const statusEl = document.getElementById('shiftStatusText');
    if (!statusEl) return;
    if (shift) {
        statusEl.innerHTML = `<i class="fas fa-circle" style="color:#10b981; font-size:10px;"></i> Shift active · ${shift.start_time}`;
    } else {
        statusEl.innerHTML = `<i class="fas fa-circle" style="color:#94a3b8; font-size:10px;"></i> No shift`;
    }
};

// استدعاء حالة الشيفت الحالية بمجرد التوثيق
async function fetchAndDisplayShiftStatus() {
    if (!appState.isAuthenticated || !hasPermission('sales')) return;
    try {
        const res = await fetch(`${API_BASE}/shifts/my-shift`, {
            headers: { 'Authorization': `Bearer ${appState.token}` }
        });
        if (!res.ok) return;
        const shift = await res.json();
        window.updateShiftStatus(shift || null);
    } catch (e) {
        // فشل، لا شيء
    }
}