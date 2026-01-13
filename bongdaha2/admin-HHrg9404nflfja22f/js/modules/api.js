// API Module - 统一API请求处理
const API_BASE = 'http://localhost:8080/api';

let token = localStorage.getItem('admin_token');

export function getToken() {
  return token;
}

export function setToken(newToken) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('admin_token', newToken);
  } else {
    localStorage.removeItem('admin_token');
  }
}

export async function api(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  
  if (res.status === 401) {
    setToken(null);
    localStorage.removeItem('admin_user');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  
  return res.json();
}

export async function apiUpload(endpoint, formData) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  return res.json();
}

export { API_BASE };
