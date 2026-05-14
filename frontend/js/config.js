// config.js - Global app state & constants

const API_BASE = '/api';

const appState = {
    isAuthenticated: false,
    currentUser: null,
    token: null,
    theme: 'dark',
    language: 'en',
    currency: '$'
};

// Global data stores (cached from API)
//let inventoryData = [];
//let salesData = [];
//let suppliersData = [];
//let activityLog = [];
let usersDatabase = [];

// Role-based permissions
const permissions = {
    administrator: { 
        dashboard: true, inventory: true, sales: true, reports: true, suppliers: true, settings: true,
        addProduct: true, editProduct: true, deleteProduct: true,
        addSale: true, deleteSale: true,
        addSupplier: true, editSupplier: true, deleteSupplier: true,
        manageUsers: true, importExport: true,
        cashiers: true
    },
    clerk: { 
        dashboard: true, inventory: true, reports: true,
        addProduct: true, editProduct: true, deleteProduct: false,
        addSale: false, deleteSale: false,
        addSupplier: false, editSupplier: false, deleteSupplier: false,
        manageUsers: false, importExport: false 
    },
    cashier: { 
        dashboard: false, sales: true,
        addProduct: false, editProduct: false, deleteProduct: false,
        addSale: true, deleteSale: false,
        addSupplier: false, editSupplier: false, deleteSupplier: false,
        manageUsers: false, importExport: false 
    },
    sales: { 
        dashboard: false, sales: true, reports: true,
        addProduct: false, editProduct: false, deleteProduct: false,
        addSale: true, deleteSale: false,
        addSupplier: false, editSupplier: false, deleteSupplier: false,
        manageUsers: false, importExport: false 
    },
    user: { 
        dashboard: false, inventory: false, sales: false, reports: false, suppliers: false, settings: false,
        addProduct: false, editProduct: false, deleteProduct: false,
        addSale: false, deleteSale: false,
        addSupplier: false, editSupplier: false, deleteSupplier: false,
        manageUsers: false, importExport: false 
    },
    viewer: { 
        dashboard: false, inventory: false, sales: false, reports: false, suppliers: false, settings: false,
        addProduct: false, editProduct: false, deleteProduct: false,
        addSale: false, deleteSale: false,
        addSupplier: false, editSupplier: false, deleteSupplier: false,
        manageUsers: false, importExport: false 
    }
};

function hasPermission(permission) {
    if (!appState.isAuthenticated || !appState.currentUser) return false;
    return permissions[appState.currentUser.role]?.[permission] === true;
}

function formatPrice(price) {
    return appState.currency + parseFloat(price).toFixed(2);
}

let currentLang = 'en';
let editingSupplierId = null;

function applyLanguage() {
    const langObj = translations[currentLang] || translations['en'];
    
    // ترجمة العناصر بالـ ID
    for (const id in langObj) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder !== undefined) el.placeholder = langObj[id];
            } else if (el.tagName === 'OPTION') {
                el.text = langObj[id];
            } else {
                el.innerText = langObj[id];
            }
        }
    }
    
    // ترجمة العناصر بالـ data-translate (للعناصر المتكررة)
    document.querySelectorAll('[data-translate]').forEach(el => {
        const key = el.getAttribute('data-translate');
        if (langObj[key]) {
            el.innerText = langObj[key];
        }
    });
    
    // تحديث زر اللغة
    const langSpan = document.querySelector('#languageToggle span');
    if (langSpan) langSpan.innerText = currentLang === 'en' ? 'العربية' : 'English';
    
    // RTL support
    document.body.classList.toggle('rtl', currentLang === 'ar');
}
function saveAuthState() {
    localStorage.setItem('retailx_token', appState.token);
    localStorage.setItem('retailx_user', JSON.stringify(appState.currentUser));
}

function loadAuthState() {
    const token = localStorage.getItem('retailx_token');
    const user = localStorage.getItem('retailx_user');
    if (token && user) {
        appState.token = token;
        appState.currentUser = JSON.parse(user);
        appState.isAuthenticated = true;
    }
}

function clearAuthState() {
    localStorage.removeItem('retailx_token');
    localStorage.removeItem('retailx_user');
}
/*
function updateAuthUI() {
    const userNameDisplay = document.getElementById('userNameDisplay');
    const signOutLink = document.getElementById('signOutLink');
    const sidebar = document.getElementById('sidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const shiftStatus = document.getElementById('shiftStatusText');
    
    if (appState.isAuthenticated && appState.currentUser) {
        userNameDisplay.innerText = appState.currentUser.name;
        signOutLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
        if (sidebar) sidebar.style.display = 'flex';
        if (hamburgerBtn) hamburgerBtn.style.display = 'flex';
        if (shiftStatus) shiftStatus.style.display = 'inline';
    } else {
        userNameDisplay.innerText = 'Sign In';
        signOutLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        if (sidebar) sidebar.style.display = 'none';
        if (hamburgerBtn) hamburgerBtn.style.display = 'none';
        if (shiftStatus) shiftStatus.style.display = 'none';
    }
}
*/

function updateAuthUI() {
    const userNameDisplay = document.getElementById('userNameDisplay');
    const signOutLink = document.getElementById('signOutLink');
    const sidebar = document.getElementById('sidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const shiftStatus = document.getElementById('shiftStatusText');
    //const mainContent = document.querySelector('.main-content');
    // const btnAuthEmail = document.getElementById('authEmail');
    // const btnAuthPassword = document.getElementById('authPassword');
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    if (appState.isAuthenticated && appState.currentUser) {
        userNameDisplay.innerText = appState.currentUser.name;
        signOutLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sign Out';
        document.body.classList.add('logged-in');
        if (shiftStatus) shiftStatus.style.display = 'inline';
        //mainContent.style.marginLeft = '250px';
        
    } else {
        userNameDisplay.innerText = 'Sign In';
        signOutLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        document.body.classList.remove('logged-in');
        if (sidebar) sidebar.classList.remove('open');
        if (hamburgerBtn) hamburgerBtn.classList.remove('active');
        if (shiftStatus) shiftStatus.style.display = 'none';
        //mainContent.style.marginLeft = '0';
    }
}

// Toast notification system
function showToast(message, type = 'success') {
    // إزالة أي toast موجودة سابقاً
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);

    // إزالة تلقائية بعد 4 ثوان
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Debounce utility
function debounce(fn, delay = 400) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Global Loader functions
function showLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'flex';
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';
}

// ========== Button Loading Utility ==========
function setButtonLoading(btn, loadingText = 'Loading...') {
    if (!btn) return;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
}

function resetButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('loading');
    if (btn.dataset.originalText) {
        btn.innerHTML = btn.dataset.originalText;
        delete btn.dataset.originalText;
    }
}