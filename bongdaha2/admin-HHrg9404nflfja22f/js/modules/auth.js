// Auth Module
import { api, setToken, getToken } from './api.js';
import { showError } from './utils.js';

export async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('http://localhost:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
      setToken(data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      showAdmin();
      window.navigateTo('dashboard');
    } else {
      showError('login-error', data.error || 'Login failed');
    }
  } catch (err) {
    showError('login-error', 'Connection error');
  }
}

export function handleLogout() {
  setToken(null);
  localStorage.removeItem('admin_user');
  showLogin();
}

export function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('admin-app').classList.add('hidden');
}

export function showAdmin() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
  document.getElementById('admin-username').textContent = user.username || 'Admin';
}

export function checkAuth() {
  return !!getToken();
}
