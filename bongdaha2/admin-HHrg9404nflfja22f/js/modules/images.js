// Images Module
import { api, apiUpload, API_BASE, getToken } from './api.js';
import { formatDate, formatFileSize, renderPagination } from './utils.js';

let imagePage = 1;
let imageFilter = 'all';

export async function loadImageStats() {
  try {
    const data = await api('/images/stats');
    if (data.success) {
      const s = data.data;
      document.getElementById('img-total').textContent = s.total_images || 0;
      document.getElementById('img-used').textContent = s.used_images || 0;
      document.getElementById('img-unused').textContent = s.unused_images || 0;
      document.getElementById('img-size').textContent = (s.total_size_mb || 0).toFixed(2) + ' MB';
      document.getElementById('tab-all-count').textContent = s.total_images || 0;
      document.getElementById('tab-used-count').textContent = s.used_images || 0;
      document.getElementById('tab-unused-count').textContent = s.unused_images || 0;
    }
  } catch (err) {
    console.error('Image stats error:', err);
  }
}

export async function loadImages() {
  try {
    let url = `/images/list?page=${imagePage}&page_size=20`;
    if (imageFilter === 'used') url += '&is_used=true';
    else if (imageFilter === 'unused') url += '&is_used=false';
    
    const data = await api(url);
    if (data.success) {
      const tbody = document.getElementById('imageTableBody');
      const images = data.data || [];
      const frontendUrl = getFrontendDomain();
      
      if (images.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);"><i class="fa-solid fa-images" style="font-size:2rem;margin-bottom:10px;display:block;"></i>No images found</td></tr>';
      } else {
        tbody.innerHTML = images.map(img => {
          const fullUrl = frontendUrl + img.file_url;
          return `
          <tr>
            <td><img src="${fullUrl}" alt="" style="width:50px;height:50px;object-fit:cover;border-radius:6px;background:var(--panel-2);" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23334155%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 fill=%22%2394a3b8%22 text-anchor=%22middle%22 font-size=%2212%22>No img</text></svg>'"/></td>
            <td>
              <div style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${img.file_name}">${img.file_name}</div>
              <small style="color:var(--muted);font-size:11px;">${img.file_url}</small>
            </td>
            <td>${formatFileSize(img.file_size)}</td>
            <td>${img.width || '?'} x ${img.height || '?'}</td>
            <td><span class="badge ${img.is_used ? 'published' : 'draft'}">${img.is_used ? 'Used' : 'Unused'}</span></td>
            <td>${formatDate(img.uploaded_at)}</td>
            <td>
              <button class="action-btn" onclick="window.AdminImages.copyUrl('${fullUrl}')" title="Copy URL"><i class="fa-solid fa-copy"></i></button>
              <button class="action-btn" onclick="window.AdminImages.preview('${fullUrl}')" title="Preview"><i class="fa-solid fa-eye"></i></button>
              <button class="action-btn" onclick="window.AdminImages.toggleUsed(${img.id}, ${img.is_used})" title="${img.is_used ? 'Mark Unused' : 'Mark Used'}">
                <i class="fa-solid fa-${img.is_used ? 'times-circle' : 'check-circle'}"></i>
              </button>
              <button class="action-btn delete" onclick="window.AdminImages.delete(${img.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `}).join('');
      }
      
      renderPagination('image-pagination', data.total, data.page, data.page_size, (p) => {
        imagePage = p;
        loadImages();
      });
    }
  } catch (err) {
    console.error('Images error:', err);
  }
}

function getFrontendDomain() {
  return localStorage.getItem('frontend_domain') || 'http://localhost:3000';
}

export function saveFrontendDomain() {
  const domain = document.getElementById('frontendDomain').value.trim();
  if (domain) {
    localStorage.setItem('frontend_domain', domain.replace(/\/$/, ''));
    alert('Frontend URL saved!');
    loadImages();
  }
}

export function loadFrontendDomain() {
  const saved = getFrontendDomain();
  const input = document.getElementById('frontendDomain');
  if (input) input.value = saved;
}

export function copyUrl(url) {
  navigator.clipboard.writeText(url).then(() => alert('URL copied!'));
}

export function preview(url) {
  window.open(url, '_blank');
}

export async function toggleUsed(id, currentState) {
  try {
    const endpoint = currentState ? `/images/mark-unused/${id}` : `/images/mark-used/${id}`;
    const data = await api(endpoint, { method: 'POST' });
    if (data.success) {
      loadImages();
      loadImageStats();
    }
  } catch (err) {
    console.error('Toggle image error:', err);
  }
}

export async function deleteImage(id) {
  if (!confirm('Delete this image?')) return;
  try {
    const data = await api(`/images/${id}`, { method: 'DELETE' });
    if (data.success) {
      loadImages();
      loadImageStats();
    }
  } catch (err) {
    console.error('Delete image error:', err);
  }
}

export async function handleUpload(files) {
  if (!files || files.length === 0) return;
  
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await apiUpload('/images/upload', formData);
    } catch (err) {
      console.error('Upload error:', err);
    }
  }
  
  loadImages();
  loadImageStats();
}

export function setFilter(filter) {
  imageFilter = filter;
  imagePage = 1;
}

export function initEvents() {
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      setFilter(tab.dataset.filter);
      loadImages();
    });
  });
  
  // Image upload dropzone
  const dropzone = document.getElementById('imageDropzone');
  const fileInput = document.getElementById('imageFileInput');
  
  dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); handleUpload(e.dataTransfer.files); });
  fileInput?.addEventListener('change', (e) => handleUpload(e.target.files));
}

// Expose to window for onclick handlers
window.AdminImages = {
  copyUrl,
  preview,
  toggleUsed,
  delete: deleteImage
};
