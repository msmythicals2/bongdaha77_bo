// System Module - Blacklist, Whitelist, Password
import { api } from './api.js';
import { formatDate, showMsg } from './utils.js';

// Blacklist
export async function loadBlacklist() {
  try {
    const data = await api('/blacklist');
    if (data.success) {
      document.getElementById('blacklist-body').innerHTML = (data.data || []).map(b => `
        <tr>
          <td>${b.ip_address}</td>
          <td>${b.reason || '-'}</td>
          <td>${formatDate(b.created_at)}</td>
          <td>${b.expires_at ? formatDate(b.expires_at) : 'Never'}</td>
          <td class="actions">
            <button class="action-btn delete" onclick="window.AdminSystem.removeBlacklist(${b.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No entries</td></tr>';
    }
  } catch (err) {
    console.error('Blacklist error:', err);
  }
}

export function openBlacklistModal() {
  document.getElementById('blacklist-modal').classList.remove('hidden');
}

export function closeBlacklistModal() {
  document.getElementById('blacklist-modal').classList.add('hidden');
}

export async function addBlacklist(e) {
  e.preventDefault();
  const expiresInput = document.getElementById('blacklist-expires').value;
  const payload = {
    ip_address: document.getElementById('blacklist-ip').value,
    reason: document.getElementById('blacklist-reason').value,
    expires_at: expiresInput ? expiresInput.replace('T', ' ') + ':00' : ''
  };

  try {
    const data = await api('/blacklist', { method: 'POST', body: JSON.stringify(payload) });
    if (data.success) {
      closeBlacklistModal();
      document.getElementById('blacklist-form').reset();
      loadBlacklist();
    } else alert(data.error || 'Add failed');
  } catch (err) {
    console.error('Add blacklist error:', err);
  }
}

export async function removeBlacklist(id) {
  if (!confirm('Remove from blacklist?')) return;
  try {
    const data = await api(`/blacklist/${id}`, { method: 'DELETE' });
    if (data.success) loadBlacklist();
  } catch (err) {
    console.error('Remove blacklist error:', err);
  }
}

// Whitelist
export async function loadWhitelist() {
  try {
    const data = await api('/whitelist');
    if (data.success) {
      document.getElementById('whitelist-body').innerHTML = (data.data || []).map(w => `
        <tr>
          <td>${w.ip_address}</td>
          <td>${w.description || '-'}</td>
          <td>${formatDate(w.created_at)}</td>
          <td class="actions">
            <button class="action-btn delete" onclick="window.AdminSystem.removeWhitelist(${w.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No entries</td></tr>';
    }
  } catch (err) {
    console.error('Whitelist error:', err);
  }
}

export function openWhitelistModal() {
  document.getElementById('whitelist-modal').classList.remove('hidden');
}

export function closeWhitelistModal() {
  document.getElementById('whitelist-modal').classList.add('hidden');
}

export async function addWhitelist(e) {
  e.preventDefault();
  const payload = {
    ip_address: document.getElementById('whitelist-ip').value,
    description: document.getElementById('whitelist-description').value
  };

  try {
    const data = await api('/whitelist', { method: 'POST', body: JSON.stringify(payload) });
    if (data.success) {
      closeWhitelistModal();
      document.getElementById('whitelist-form').reset();
      loadWhitelist();
    } else alert(data.error || 'Add failed');
  } catch (err) {
    console.error('Add whitelist error:', err);
  }
}

export async function removeWhitelist(id) {
  if (!confirm('Remove from whitelist?')) return;
  try {
    const data = await api(`/whitelist/${id}`, { method: 'DELETE' });
    if (data.success) loadWhitelist();
  } catch (err) {
    console.error('Remove whitelist error:', err);
  }
}

// Password
export async function changePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('old-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    showMsg('password-msg', 'Passwords do not match', 'error');
    return;
  }

  try {
    const data = await api('/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });

    if (data.success) {
      showMsg('password-msg', 'Password updated successfully', 'success');
      document.getElementById('password-form').reset();
    } else {
      showMsg('password-msg', data.error || 'Update failed', 'error');
    }
  } catch (err) {
    showMsg('password-msg', 'Connection error', 'error');
  }
}

// Expose to window
window.AdminSystem = {
  removeBlacklist,
  removeWhitelist,
  openBlacklistModal,
  closeBlacklistModal,
  openWhitelistModal,
  closeWhitelistModal
};
