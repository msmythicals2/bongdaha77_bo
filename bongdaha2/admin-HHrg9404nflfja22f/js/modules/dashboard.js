// Dashboard Module
import { api } from './api.js';
import { formatDate } from './utils.js';

let trendChart = null;

export async function loadDashboard() {
  try {
    const data = await api('/dashboard');
    if (data.success) {
      const d = data.data;
      document.getElementById('today-pv').textContent = d.today.pv;
      document.getElementById('today-uv').textContent = d.today.uv;
      document.getElementById('today-ips').textContent = d.today.ips;
      // document.getElementById('realtime-online').textContent = d.realtime_online; // 暂时隐藏
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
