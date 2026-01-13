// Utils Module - 通用工具函数

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function showError(elemId, msg) {
  const elem = document.getElementById(elemId);
  if (elem) {
    elem.textContent = msg;
    elem.classList.remove('hidden');
  }
}

export function showMsg(elemId, msg, type) {
  const elem = document.getElementById(elemId);
  if (elem) {
    elem.textContent = msg;
    elem.className = `msg ${type}`;
    elem.classList.remove('hidden');
  }
}

export function renderPagination(containerId, total, page, pageSize, onClick) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${page === 1 ? 'disabled' : ''}>Prev</button>`;
  
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="${i === page ? 'active' : ''}">${i}</button>`;
  }
  
  if (totalPages > 5) {
    html += `<button disabled>...</button>`;
    html += `<button class="${totalPages === page ? 'active' : ''}">${totalPages}</button>`;
  }
  
  html += `<button ${page === totalPages ? 'disabled' : ''}>Next</button>`;
  
  container.innerHTML = html;
  
  container.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.textContent;
      if (text === 'Prev' && page > 1) onClick(page - 1);
      else if (text === 'Next' && page < totalPages) onClick(page + 1);
      else if (!isNaN(parseInt(text))) onClick(parseInt(text));
    });
  });
}
