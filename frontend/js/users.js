// users.js - User management (admin only) with filtering, sorting & pagination

let currentUsers = [];
let userSort = { field: 'id', order: 'asc' };
let currentUserPage = 1;
const userLimit = 15;
let totalUserPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    const navUsers = document.getElementById('navUsers');
    if (navUsers) {
        navUsers.onclick = (e) => {
            e.preventDefault();
            if (!appState.isAuthenticated || !hasPermission('manageUsers')) {
                navigateToPage('authPage');
                return;
            }
            navigateToPage('usersPage');
            loadUserPage(1);
        };
    }

    // Filter events
    ['filterId', 'filterName', 'filterEmail', 'filterRole'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { currentUserPage = 1; loadUserPage(1); });
    });
    document.getElementById('filterRole')?.addEventListener('change', () => { currentUserPage = 1; loadUserPage(1); });

    // Sorting
    document.querySelectorAll('#usersTableMain th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            userSort.order = (userSort.field === field && userSort.order === 'asc') ? 'desc' : 'asc';
            userSort.field = field;
            updateUserSortArrows();
            loadUserPage(currentUserPage);
        });
    });

    document.getElementById('usersTable').addEventListener('click', async (e) => {
        if (e.target.classList.contains('save-role-btn')) {
            const userId = e.target.dataset.userId;
            const select = document.getElementById(`roleSelect_${userId}`);
            const newRole = select.value;
            try {
                await apiUpdateUserRole(userId, newRole);
                alert('Role updated successfully');
                loadUserPage(currentUserPage);
            } catch (err) {
                alert(err.message);
            }
        }
    });
});

async function loadUserPage(page) {
    currentUserPage = page;
    const data = await apiGetUsers(page, userLimit);
    currentUsers = data.users;
    totalUserPages = data.pages;
    applyUserFilters();
}

function applyUserFilters() {
    const idFilter = document.getElementById('filterId')?.value.trim().toLowerCase() || '';
    const nameFilter = document.getElementById('filterName')?.value.trim().toLowerCase() || '';
    const emailFilter = document.getElementById('filterEmail')?.value.trim().toLowerCase() || '';
    const roleFilter = document.getElementById('filterRole')?.value || '';

    let filtered = currentUsers.filter(u => {
        const matchId = idFilter ? u.id.toString().includes(idFilter) : true;
        const matchName = nameFilter ? u.name.toLowerCase().includes(nameFilter) : true;
        const matchEmail = emailFilter ? u.email.toLowerCase().includes(emailFilter) : true;
        const matchRole = roleFilter ? u.role === roleFilter : true;
        return matchId && matchName && matchEmail && matchRole;
    });

    filtered.sort((a, b) => {
        let valA = a[userSort.field];
        let valB = b[userSort.field];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return userSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return userSort.order === 'asc' ? 1 : -1;
        return 0;
    });

    renderUsersTableHTML(filtered);
    renderPagination(currentUserPage, totalUserPages, 'userPagination', (page) => {
        loadUserPage(page);
    });
}

function renderUsersTableHTML(users) {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;
    const roles = ['user', 'viewer', 'sales', 'cashier', 'clerk', 'administrator'];
    const currentUserEmail = appState.currentUser?.email;
    const startNumber = (currentUserPage - 1) * userLimit + 1;

    tbody.innerHTML = users.map((u, index) => {
        const roleOptions = roles.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('');
        const canChange = (currentUserEmail !== u.email);
        return `<tr>
            <td>${startNumber + index}</td>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>${canChange ? `<select id="roleSelect_${u.id}" class="form-control" style="width:auto;">${roleOptions}</select>` : '<span>Current</span>'}</td>
            <td>${canChange ? `<button class="btn btn-sm btn-primary save-role-btn" data-user-id="${u.id}">Save Role</button>` : ''}</td>
        </tr>`;
    }).join('');
}

function updateUserSortArrows() {
    document.querySelectorAll('#usersTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#usersTableMain th[data-sort="${userSort.field}"] .sort-arrow`);
    if (active) active.textContent = userSort.order === 'asc' ? ' ▲' : ' ▼';
}