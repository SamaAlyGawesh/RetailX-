// auth.js - Authentication logic

document.addEventListener('DOMContentLoaded', () => {
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
            document.getElementById('userNameDisplay').innerText = appState.currentUser.name;
            applyRoleBasedAccess();
            navigateToPage('homePage');
            updateDashboardStats();
            renderInventoryTable();
            renderSalesTable();
            renderSuppliersTable();
            renderRecentActivity();
            alert(`Welcome ${appState.currentUser.name}!`);
        } catch (err) {
            alert(err.message || 'Invalid credentials');
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
        if (password !== confirm) { alert('Passwords do not match'); return; }
        try {
            await apiRegister(name, email, password, role);
            alert('Account created! Please sign in.');
            document.getElementById('signInTab').click();
        } catch (err) {
            alert(err.message || 'Registration failed');
        }
    };

    // Sign Out
    document.getElementById('signOutLink').onclick = (e) => {
        e.preventDefault();
        appState.isAuthenticated = false;
        appState.currentUser = null;
        appState.token = null;
        document.getElementById('userNameDisplay').innerText = 'Sign In';
        navigateToPage('authPage');
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
            alert(`Name: ${appState.currentUser.name}\nEmail: ${appState.currentUser.email}\nRole: ${appState.currentUser.role}`);
        }
    };
});