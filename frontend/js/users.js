// users.js - User management (admin only) with filtering, sorting & additional fields

let currentUsers = [];
let userSort = { field: 'id', order: 'asc' };
let currentUserPage = 1;
const userLimit = 15;
let totalUserPages = 1;
let allUsersForFilter = []; // للتخزين المؤقت عند الفلترة

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
            allUsersForFilter = [];
            loadUserPage(1);
        };
    }

    const debouncedLoadUsers = debounce(() => {
		allUsersForFilter = [];
		currentUserPage = 1;
		loadUserPage(1);
	}, 400);

	['filterId', 'filterName', 'filterEmail'].forEach(id => {
		const el = document.getElementById(id);
		if (el) el.addEventListener('input', debouncedLoadUsers);
	});
	document.getElementById('filterRole')?.addEventListener('change', () => {
		allUsersForFilter = [];
		currentUserPage = 1;
		loadUserPage(1);
	});
	document.getElementById('filterStatus')?.addEventListener('change', () => {
		allUsersForFilter = [];
		currentUserPage = 1;
		loadUserPage(1);
	});

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
            await apiUpdateUserRole(userId, select.value);
            showToast('Role updated', 'success');
            loadUserPage(currentUserPage);
        } else if (e.target.classList.contains('toggle-status-btn')) {
            const userId = e.target.dataset.userId;
            const currentStatus = e.target.dataset.status;
            const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
            await apiToggleUserStatus(userId, newStatus);
            loadUserPage(currentUserPage);
        } else if (e.target.classList.contains('reset-password-btn')) {
            const userId = e.target.dataset.userId;
            if (!confirm('Reset password to temporary password?')) return;
            try {
                const result = await apiResetUserPassword(userId);
                showToast(`Password has been reset to: ${result.tempPassword}`, 'success');
            } catch (err) { showToast(err.message, 'error'); }
        }
    });
});

function isAnyUserFilterActive() {
    const fields = ['filterId', 'filterName', 'filterEmail', 'filterRole', 'filterStatus'];
    return fields.some(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.tagName === 'SELECT') return el.value !== '';
        return el.value.trim() !== '';
    });
}

async function loadUserPage(page) {
    currentUserPage = page;
    if (isAnyUserFilterActive()) {
        if (allUsersForFilter.length === 0) {
            const data = await apiGetUsers(1, 9999);
            allUsersForFilter = data.users;
        }
        currentUsers = allUsersForFilter;
        applyUserFilters();
    } else {
        const data = await apiGetUsers(page, userLimit);
        currentUsers = data.users;
        totalUserPages = data.pages;
        applyUserFilters();
    }
}

function applyUserFilters() {
    const idFilter = document.getElementById('filterId')?.value.trim().toLowerCase() || '';
    const nameFilter = document.getElementById('filterName')?.value.trim().toLowerCase() || '';
    const emailFilter = document.getElementById('filterEmail')?.value.trim().toLowerCase() || '';
    const roleFilter = document.getElementById('filterRole')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';

    let filtered = currentUsers.filter(u => {
        return (idFilter ? u.id.toString().includes(idFilter) : true) &&
               (nameFilter ? u.name.toLowerCase().includes(nameFilter) : true) &&
               (emailFilter ? u.email.toLowerCase().includes(emailFilter) : true) &&
               (roleFilter ? u.role === roleFilter : true) &&
               (statusFilter ? u.status === statusFilter : true);
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

    const filterActive = isAnyUserFilterActive();
    if (filterActive) {
        totalUserPages = Math.ceil(filtered.length / userLimit);
        if (currentUserPage > totalUserPages) currentUserPage = 1;
        const start = (currentUserPage - 1) * userLimit;
        const pageItems = filtered.slice(start, start + userLimit);
        renderUsersTableHTML(pageItems);
    } else {
        renderUsersTableHTML(filtered);
    }

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
        const statusBtn = canChange ? 
            `<button class="btn btn-sm btn-warning toggle-status-btn" data-user-id="${u.id}" data-status="${u.status || 'active'}">
                ${u.status === 'disabled' ? 'Enable' : 'Disable'}
            </button>` : '';
        const resetBtn = canChange ? 
            `<button class="btn btn-sm btn-info reset-password-btn" data-user-id="${u.id}">
                <i class="fas fa-key"></i>
            </button>` : '';

        return `<tr>
            <td>${startNumber + index}</td>
            <td>${u.id}</td>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td><span style="color:${u.status === 'disabled' ? 'var(--danger)' : 'var(--secondary)'};">${u.status || 'active'}</span></td>
            <td>${canChange ? `<select id="roleSelect_${u.id}" class="form-control" style="width:auto;">${roleOptions}</select>` : '<span>Current</span>'}</td>
            <td>${u.created_at || '-'}</td>
            <td>${u.last_login || '-'}</td>
            <td>${u.branch || '-'}</td>
            <td>
                ${canChange ? `<button class="btn btn-sm btn-primary save-role-btn" data-user-id="${u.id}">Save Role</button>` : ''}
                ${statusBtn}
                ${resetBtn}
            </td>
        </tr>`;
    }).join('');
}

function updateUserSortArrows() {
    document.querySelectorAll('#usersTableMain th[data-sort] .sort-arrow').forEach(arrow => arrow.textContent = '');
    const active = document.querySelector(`#usersTableMain th[data-sort="${userSort.field}"] .sort-arrow`);
    if (active) active.textContent = userSort.order === 'asc' ? ' ▲' : ' ▼';
}