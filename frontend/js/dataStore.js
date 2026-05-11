// dataStore.js - Centralized state management
const DataStore = {
    _products: [],
    _sales: [],
    _suppliers: [],
    _activity: [],

    // ---------- Products ----------
    getProducts() {
        return this._products;
    },
    setProducts(products) {
        this._products = products;
    },
    addProduct(product) {
        this._products.push(product);
    },
    updateProduct(updatedProduct) {
        const index = this._products.findIndex(p => p.id === updatedProduct.id);
        if (index !== -1) this._products[index] = updatedProduct;
    },
    removeProduct(id) {
        this._products = this._products.filter(p => p.id !== id);
    },

    // ---------- Sales ----------
    getSales() {
        return this._sales;
    },
    setSales(sales) {
        this._sales = sales;
    },

    // ---------- Suppliers ----------
    getSuppliers() {
        return this._suppliers;
    },
    setSuppliers(suppliers) {
        this._suppliers = suppliers;
    },

    // ---------- Activity ----------
    getActivity() {
        return this._activity;
    },
    setActivity(activity) {
        this._activity = activity;
    }
};

// For backward compatibility (temporary, will be removed after all files are updated)
let inventoryData = DataStore.getProducts();
let salesData = DataStore.getSales();
let suppliersData = DataStore.getSuppliers();
let activityLog = DataStore.getActivity();