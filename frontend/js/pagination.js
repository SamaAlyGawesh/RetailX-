// pagination.js - Generic pagination component

function renderPagination(currentPage, totalPages, containerId, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';
    
    // Previous button
    html += `<button class="btn btn-sm btn-outline" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">« Prev</button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="btn btn-sm btn-primary active" data-page="${i}">${i}</button>`;
        } else {
            html += `<button class="btn btn-sm btn-outline" data-page="${i}">${i}</button>`;
        }
    }
    
    // Next button
    html += `<button class="btn btn-sm btn-outline" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next »</button>`;
    
    html += '</div>';

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.getAttribute('data-page'));
            if (page >= 1 && page <= totalPages) {
                onPageChange(page);
            }
        });
    });
}