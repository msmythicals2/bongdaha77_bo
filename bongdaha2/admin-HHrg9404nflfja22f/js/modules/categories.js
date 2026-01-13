// Categories Module
import { api } from './api.js';
import { escapeHtml } from './utils.js';

let editingCategoryId = null;

export async function loadCategories() {
  try {
    const data = await api('/categories');
    if (data.success) {
      document.getElementById('categories-body').innerHTML = (data.data || []).map(c => `
        <tr>
          <td>${c.name}</td>
          <td>${c.slug}</td>
          <td>${c.article_count || 0}</td>
          <td>${c.sort_order}</td>
          <td><span class="badge ${c.is_enabled ? 'enabled' : 'disabled'}">${c.is_enabled ? 'Enabled' : 'Disabled'}</span></td>
          <td class="actions">
            <button class="action-btn" onclick="window.AdminCategories.edit(${c.id}, '${escapeHtml(c.name)}', '${escapeHtml(c.description || '')}', ${c.sort_order}, ${c.is_enabled})"><i class="fa-solid fa-edit"></i></button>
            <button class="action-btn delete" onclick="window.AdminCategories.delete(${c.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No categories</td></tr>';
    }
  } catch (err) {
    console.error('Categories error:', err);
  }
}

export function openModal() {
  editingCategoryId = null;
  document.getElementById('category-modal-title').textContent = 'New Category';
  document.getElementById('category-form').reset();
  document.getElementById('category-enabled').checked = true;
  document.getElementById('category-modal').classList.remove('hidden');
}

export function editCategory(id, name, desc, order, enabled) {
  editingCategoryId = id;
  document.getElementById('category-modal-title').textContent = 'Edit Category';
  document.getElementById('category-name').value = name;
  document.getElementById('category-description').value = desc;
  document.getElementById('category-order').value = order;
  document.getElementById('category-enabled').checked = enabled;
  document.getElementById('category-modal').classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('category-modal').classList.add('hidden');
}

export async function saveCategory(e) {
  e.preventDefault();
  
  const payload = {
    name: document.getElementById('category-name').value,
    description: document.getElementById('category-description').value,
    sort_order: parseInt(document.getElementById('category-order').value) || 0,
    is_enabled: document.getElementById('category-enabled').checked
  };

  try {
    const endpoint = editingCategoryId ? `/categories/${editingCategoryId}` : '/categories';
    const method = editingCategoryId ? 'PUT' : 'POST';
    const data = await api(endpoint, { method, body: JSON.stringify(payload) });
    if (data.success) { closeModal(); loadCategories(); }
    else alert(data.error || 'Save failed');
  } catch (err) {
    console.error('Save category error:', err);
  }
}

export async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    const data = await api(`/categories/${id}`, { method: 'DELETE' });
    if (data.success) loadCategories();
    else alert(data.error || 'Delete failed');
  } catch (err) {
    console.error('Delete category error:', err);
  }
}

// Expose to window
window.AdminCategories = {
  edit: editCategory,
  delete: deleteCategory,
  openModal,
  closeModal
};
