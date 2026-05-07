// pagination.js - Generic pagination component with smart page buttons

function renderPagination(currentPage, totalPages, containerId, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const maxVisibleButtons = 7; // عدد الأزرار المرئية
    let html = '<div class="pagination" style="flex-wrap: wrap; justify-content: center; gap: 5px;">';
    
    // Previous button
    html += `<button class="btn btn-sm btn-outline" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">« Prev</button>`;
    
    // حساب نطاق الصفحات المعروضة
    let startPage, endPage;
    if (totalPages <= maxVisibleButtons) {
        startPage = 1;
        endPage = totalPages;
    } else {
        const half = Math.floor(maxVisibleButtons / 2);
        if (currentPage <= half + 1) {
            startPage = 1;
            endPage = maxVisibleButtons;
        } else if (currentPage >= totalPages - half) {
            startPage = totalPages - maxVisibleButtons + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - half;
            endPage = currentPage + half;
        }
    }
    
    // الصفحة الأولى و ... إذا لزم
    if (startPage > 1) {
        html += `<button class="btn btn-sm btn-outline" data-page="1">1</button>`;
        if (startPage > 2) {
            html += `<span class="pagination-ellipsis">…</span>`;
        }
    }
    
    // أزرار الصفحات
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="btn btn-sm btn-primary active" data-page="${i}">${i}</button>`;
        } else {
            html += `<button class="btn btn-sm btn-outline" data-page="${i}">${i}</button>`;
        }
    }
    
    // ... و الصفحة الأخيرة
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="pagination-ellipsis">…</span>`;
        }
        html += `<button class="btn btn-sm btn-outline" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    html += `<button class="btn btn-sm btn-outline" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next »</button>`;
    
    html += '</div>';

    container.innerHTML = html;

    // ربط الأحداث
    container.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.getAttribute('data-page'));
            if (page >= 1 && page <= totalPages) {
                onPageChange(page);
            }
        });
    });
}