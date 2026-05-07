// auth.js - Authentication logic

document.addEventListener('DOMContentLoaded', () => {
	loadAuthState();
	if (appState.isAuthenticated) {
		document.getElementById('userNameDisplay').innerText = appState.currentUser.name;
		applyRoleBasedAccess();
	}
	updateAuthUI();
    // Tab switching
    document.getElementById('signInTab').onclick = () => {
        document.getElementById('signInTab').classList.add('active');
        document.getElementById('signUpTab').classList.remove('active');
        document.getElementById('signInForm').classList.add('active');
        document.getElementById('signUpForm').classList.remove('active');
    };
    document.getElementById('signUpTab').onclick = () => {
        document.getElementById('signUpTab').classList.add('active');
        document.getElementById('signInTab').classList.remove('active');
        document.getElementById('signUpForm').classList.add('active');
        document.getElementById('signInForm').classList.remove('active');
    };

    // Sign In
    document.getElementById('signInForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        try {
			await apiLogin(email, password);
            
            // --- تحميل البيانات العالمية فوراً ---
            try {
                const allProds = await apiGetProducts(1, 9999);
                inventoryData = allProds.products;
                const allSales = await apiGetSales(1, 9999);
                salesData = allSales.sales;
                suppliersData = (await apiGetSuppliers(1, 9999)).suppliers;
                await apiGetActivity();
            } catch (e) {
                console.log('Initial data load after login failed', e);
            }
            // ---------------------------------

            document.getElementById('userNameDisplay').innerText = appState.currentUser.name;
            applyRoleBasedAccess();
            navigateToPage('homePage');
            updateDashboardStats();
            renderDashboardInventory();
            renderRecentActivity();
            showToast(`Welcome ${appState.currentUser.name}!`, 'success');
            saveAuthState();
            updateAuthUI();
        } catch (err) {
            showToast(err.message || 'Invalid credentials', 'error');
        }
    };

    // Sign Up
    document.getElementById('signUpForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirm = document.getElementById('signupConfirmPassword').value;
        const role = document.getElementById('signupRole').value;
        if (password !== confirm) { showToast('Passwords do not match', 'error'); return; }
        try {
            await apiRegister(name, email, password, role);
            showToast('Account created! Please sign in.', 'success');
            document.getElementById('signInTab').click();
        } catch (err) {
            showToast(err.message || 'Registration failed', 'error');
        }
    };

    // Sign In / Sign Out link (dynamic)
	document.getElementById('signOutLink').onclick = (e) => {
    e.preventDefault();
    if (appState.isAuthenticated) {
        // Logout
        appState.isAuthenticated = false;
        appState.currentUser = null;
        appState.token = null;
        document.getElementById('userNameDisplay').innerText = 'Sign In';
        clearAuthState();
        updateAuthUI();
		applyRoleBasedAccess();
        navigateToPage('authPage');
    } else {
        navigateToPage('authPage');
    }
};

    // User dropdown
    document.getElementById('userDropdown').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('userDropdown').classList.toggle('active');
    };
    document.onclick = () => document.getElementById('userDropdown').classList.remove('active');

    // Profile link
    document.getElementById('profileLink').onclick = (e) => {
        e.preventDefault();
        if (appState.currentUser) {
            showToast(`Name: ${appState.currentUser.name}\nEmail: ${appState.currentUser.email}\nRole: ${appState.currentUser.role}`, 'info');
        }
    };
});