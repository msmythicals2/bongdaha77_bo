// Visitors Module
import { api } from './api.js';
import { formatDate, renderPagination } from './utils.js';

let visitorPage = 1;
let visitorTrendChart = null;
let hourlyChart = null;
let devicePieChart = null;
let browserPieChart = null;

export async function loadVisitorStats() {
  try {
    const data = await api('/visitors/stats');
    if (data.success) {
      const d = data.data;
      
      // Summary cards
      document.getElementById('vs-today-pv').textContent = d.today.pv;
      document.getElementById('vs-today-uv').textContent = d.today.uv;
      document.getElementById('vs-today-new').textContent = d.today.new_visitors;
      // document.getElementById('vs-realtime').textContent = d.realtime_online; // 暂时隐藏
      
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

      // Render charts
      renderVisitorTrendChart(d.trend_stats || []);
      renderHourlyChart(d.hourly_stats || []);
      renderDevicePieChart(d.device_stats || []);
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
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 0 }] },
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
    data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, data.length), borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#94a3b8', padding: 15 } } }
    }
  });
}

export async function loadVisitorList() {
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

export function setVisitorPage(p) {
  visitorPage = p;
}
