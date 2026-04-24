// config.js - Global app state & constants

const API_BASE = 'http://localhost:3000/api';

const appState = {
    isAuthenticated: false,
    currentUser: null,
    token: null,
    theme: 'dark',
    language: 'en',
    currency: '$'
};

// Global data stores (cached from API)
let inventoryData = [];
let salesData = [];
let suppliersData = [];
let activityLog = [];
let usersDatabase = [];

// Role-based permissions
const permissions = {
    administrator: { dashboard: true, inventory: true, sales: true, reports: true, suppliers: true, settings: true, addProduct: true, importExport: true },
    clerk: { dashboard: true, inventory: true, reports: true, addProduct: true, suppliers: false, settings: false, sales: false, importExport: false },
    cashier: { dashboard: true, sales: true, inventory: false, reports: false, suppliers: false, settings: false, addProduct: false, importExport: false },
    sales: { dashboard: true, sales: true, reports: true, inventory: false, suppliers: false, settings: false, addProduct: false, importExport: false }
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
    for (const id in langObj) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.placeholder !== undefined) el.placeholder = langObj[id];
            } else {
                el.innerText = langObj[id];
            }
        }
    }
    // Update the language button text
    const langSpan = document.querySelector('#languageToggle span');
    if (langSpan) langSpan.innerText = currentLang === 'en' ? 'العربية' : 'English';
    // RTL support
    document.body.classList.toggle('rtl', currentLang === 'ar');
}