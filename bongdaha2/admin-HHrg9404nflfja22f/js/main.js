// Main Entry Point - 主入口文件
// 模块化架构 - 便于维护和扩展

import { getToken } from './modules/api.js';
import { debounce } from './modules/utils.js';
import { handleLogin, handleLogout, showLogin, showAdmin, checkAuth } from './modules/auth.js';
import { loadDashboard } from './modules/dashboard.js';
import { loadVisitorStats, loadVisitorList, setVisitorPage } from './modules/visitors.js';
import { loadArticles, loadCategoryOptions, openEditor, closeEditor, initEditor, saveArticle, toggleSelectAll, batchDelete } from './modules/articles.js';
import { loadImages, loadImageStats, loadFrontendDomain, saveFrontendDomain, initEvents as initImageEvents } from './modules/images.js';
import { loadCategories, openModal as openCategoryModal, closeModal as closeCategoryModal, saveCategory } from './modules/categories.js';
import { loadBlacklist, loadWhitelist, addBlacklist, addWhitelist, changePassword, openBlacklistModal, closeBlacklistModal, openWhitelistModal, closeWhitelistModal } from './modules/system.js';

let currentPage = 'dashboard';

// Navigation with localStorage caching
window.navigateTo = function(page) {
  currentPage = page;
  
  // Save to localStorage for page refresh restore
  localStorage.setItem('admin_current_page', page);
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  
  const titles = {
    dashboard: 'Dashboard',
    visitors: 'Visitor Statistics',
    'visitor-list': 'Visitor Details',
    articles: 'Articles',
    'article-editor': 'Article Editor',
    images: 'Batch Management',
    categories: 'Categories',
    blacklist: 'IP Blacklist',
    whitelist: 'IP Whitelist',
    password: 'Change Password'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Load page data
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'visitors': loadVisitorStats(); break;
    case 'visitor-list': loadVisitorList(); break;
    case 'articles': loadArticles(); loadCategoryOptions(); break;
    case 'article-editor': initEditor(); break;
    case 'images': loadImages(); loadImageStats(); loadFrontendDomain(); break;
    case 'categories': loadCategories(); break;
    case 'blacklist': loadBlacklist(); break;
    case 'whitelist': loadWhitelist(); break;
  }
};

// Setup Event Listeners
function setupEventListeners() {
  // Login
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.navigateTo(item.dataset.page);
    });
  });

  // Articles
  document.getElementById('new-article-btn')?.addEventListener('click', openEditor);
  document.getElementById('saveArticleBtn')?.addEventListener('click', saveArticle);
  document.getElementById('article-category-filter')?.addEventListener('change', () => loadArticles());
  document.getElementById('article-status-filter')?.addEventListener('change', () => loadArticles());
  document.getElementById('article-search')?.addEventListener('input', debounce(() => loadArticles(), 300));
  document.getElementById('select-all-articles')?.addEventListener('change', toggleSelectAll);
  document.getElementById('batch-delete-btn')?.addEventListener('click', batchDelete);

  // Categories
  document.getElementById('new-category-btn')?.addEventListener('click', openCategoryModal);
  document.getElementById('category-form')?.addEventListener('submit', saveCategory);

  // Blacklist
  document.getElementById('add-blacklist-btn')?.addEventListener('click', openBlacklistModal);
  document.getElementById('blacklist-form')?.addEventListener('submit', addBlacklist);

  // Whitelist
  document.getElementById('add-whitelist-btn')?.addEventListener('click', openWhitelistModal);
  document.getElementById('whitelist-form')?.addEventListener('submit', addWhitelist);

  // Password
  document.getElementById('password-form')?.addEventListener('submit', changePassword);

  // Visitor filter
  document.getElementById('filter-visitors-btn')?.addEventListener('click', () => { setVisitorPage(1); loadVisitorList(); });
  
  // Image events
  initImageEvents();
  
  // Frontend domain save
  window.saveFrontendDomain = saveFrontendDomain;
}

// Close modals - expose to window for onclick
window.closeCategoryModal = closeCategoryModal;
window.closeBlacklistModal = closeBlacklistModal;
window.closeWhitelistModal = closeWhitelistModal;
window.closeArticleEditor = closeEditor;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) {
    showAdmin();
    // Restore cached page or default to dashboard
    const cachedPage = localStorage.getItem('admin_current_page') || 'dashboard';
    window.navigateTo(cachedPage);
  } else {
    showLogin();
  }
  setupEventListeners();
});
