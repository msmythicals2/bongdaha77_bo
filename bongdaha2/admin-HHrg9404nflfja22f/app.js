function getApiBase() {
  return window.APP_CONFIG?.API_BASE || 'http://localhost:8080/api';
}

let token = localStorage.getItem('admin_token');
let currentPage = 'dashboard';
let trendChart = null;

// Article state
let articlePage = 1;
let editingArticleId = null;
let selectedArticleIds = [];
let editor = null;

// Image state
let imagePage = 1;
let imageFilter = 'all';

// Visitor state
let visitorPage = 1;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for config to load
  await window.CONFIG_READY;
  
  if (token) {
    showAdmin();
    loadDashboard();
  } else {
    showLogin();
  }

  setupEventListeners();
  setupSidebar();
});

function setupEventListeners() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Navigation - regular nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Hover menu items
  document.querySelectorAll('.hover-menu-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Article events
  document.getElementById('new-article-btn')?.addEventListener('click', openArticleEditor);
  document.getElementById('saveArticleBtn')?.addEventListener('click', handleArticleSave);
  document.getElementById('article-category-filter')?.addEventListener('change', () => { articlePage = 1; loadArticles(); });
  document.getElementById('article-status-filter')?.addEventListener('change', () => { articlePage = 1; loadArticles(); });
  document.getElementById('article-search')?.addEventListener('input', debounce(() => { articlePage = 1; loadArticles(); }, 300));
  document.getElementById('select-all-articles')?.addEventListener('change', toggleSelectAllArticles);
  document.getElementById('batch-delete-btn')?.addEventListener('click', handleBatchDeleteArticles);

  // Auto-generate slug from title
  document.getElementById('article-title')?.addEventListener('input', (e) => {
    if (!editingArticleId) {
      const slug = generateSlugFromTitle(e.target.value);
      document.getElementById('article-slug').value = slug;
    }
  });

  // Category events
  document.getElementById('new-category-btn')?.addEventListener('click', openNewCategoryModal);
  document.getElementById('category-form')?.addEventListener('submit', handleCategorySave);

  // Blacklist events
  document.getElementById('add-blacklist-btn')?.addEventListener('click', () => document.getElementById('blacklist-modal').classList.remove('hidden'));
  document.getElementById('blacklist-form')?.addEventListener('submit', handleBlacklistAdd);

  // Whitelist events
  document.getElementById('add-whitelist-btn')?.addEventListener('click', () => document.getElementById('whitelist-modal').classList.remove('hidden'));
  document.getElementById('whitelist-form')?.addEventListener('submit', handleWhitelistAdd);

  // Password form
  document.getElementById('password-form')?.addEventListener('submit', handlePasswordChange);

  // Visitor filter
  document.getElementById('filter-visitors-btn')?.addEventListener('click', () => { visitorPage = 1; loadVisitorList(); });

  // System settings
  document.getElementById('clearVisitorsBtn')?.addEventListener('click', handleClearVisitors);
  document.getElementById('clearStatsBtn')?.addEventListener('click', handleClearStats);
  document.getElementById('refreshIpBtn')?.addEventListener('click', loadCurrentIP);
  document.getElementById('addCurrentIpBtn')?.addEventListener('click', addCurrentIPToWhitelist);
}

// Sidebar functionality
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  
  // Load saved state
  const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }
  
  // Toggle button
  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    updateMainContentMargin();
  });
  
  // Nav group headers
  document.querySelectorAll('.nav-group-header').forEach(header => {
    header.addEventListener('click', () => {
      if (sidebar.classList.contains('collapsed')) return;
      
      const group = header.closest('.nav-group');
      group.classList.toggle('expanded');
      
      // Save expanded state
      const groupName = header.dataset.group;
      const expandedGroups = JSON.parse(localStorage.getItem('expanded_groups') || '{}');
      expandedGroups[groupName] = group.classList.contains('expanded');
      localStorage.setItem('expanded_groups', JSON.stringify(expandedGroups));
    });
  });
  
  // Restore expanded states
  const expandedGroups = JSON.parse(localStorage.getItem('expanded_groups') || '{}');
  Object.keys(expandedGroups).forEach(groupName => {
    if (expandedGroups[groupName]) {
      const header = document.querySelector(`.nav-group-header[data-group="${groupName}"]`);
      header?.closest('.nav-group')?.classList.add('expanded');
    }
  });
  
  updateMainContentMargin();
}

function updateMainContentMargin() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  if (sidebar && mainContent) {
    mainContent.style.marginLeft = sidebar.classList.contains('collapsed') ? '70px' : '250px';
  }
}

function generateSlugFromTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


// Auth
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${getApiBase()}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
      token = data.token;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      showAdmin();
      loadDashboard();
    } else {
      showError('login-error', data.error || 'Login failed');
    }
  } catch (err) {
    showError('login-error', 'Connection error');
  }
}

function handleLogout() {
  token = null;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  showLogin();
}

function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('admin-app').classList.add('hidden');
}

function showAdmin() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  
  const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
  document.getElementById('admin-username').textContent = user.username || 'Admin';
}

// Navigation
function navigateTo(page) {
  currentPage = page;
  
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  
  // Update nav group headers
  document.querySelectorAll('.nav-group-header').forEach(h => h.classList.remove('active'));
  const activeItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeItem) {
    const group = activeItem.closest('.nav-group');
    if (group) {
      group.querySelector('.nav-group-header')?.classList.add('active');
      group.classList.add('expanded');
    }
  }
  
  // Show page
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
    settings: 'System Settings',
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
    case 'settings': loadSystemSettings(); break;
    case 'blacklist': loadBlacklist(); break;
    case 'whitelist': loadWhitelist(); break;
  }
}

// API Helper
async function api(endpoint, options = {}) {
  const res = await fetch(`${getApiBase()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  
  if (res.status === 401) {
    handleLogout();
    throw new Error('Unauthorized');
  }
  
  return res.json();
}


// Dashboard
async function loadDashboard() {
  try {
    const data = await api('/dashboard');
    if (data.success) {
      const d = data.data;
      document.getElementById('today-pv').textContent = d.today.pv;
      document.getElementById('today-uv').textContent = d.today.uv;
      document.getElementById('today-ips').textContent = d.today.ips;
      document.getElementById('total-articles').textContent = d.total_articles;
      document.getElementById('published-articles').textContent = d.published_articles;
      document.getElementById('total-categories').textContent = d.total_categories;
      document.getElementById('blacklist-count').textContent = d.blacklist_count;

      // Render recent visitors
      const tbody = document.getElementById('recent-visitors');
      tbody.innerHTML = (d.recent_visitors || []).map(v => `
        <tr>
          <td>${v.ip}</td>
          <td>${v.page}</td>
          <td>${v.device || '-'}</td>
          <td>${v.browser || '-'}</td>
          <td>${formatDate(v.visit_time)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No data</td></tr>';

      // Render trend chart
      renderTrendChart(d.trends || []);
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function renderTrendChart(trends) {
  const ctx = document.getElementById('trend-chart');
  if (!ctx) return;

  if (trendChart) {
    trendChart.destroy();
  }

  const labels = trends.map(t => t.date);
  const pvData = trends.map(t => t.pv);
  const uvData = trends.map(t => t.uv);

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'PV',
          data: pvData,
          borderColor: '#00e676',
          backgroundColor: 'rgba(0, 230, 118, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'UV',
          data: uvData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8' }
        }
      },
      scales: {
        x: {
          grid: { color: '#2d3439' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: '#2d3439' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// Visitor Statistics Charts
let visitorTrendChart = null;
let hourlyChart = null;
let devicePieChart = null;
let browserPieChart = null;

async function loadVisitorStats() {
  try {
    const data = await api('/visitors/stats');
    if (data.success) {
      const d = data.data;
      
      // Summary cards - PV and UV from API (UV is unique IPs)
      document.getElementById('vs-today-pv').textContent = d.today.pv;
      document.getElementById('vs-today-uv').textContent = d.today.uv;
      document.getElementById('vs-today-new').textContent = d.today.new_visitors;
      
      // Period comparison
      document.getElementById('vs-yesterday-pv').textContent = d.yesterday.pv;
      document.getElementById('vs-yesterday-uv').textContent = d.yesterday.uv;
      document.getElementById('vs-7d-pv').textContent = d.last7days.pv;
      document.getElementById('vs-7d-uv').textContent = d.last7days.uv;
      document.getElementById('vs-30d-pv').textContent = d.last30days.pv;
      document.getElementById('vs-30d-uv').textContent = d.last30days.uv;
      
      // Compare with yesterday
      const pvDiff = d.today.pv - d.yesterday.pv;
      const uvDiff = d.today.uv - d.yesterday.uv;
      document.getElementById('vs-pv-compare').innerHTML = pvDiff >= 0 
        ? `<span style="color:var(--green);font-size:12px;"><i class="fa-solid fa-arrow-up"></i> +${pvDiff} vs yesterday</span>`
        : `<span style="color:var(--red);font-size:12px;"><i class="fa-solid fa-arrow-down"></i> ${pvDiff} vs yesterday</span>`;
      document.getElementById('vs-uv-compare').innerHTML = uvDiff >= 0
        ? `<span style="color:var(--green);font-size:12px;"><i class="fa-solid fa-arrow-up"></i> +${uvDiff} vs yesterday</span>`
        : `<span style="color:var(--red);font-size:12px;"><i class="fa-solid fa-arrow-down"></i> ${uvDiff} vs yesterday</span>`;

      // Trend Chart
      renderVisitorTrendChart(d.trend_stats || []);
      
      // Hourly Chart
      renderHourlyChart(d.hourly_stats || []);
      
      // Device Pie Chart
      renderDevicePieChart(d.device_stats || []);
      
      // Browser Pie Chart
      renderBrowserPieChart(d.browser_stats || []);
      
      // Country stats
      document.getElementById('country-stats').innerHTML = (d.country_stats || []).map(s => `
        <div class="stat-list-item">
          <span class="name"><i class="fa-solid fa-globe" style="margin-right:8px;color:var(--green);"></i>${s.country || 'Unknown'}</span>
          <span class="value">${s.uv} UV / ${s.pv} PV</span>
        </div>
      `).join('') || '<div style="color:var(--muted)">No data</div>';
      
      // Referrer stats
      document.getElementById('referrer-stats').innerHTML = (d.referrer_stats || []).map(s => `
        <div class="stat-list-item">
          <span class="name"><i class="fa-solid fa-link" style="margin-right:8px;color:var(--blue);"></i>${s.source}</span>
          <span class="value">${s.uv} UV / ${s.pv} PV</span>
        </div>
      `).join('') || '<div style="color:var(--muted)">No data</div>';

      // Top pages
      document.getElementById('top-pages').innerHTML = (d.top_pages || []).map(p => `
        <tr>
          <td>${p.page}</td>
          <td>${p.pv}</td>
          <td>${p.uv}</td>
        </tr>
      `).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">No data</td></tr>';
    }
  } catch (err) {
    console.error('Visitor stats error:', err);
  }
}


function renderVisitorTrendChart(trends) {
  const ctx = document.getElementById('visitor-trend-chart');
  if (!ctx) return;
  if (visitorTrendChart) visitorTrendChart.destroy();
  
  const labels = trends.map(t => t.date);
  const pvData = trends.map(t => t.pv);
  const uvData = trends.map(t => t.uv);
  
  visitorTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'PV', data: pvData, borderColor: '#00e676', backgroundColor: 'rgba(0,230,118,0.1)', fill: true, tension: 0.4 },
        { label: 'UV (Unique IPs)', data: uvData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { grid: { color: '#2d3439' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: '#2d3439' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function renderHourlyChart(hourlyData) {
  const ctx = document.getElementById('hourly-chart');
  if (!ctx) return;
  if (hourlyChart) hourlyChart.destroy();
  
  const hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  const uvByHour = {};
  hourlyData.forEach(h => { uvByHour[h.hour] = h.uv; });
  const uvData = hours.map(h => uvByHour[h] || 0);
  
  hourlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours.map(h => h + ':00'),
      datasets: [{ label: 'UV', data: uvData, backgroundColor: 'rgba(0,230,118,0.6)', borderColor: '#00e676', borderWidth: 1 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 0 } },
        y: { grid: { color: '#2d3439' }, ticks: { color: '#94a3b8' } }
      }
    }
  });
}

function renderDevicePieChart(deviceData) {
  const ctx = document.getElementById('device-pie-chart');
  if (!ctx) return;
  if (devicePieChart) devicePieChart.destroy();
  
  const labels = deviceData.map(d => d.device || 'Unknown');
  const data = deviceData.map(d => d.count);
  const colors = ['#00e676', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899'];
  
  devicePieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 15 } } }
    }
  });
}

function renderBrowserPieChart(browserData) {
  const ctx = document.getElementById('browser-pie-chart');
  if (!ctx) return;
  if (browserPieChart) browserPieChart.destroy();
  
  const labels = browserData.map(b => b.browser || 'Unknown');
  const data = browserData.map(b => b.count);
  const colors = ['#3b82f6', '#00e676', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6'];
  
  browserPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 15 } } }
    }
  });
}

// Visitor List
async function loadVisitorList() {
  try {
    const dateFilter = document.getElementById('visitor-date-filter')?.value || '';
    const data = await api(`/visitors/list?page=${visitorPage}&page_size=20&date=${dateFilter}`);
    
    if (data.success) {
      const { visitors, total, page, pageSize } = data.data;
      
      document.getElementById('visitor-list-body').innerHTML = (visitors || []).map(v => `
        <tr>
          <td>${v.ip}</td>
          <td>${v.page}</td>
          <td>${v.device || '-'}</td>
          <td>${v.os || '-'}</td>
          <td>${v.browser || '-'}</td>
          <td>${v.country || '-'}${v.city ? ', ' + v.city : ''}</td>
          <td>${formatDate(v.visit_time)}</td>
          <td>${v.duration ? v.duration + 's' : '-'}</td>
          <td>${v.page_view_count}</td>
        </tr>
      `).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No data</td></tr>';

      renderPagination('visitor-pagination', total, page, pageSize, (p) => {
        visitorPage = p;
        loadVisitorList();
      });
    }
  } catch (err) {
    console.error('Visitor list error:', err);
  }
}


// Articles
async function loadArticles() {
  try {
    const category = document.getElementById('article-category-filter')?.value || '';
    const status = document.getElementById('article-status-filter')?.value || '';
    const keyword = document.getElementById('article-search')?.value || '';
    
    const data = await api(`/articles?page=${articlePage}&page_size=20&category_id=${category}&status=${status}&keyword=${keyword}`);
    
    if (data.success) {
      const { articles, total, page, pageSize } = data.data;
      
      document.getElementById('articles-body').innerHTML = (articles || []).map(a => `
        <tr>
          <td><input type="checkbox" class="article-checkbox" value="${a.id}" /></td>
          <td>${a.title}</td>
          <td><code style="font-size:11px;color:var(--muted);">${a.slug || '-'}</code></td>
          <td>${a.category_name || '-'}</td>
          <td><span class="badge ${a.is_published ? 'published' : 'draft'}">${a.is_published ? 'Published' : 'Draft'}</span></td>
          <td>${a.view_count}</td>
          <td>${formatDate(a.created_at)}</td>
          <td class="actions">
            <button class="action-btn" onclick="editArticle(${a.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="action-btn delete" onclick="deleteArticle(${a.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">No articles</td></tr>';

      document.querySelectorAll('.article-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectedArticles);
      });

      renderPagination('articles-pagination', total, page, pageSize, (p) => {
        articlePage = p;
        loadArticles();
      });
    }
  } catch (err) {
    console.error('Articles error:', err);
  }
}

async function loadCategoryOptions() {
  try {
    const data = await api('/categories');
    if (data.success) {
      const options = '<option value="">Select Category</option>' + 
        (data.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      
      document.getElementById('article-category').innerHTML = options;
      document.getElementById('article-category-filter').innerHTML = '<option value="">All Categories</option>' + 
        (data.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  } catch (err) {
    console.error('Categories error:', err);
  }
}

function openArticleEditor() {
  editingArticleId = null;
  document.getElementById('article-title').value = '';
  document.getElementById('article-slug').value = '';
  document.getElementById('article-summary').value = '';
  document.getElementById('article-cover').value = '';
  document.getElementById('article-published').checked = false;
  document.getElementById('article-recommended').checked = false;
  document.getElementById('coverPreview').style.display = 'none';
  document.getElementById('coverPlaceholder').style.display = 'block';
  loadCategoryOptions();
  navigateTo('article-editor');
}

function closeArticleEditor() {
  if (editor) {
    editor.clear();
  }
  navigateTo('articles');
}

function initEditor() {
  if (editor) return;
  
  try {
    editor = new EditorJS({
      holder: 'editorjs',
      placeholder: 'Start writing your article content...',
      minHeight: 300,
      tools: {
        header: {
          class: Header,
          config: { levels: [2, 3, 4], defaultLevel: 2 }
        },
        list: { 
          class: List, 
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered'
          }
        },
        image: {
          class: ImageTool,
          config: {
            uploader: {
              uploadByFile(file) {
                const formData = new FormData();
                formData.append('file', file);
                return fetch(`${getApiBase()}/images/upload-article`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                  body: formData
                }).then(res => res.json()).then(data => {
                  if (data.success) {
                    return { success: 1, file: { url: data.data.file_url } };
                  }
                  return { success: 0, message: data.error || 'Upload failed' };
                }).catch(err => {
                  console.error('Image upload error:', err);
                  return { success: 0, message: 'Upload failed' };
                });
              }
            }
          }
        },
        quote: { 
          class: Quote, 
          inlineToolbar: true,
          config: {
            quotePlaceholder: 'Enter a quote',
            captionPlaceholder: 'Quote\'s author'
          }
        },
        code: {
          class: CodeTool,
          config: {
            placeholder: 'Enter code here...'
          }
        },
        delimiter: Delimiter,
        table: { 
          class: Table, 
          inlineToolbar: true,
          config: {
            rows: 2,
            cols: 3
          }
        }
      },
      onReady: () => {
        console.log('Editor.js is ready to work!');
      },
      onChange: (api, event) => {
        // Optional: Auto-save functionality could be added here
      }
    });
  } catch (error) {
    console.error('Failed to initialize Editor.js:', error);
    alert('Failed to initialize the editor. Please refresh the page and try again.');
  }
  
  setupCoverUpload();
}

function setupCoverUpload() {
  const coverUpload = document.getElementById('coverUpload');
  const coverPlaceholder = document.getElementById('coverPlaceholder');
  const coverRemove = document.getElementById('coverRemove');

  coverPlaceholder?.addEventListener('click', () => {
    coverUpload?.click();
  });

  coverPlaceholder?.addEventListener('dragover', (e) => {
    e.preventDefault();
    coverPlaceholder.classList.add('dragover');
  });

  coverPlaceholder?.addEventListener('dragleave', () => {
    coverPlaceholder.classList.remove('dragover');
  });

  coverPlaceholder?.addEventListener('drop', async (e) => {
    e.preventDefault();
    coverPlaceholder.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    await uploadCoverFile(file);
  });

  async function uploadCoverFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${getApiBase()}/images/upload-article`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        const fileUrl = data.data.file_url;
        // Build full URL for preview (relative path needs frontend domain)
        const frontendDomain = window.APP_CONFIG?.FRONTEND_DOMAIN || window.location.origin;
        const fullUrl = fileUrl.startsWith('http') ? fileUrl : frontendDomain + fileUrl;
        
        document.getElementById('article-cover').value = fileUrl;
        document.getElementById('coverPreviewImg').src = fullUrl;
        document.getElementById('coverPreview').style.display = 'block';
        document.getElementById('coverPlaceholder').style.display = 'none';
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Cover upload error:', err);
      alert('Upload failed: ' + err.message);
    }
  }
  
  coverUpload?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await uploadCoverFile(file);
  });
  
  coverRemove?.addEventListener('click', () => {
    document.getElementById('article-cover').value = '';
    document.getElementById('coverPreview').style.display = 'none';
    document.getElementById('coverPlaceholder').style.display = 'block';
  });
}


function editorDataToHtml(editorData) {
  let html = '';
  editorData.blocks.forEach(block => {
    switch (block.type) {
      case 'paragraph':
        html += `<p>${block.data.text}</p>`;
        break;
      case 'header':
        html += `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
        break;
      case 'list':
        const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
        html += `<${listTag}>`;
        block.data.items.forEach(item => { html += `<li>${item}</li>`; });
        html += `</${listTag}>`;
        break;
      case 'quote':
        html += `<blockquote><p>${block.data.text}</p>`;
        if (block.data.caption) html += `<cite>${block.data.caption}</cite>`;
        html += `</blockquote>`;
        break;
      case 'code':
        html += `<pre><code>${block.data.code}</code></pre>`;
        break;
      case 'delimiter':
        html += `<hr>`;
        break;
      case 'image':
        html += `<figure><img src="${block.data.file.url}" alt="${block.data.caption || ''}" />`;
        if (block.data.caption) html += `<figcaption>${block.data.caption}</figcaption>`;
        html += `</figure>`;
        break;
      case 'table':
        html += '<table>';
        block.data.content.forEach((row, i) => {
          html += '<tr>';
          row.forEach(cell => {
            const cellTag = block.data.withHeadings && i === 0 ? 'th' : 'td';
            html += `<${cellTag}>${cell}</${cellTag}>`;
          });
          html += '</tr>';
        });
        html += '</table>';
        break;
    }
  });
  return html;
}

async function editArticle(id) {
  try {
    const data = await api(`/articles/${id}`);
    if (data.success) {
      editingArticleId = id;
      const a = data.data;
      loadCategoryOptions();
      navigateTo('article-editor');
      
      setTimeout(() => {
        document.getElementById('article-title').value = a.title;
        document.getElementById('article-slug').value = a.slug || '';
        document.getElementById('article-summary').value = a.summary || '';
        document.getElementById('article-category').value = a.category_id || '';
        document.getElementById('article-published').checked = a.is_published;
        document.getElementById('article-recommended').checked = a.is_recommended;
        
        if (a.cover_image) {
          document.getElementById('article-cover').value = a.cover_image;
          document.getElementById('coverPreviewImg').src = a.cover_image;
          document.getElementById('coverPreview').style.display = 'block';
          document.getElementById('coverPlaceholder').style.display = 'none';
        }
        
        if (a.content_json && editor) {
          try {
            const contentData = JSON.parse(a.content_json);
            // Validate and clean the data before rendering
            if (contentData && contentData.blocks && Array.isArray(contentData.blocks)) {
              // Filter out invalid blocks
              const validBlocks = contentData.blocks.filter(block => {
                return block && 
                       typeof block.type === 'string' && 
                       block.data && 
                       typeof block.data === 'object';
              });
              
              // Only render if we have valid blocks
              if (validBlocks.length > 0) {
                editor.render({
                  time: contentData.time || Date.now(),
                  blocks: validBlocks,
                  version: contentData.version || "2.29.0"
                });
              }
            }
          } catch (e) {
            console.log('Could not load editor content:', e);
            // If JSON is invalid, try to load as plain text
            if (a.content) {
              editor.render({
                time: Date.now(),
                blocks: [{
                  type: "paragraph",
                  data: {
                    text: a.content.replace(/<[^>]*>/g, '') // Strip HTML tags
                  }
                }],
                version: "2.29.0"
              });
            }
          }
        }
      }, 100);
    }
  } catch (err) {
    console.error('Edit article error:', err);
  }
}

async function handleArticleSave() {
  const title = document.getElementById('article-title').value;
  const slug = document.getElementById('article-slug').value.trim();
  
  if (!title.trim()) {
    alert('Please enter a title');
    return;
  }
  
  if (!slug) {
    alert('Please enter a slug (URL identifier)');
    document.getElementById('article-slug').focus();
    return;
  }
  
  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    alert('Slug can only contain lowercase letters, numbers, and hyphens');
    document.getElementById('article-slug').focus();
    return;
  }
  
  let content = '';
  let contentJson = '';
  
  if (editor) {
    try {
      const editorData = await editor.save();
      // Validate the editor data before saving
      if (editorData && editorData.blocks && Array.isArray(editorData.blocks)) {
        // Filter out any invalid blocks
        const validBlocks = editorData.blocks.filter(block => {
          return block && 
                 typeof block.type === 'string' && 
                 block.data && 
                 typeof block.data === 'object';
        });
        
        const cleanedData = {
          time: editorData.time || Date.now(),
          blocks: validBlocks,
          version: editorData.version || "2.29.0"
        };
        
        contentJson = JSON.stringify(cleanedData);
        content = editorDataToHtml(cleanedData);
      }
    } catch (e) {
      console.error('Editor save error:', e);
      alert('Error saving editor content. Please try again.');
      return;
    }
  }
  
  const payload = {
    title: title,
    slug: slug,
    category_id: document.getElementById('article-category').value ? parseInt(document.getElementById('article-category').value) : null,
    cover_image: document.getElementById('article-cover').value,
    summary: document.getElementById('article-summary').value,
    content: content,
    content_json: contentJson,
    is_published: document.getElementById('article-published').checked,
    is_recommended: document.getElementById('article-recommended').checked
  };

  try {
    const endpoint = editingArticleId ? `/articles/${editingArticleId}` : '/articles';
    const method = editingArticleId ? 'PUT' : 'POST';
    
    const data = await api(endpoint, { method, body: JSON.stringify(payload) });
    if (data.success) {
      closeArticleEditor();
    } else {
      alert(data.error || 'Save failed');
    }
  } catch (err) {
    console.error('Save article error:', err);
  }
}

async function deleteArticle(id) {
  if (!confirm('Are you sure you want to delete this article?')) return;
  
  try {
    const data = await api(`/articles/${id}`, { method: 'DELETE' });
    if (data.success) {
      loadArticles();
    }
  } catch (err) {
    console.error('Delete article error:', err);
  }
}

function toggleSelectAllArticles(e) {
  const checked = e.target.checked;
  document.querySelectorAll('.article-checkbox').forEach(cb => cb.checked = checked);
  updateSelectedArticles();
}

function updateSelectedArticles() {
  selectedArticleIds = Array.from(document.querySelectorAll('.article-checkbox:checked')).map(cb => parseInt(cb.value));
  document.getElementById('batch-delete-btn').classList.toggle('hidden', selectedArticleIds.length === 0);
}

async function handleBatchDeleteArticles() {
  if (selectedArticleIds.length === 0) return;
  if (!confirm(`Delete ${selectedArticleIds.length} articles?`)) return;
  
  try {
    const data = await api('/articles/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedArticleIds })
    });
    if (data.success) {
      selectedArticleIds = [];
      loadArticles();
    }
  } catch (err) {
    console.error('Batch delete error:', err);
  }
}


// Categories
async function loadCategories() {
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
            <button class="action-btn" onclick="editCategory(${c.id}, '${escapeHtml(c.name)}', '${escapeHtml(c.description || '')}', ${c.sort_order}, ${c.is_enabled})"><i class="fa-solid fa-edit"></i></button>
            <button class="action-btn delete" onclick="deleteCategory(${c.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">No categories</td></tr>';
    }
  } catch (err) {
    console.error('Categories error:', err);
  }
}

let editingCategoryId = null;

function openNewCategoryModal() {
  editingCategoryId = null;
  document.getElementById('category-modal-title').textContent = 'New Category';
  document.getElementById('category-form').reset();
  document.getElementById('category-enabled').checked = true;
  document.getElementById('category-modal').classList.remove('hidden');
}

function editCategory(id, name, desc, order, enabled) {
  editingCategoryId = id;
  document.getElementById('category-modal-title').textContent = 'Edit Category';
  document.getElementById('category-name').value = name;
  document.getElementById('category-description').value = desc;
  document.getElementById('category-order').value = order;
  document.getElementById('category-enabled').checked = enabled;
  document.getElementById('category-modal').classList.remove('hidden');
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.add('hidden');
}

async function handleCategorySave(e) {
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
    if (data.success) {
      closeCategoryModal();
      loadCategories();
    } else {
      alert(data.error || 'Save failed');
    }
  } catch (err) {
    console.error('Save category error:', err);
  }
}

async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  
  try {
    const data = await api(`/categories/${id}`, { method: 'DELETE' });
    if (data.success) {
      loadCategories();
    } else {
      alert(data.error || 'Delete failed');
    }
  } catch (err) {
    console.error('Delete category error:', err);
  }
}

// System Settings
async function loadSystemSettings() {
  try {
    const data = await api('/system/info');
    if (data.success) {
      const info = data.data;
      document.getElementById('sys-total-visitors').textContent = info.total_visitors || 0;
      document.getElementById('sys-total-articles').textContent = info.total_articles || 0;
      document.getElementById('sys-total-images').textContent = info.total_images || 0;
      document.getElementById('sys-db-size').textContent = info.db_size || '-';
    }
  } catch (err) {
    console.error('System info error:', err);
  }
  
  // Load current IP
  loadCurrentIP();
  
  // Load blacklist and whitelist counts
  loadIPCounts();
}

async function loadCurrentIP() {
  try {
    const data = await api('/system/client-ip');
    if (data.success) {
      document.getElementById('current-ip').textContent = data.client_ip;
    }
  } catch (err) {
    console.error('Load IP error:', err);
    document.getElementById('current-ip').textContent = 'Error loading IP';
  }
}

async function loadIPCounts() {
  try {
    // Load blacklist count
    const blacklistData = await api('/blacklist');
    if (blacklistData.success) {
      document.getElementById('sys-blacklist-count').textContent = blacklistData.data.length;
    }
    
    // Load whitelist count
    const whitelistData = await api('/whitelist');
    if (whitelistData.success) {
      document.getElementById('sys-whitelist-count').textContent = whitelistData.data.length;
    }
  } catch (err) {
    console.error('Load IP counts error:', err);
  }
}

async function addCurrentIPToWhitelist() {
  const currentIP = document.getElementById('current-ip').textContent;
  if (!currentIP || currentIP === 'Loading...' || currentIP === 'Error loading IP') {
    alert('Please refresh IP first');
    return;
  }
  
  if (!confirm(`Add IP ${currentIP} to whitelist?`)) return;
  
  try {
    const data = await api('/whitelist', {
      method: 'POST',
      body: JSON.stringify({
        ip_address: currentIP,
        description: 'Admin IP - Added from system settings'
      })
    });
    
    if (data.success) {
      alert('IP added to whitelist successfully');
      loadIPCounts();
    } else {
      alert(data.error || 'Failed to add IP to whitelist');
    }
  } catch (err) {
    console.error('Add IP to whitelist error:', err);
    alert('Failed to add IP to whitelist');
  }
}

async function handleClearVisitors() {
  if (!confirm('Are you sure you want to delete ALL visitor records? This action cannot be undone!')) return;
  if (!confirm('This will permanently delete all visitor logs and statistics. Continue?')) return;
  
  try {
    const data = await api('/system/clear-visitors', { method: 'POST' });
    if (data.success) {
      alert('All visitor records have been cleared.');
      loadSystemSettings();
    } else {
      alert(data.error || 'Failed to clear visitors');
    }
  } catch (err) {
    console.error('Clear visitors error:', err);
    alert('Failed to clear visitors');
  }
}

async function handleClearStats() {
  if (!confirm('Are you sure you want to clear all daily statistics?')) return;
  
  try {
    const data = await api('/system/clear-stats', { method: 'POST' });
    if (data.success) {
      alert('Daily statistics have been cleared.');
      loadSystemSettings();
    } else {
      alert(data.error || 'Failed to clear statistics');
    }
  } catch (err) {
    console.error('Clear stats error:', err);
    alert('Failed to clear statistics');
  }
}


// Blacklist
async function loadBlacklist() {
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
            <button class="action-btn delete" onclick="removeFromBlacklist(${b.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No entries</td></tr>';
    }
  } catch (err) {
    console.error('Blacklist error:', err);
  }
}

function closeBlacklistModal() {
  document.getElementById('blacklist-modal').classList.add('hidden');
}

async function handleBlacklistAdd(e) {
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
    } else {
      alert(data.error || 'Add failed');
    }
  } catch (err) {
    console.error('Add blacklist error:', err);
  }
}

async function removeFromBlacklist(id) {
  if (!confirm('Remove this IP from blacklist?')) return;
  
  try {
    const data = await api(`/blacklist/${id}`, { method: 'DELETE' });
    if (data.success) {
      loadBlacklist();
    }
  } catch (err) {
    console.error('Remove blacklist error:', err);
  }
}

// Whitelist
async function loadWhitelist() {
  try {
    const data = await api('/whitelist');
    if (data.success) {
      document.getElementById('whitelist-body').innerHTML = (data.data || []).map(w => `
        <tr>
          <td>${w.ip_address}</td>
          <td>${w.description || '-'}</td>
          <td>${formatDate(w.created_at)}</td>
          <td class="actions">
            <button class="action-btn delete" onclick="removeFromWhitelist(${w.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">No entries</td></tr>';
    }
  } catch (err) {
    console.error('Whitelist error:', err);
  }
}

function closeWhitelistModal() {
  document.getElementById('whitelist-modal').classList.add('hidden');
}

async function handleWhitelistAdd(e) {
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
    } else {
      alert(data.error || 'Add failed');
    }
  } catch (err) {
    console.error('Add whitelist error:', err);
  }
}

async function removeFromWhitelist(id) {
  if (!confirm('Remove this IP from whitelist?')) return;
  
  try {
    const data = await api(`/whitelist/${id}`, { method: 'DELETE' });
    if (data.success) {
      loadWhitelist();
    }
  } catch (err) {
    console.error('Remove whitelist error:', err);
  }
}

// Password
async function handlePasswordChange(e) {
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


// Utilities
function formatDate(dateStr) {
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

function showError(elemId, msg) {
  const elem = document.getElementById(elemId);
  elem.textContent = msg;
  elem.classList.remove('hidden');
}

function showMsg(elemId, msg, type) {
  const elem = document.getElementById(elemId);
  elem.textContent = msg;
  elem.className = `msg ${type}`;
  elem.classList.remove('hidden');
}

function escapeHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ========== Image Management ==========
async function loadImageStats() {
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

async function loadImages() {
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
              <button class="action-btn" onclick="copyImageUrl('${img.file_url}')" title="Copy Relative Path"><i class="fa-solid fa-copy"></i></button>
              <button class="action-btn" onclick="previewImage('${fullUrl}')" title="Preview"><i class="fa-solid fa-eye"></i></button>
              <button class="action-btn" onclick="toggleImageUsed(${img.id}, ${img.is_used})" title="${img.is_used ? 'Mark Unused' : 'Mark Used'}">
                <i class="fa-solid fa-${img.is_used ? 'times-circle' : 'check-circle'}"></i>
              </button>
              <button class="action-btn delete" onclick="deleteImage(${img.id})" title="Delete"><i class="fa-solid fa-trash"></i></button>
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

function saveFrontendDomain() {
  const domain = document.getElementById('frontendDomain').value.trim();
  if (domain) {
    localStorage.setItem('frontend_domain', domain.replace(/\/$/, ''));
    alert('Frontend URL saved!');
    loadImages();
  }
}

function loadFrontendDomain() {
  const saved = getFrontendDomain();
  const input = document.getElementById('frontendDomain');
  if (input) input.value = saved;
}

function previewImage(url) {
  window.open(url, '_blank');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function copyImageUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('URL copied to clipboard');
  });
}

async function toggleImageUsed(id, currentState) {
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

async function deleteImage(id) {
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


// Setup image page events
document.addEventListener('DOMContentLoaded', () => {
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      imageFilter = tab.dataset.filter;
      imagePage = 1;
      loadImages();
    });
  });
  
  // Image upload
  const imageDropzone = document.getElementById('imageDropzone');
  const imageFileInput = document.getElementById('imageFileInput');
  
  imageDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropzone.classList.add('dragover');
  });
  
  imageDropzone?.addEventListener('dragleave', () => {
    imageDropzone.classList.remove('dragover');
  });
  
  imageDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropzone.classList.remove('dragover');
    handleImageUpload(e.dataTransfer.files);
  });
  
  imageFileInput?.addEventListener('change', (e) => {
    handleImageUpload(e.target.files);
  });
  
  // Export template
  document.getElementById('exportTemplateBtn')?.addEventListener('click', exportArticleTemplate);
  
  // Import articles
  document.getElementById('importArticlesBtn')?.addEventListener('click', () => {
    document.getElementById('import-modal').classList.remove('hidden');
  });
  
  document.getElementById('importFileInput')?.addEventListener('change', handleArticleImport);
});

async function handleImageUpload(files) {
  if (!files || files.length === 0) return;
  
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${getApiBase()}/images/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        console.error('Upload failed:', data.error);
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
  }
  
  loadImages();
  loadImageStats();
}

function exportArticleTemplate() {
  // Call backend API to download Excel template
  const url = `${getApiBase()}/articles/export-template`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `article-template-${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Add authorization header by opening in new window with token
  fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(response => response.blob())
  .then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `article-template-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  })
  .catch(err => {
    console.error('Export template error:', err);
    alert('Failed to export template');
  });
}

async function handleArticleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  document.getElementById('importProgress').classList.remove('hidden');
  document.getElementById('importResult').classList.add('hidden');
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch(`${getApiBase()}/articles/import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    
    document.getElementById('importProgress').classList.add('hidden');
    const resultEl = document.getElementById('importResult');
    resultEl.classList.remove('hidden');
    
    if (data.success) {
      resultEl.className = 'import-result success';
      resultEl.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${data.message || 'Import successful'}`;
    } else {
      resultEl.className = 'import-result error';
      resultEl.innerHTML = `<i class="fa-solid fa-times-circle"></i> ${data.message || 'Import failed'}`;
    }
  } catch (err) {
    document.getElementById('importProgress').classList.add('hidden');
    const resultEl = document.getElementById('importResult');
    resultEl.classList.remove('hidden');
    resultEl.className = 'import-result error';
    resultEl.innerHTML = '<i class="fa-solid fa-times-circle"></i> Connection error';
  }
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  document.getElementById('importProgress').classList.add('hidden');
  document.getElementById('importResult').classList.add('hidden');
  document.getElementById('importFileInput').value = '';
}

function renderPagination(containerId, total, page, pageSize, onClick) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${page === 1 ? 'disabled' : ''} onclick="arguments[0].stopPropagation()">Prev</button>`;
  
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="${i === page ? 'active' : ''}">${i}</button>`;
  }
  
  if (totalPages > 5) {
    html += `<button disabled>...</button>`;
    html += `<button class="${totalPages === page ? 'active' : ''}">${totalPages}</button>`;
  }
  
  html += `<button ${page === totalPages ? 'disabled' : ''}>Next</button>`;
  
  container.innerHTML = html;
  
  container.querySelectorAll('button').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const text = btn.textContent;
      if (text === 'Prev' && page > 1) onClick(page - 1);
      else if (text === 'Next' && page < totalPages) onClick(page + 1);
      else if (!isNaN(parseInt(text))) onClick(parseInt(text));
    });
  });
}
