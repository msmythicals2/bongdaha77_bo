// ==========================================
// BONGDAHA - main.js (FINAL INTEGRATED VERSION)
// ==========================================

// Load header and footer components
async function loadComponents() {
  try {
    const [headerRes, footerRes] = await Promise.all([
      fetch('/components/header.html'),
      fetch('/components/footer.html')
    ]);
    
    const headerHTML = await headerRes.text();
    const footerHTML = await footerRes.text();
    
    document.getElementById('header-placeholder').innerHTML = headerHTML;
    document.getElementById('footer-placeholder').innerHTML = footerHTML;
    
    // Start clock after header is loaded
    updateClock();
    setInterval(updateClock, 1000);
    
    // Load categories after components are loaded
    await loadNavCategories();
  } catch (err) {
    console.error('Failed to load components:', err);
  }
}

// Initialize components first
loadComponents();

const state = {
  tab: "all",
  date: new Date(),
  favorites: new Set(JSON.parse(localStorage.getItem("favMatches") || "[]")),
  collapsedLeagues: new Set(), // 新增：用于存储被折叠的联赛 ID
  carouselIndex: 0,
  lastFixtures: [],
  lastLive: [],
  selectedLeagueId: null,
};
let __REFRESHING__ = false;
const __CACHE__ = new Map(); // key -> { t, data }
const CACHE_TTL = 60 * 1000; // 60秒

// 1. 定义 COMPETITIONS 固定联赛数据
const COMPETITION_DATA = [
  { id: 39, name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { id: 140, name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { id: 135, name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { id: 78, name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { id: 61, name: "Ligue 1", country: "France", logo: "https://media.api-sports.io/football/leagues/61.png" },
  { id: 271, name: "V.League 1", country: "Vietnam", logo: "https://media.api-sports.io/football/leagues/271.png" },
  { id: 88, name: "Eredivisie", country: "Netherlands", logo: "https://media.api-sports.io/football/leagues/88.png" },
  { id: 203, name: "Süper Lig", country: "Turkiye", logo: "https://media.api-sports.io/football/leagues/203.png" },
  { id: 40, name: "Championship", country: "England", logo: "https://media.api-sports.io/football/leagues/40.png" },
  { id: 2, name: "Champions League", country: "UEFA", logo: "https://media.api-sports.io/football/leagues/2.png" },
  { id: 3, name: "Europa League", country: "UEFA", logo: "https://media.api-sports.io/football/leagues/3.png" },
  { id: 848, name: "Conference League", country: "UEFA", logo: "https://media.api-sports.io/football/leagues/848.png" },
  { id: 94, name: "Primeira Liga", country: "Portugal", logo: "https://media.api-sports.io/football/leagues/94.png" },
  { id: 179, name: "Premiership", country: "Scotland", logo: "https://media.api-sports.io/football/leagues/179.png" },
  { id: 144, name: "Belgian Pro League", country: "Belgium", logo: "https://media.api-sports.io/football/leagues/144.png" },
  { id: 1, name: "World Cup 2026", country: "International", logo: "https://media.api-sports.io/football/leagues/1.png" }
];

// ---------- Helpers ----------

// === 基础格式化 ===
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYMD(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function formatHHMM(dateStr) {
  const d = new Date(dateStr);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// === 比赛状态判断 ===
function isFinished(status) {
  // 增加 ABD(中断), AWD(判决), CANC(取消)
  return ["FT", "AET", "PEN", "ABD", "AWD", "CANC"].includes(status);
}

function isLiveStatus(status) {
  // 保持不变，这是标准的滚球状态
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(status);
}

function isScheduled(status) {
  // 增加 PST(推迟)，确保未赛的都能显示
  return ["NS", "TBD", "PST"].includes(status);
}

// === 安全输出 ===
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractMatch(result) {
  return result?.response?.[0] || null;
}

// ================================
// League Page - Show / Hide Logic
// ================================

// 进入详情页
function showLeaguePage() {
    const mainList = document.getElementById("fixtures-container");
    const leaguePage = document.getElementById("league-page");
    const dateRow = document.querySelector(".date-row");
    const tabsNav = document.querySelector(".tabs-nav");

    if (mainList) mainList.classList.add("hidden");
    if (dateRow) dateRow.classList.add("hidden");
    if (tabsNav) tabsNav.classList.add("hidden");
    
    if (leaguePage) {
        leaguePage.classList.remove("hidden");
        window.scrollTo(0, 0); // 切换时回到顶部
    }
}

function hideLeaguePage() {
    const mainList = document.getElementById("fixtures-container");
    const leaguePage = document.getElementById("league-page");
    const dateRow = document.querySelector(".date-row");
    const tabsNav = document.querySelector(".tabs-nav");

    if (leaguePage) leaguePage.classList.add("hidden");
    
    if (mainList) mainList.classList.remove("hidden");
    if (dateRow) dateRow.classList.remove("hidden");
    if (tabsNav) tabsNav.classList.remove("hidden");
    
    state.selectedLeagueId = null;
}

function loadLeaguePage(leagueId) {
  console.log("Loading League ID:", leagueId, typeof leagueId);
  if (!leagueId) return;

  const targetId = Number(leagueId);
  const league = COMPETITION_DATA.find(l => l.id === targetId);

  if (!league) {
    console.error("League not found in COMPETITION_DATA:", targetId);
    hideLeaguePage(); 
    return;
  }

  // --- 【关键修改】显示 League Page 容器，隐藏主列表 ---
  const leaguePage = document.getElementById("league-page");

  // 2️⃣ 填充 Header (匹配你的 HTML 结构)
  const logoEl = document.querySelector("#league-page .league-logo-lg");
  const nameEl = document.querySelector("#league-page .league-name");
  const countryEl = document.querySelector("#league-page .league-country");
  const seasonEl = document.querySelector("#league-page .league-season");

  if (logoEl) logoEl.src = league.logo || "";
  if (nameEl) nameEl.textContent = league.name || "";
  if (countryEl) countryEl.textContent = league.country || "";
  if (seasonEl) seasonEl.textContent = league.season || "2025 / 2026";

  // 3️⃣ 默认切换 Tab 状态
  document.querySelectorAll(".league-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === "summary")
  );
  document.querySelectorAll(".league-panel").forEach(p =>
    p.classList.toggle("active", p.id === "league-summary")
  );

  // 4️⃣ 绑定事件与渲染内容
  setupLeagueTabs();
  
  // 确保这个函数存在，否则会报错导致黑屏
  if (typeof renderLeagueSummary === "function") {
      renderLeagueSummary(targetId);
  }
}

function renderLeagueSummary(leagueId) {
  const container = document.getElementById("summary-content");
  if (!container) return;

  const leagueMatches = Array.from(
    new Map(
      [...state.lastFixtures, ...state.lastLive]
        .filter(f => f.league.id === leagueId)
        .map(f => [f.fixture.id, f])
    ).values()
  );

  leagueMatches.sort(
    (a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)
  );

  if (leagueMatches.length === 0) {
    container.innerHTML = `
      <div class="p-10 text-center text-gray-500">
        No matches available for this league.
      </div>`;
    return;
  }

  const finished = leagueMatches.filter(m =>
    isFinished(m.fixture.status.short)
  );
  const upcoming = leagueMatches.filter(m =>
    isScheduled(m.fixture.status.short)
  );

  const renderBlock = (title, list) => `
    <div class="mb-6">
      <div class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 border-l-2 border-[#00e676] pl-2">
        ${title}
      </div>
      ${list.map(m => `
        <div class="league-match-row mb-1">
          <div class="match-left">
            <span class="match-time text-gray-500">
              ${formatHHMM(m.fixture.date)}
            </span>
            <span class="match-home font-medium">
              ${escapeHtml(m.teams.home.name)}
            </span>
          </div>
          <div class="match-center font-bold text-[#00e676]">
            ${isFinished(m.fixture.status.short)
              ? `${m.goals.home} : ${m.goals.away}`
              : '-'}
          </div>
          <div class="match-right">
            <span class="match-away font-medium">
              ${escapeHtml(m.teams.away.name)}
            </span>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  container.innerHTML = `
    ${finished.length ? renderBlock('Recent Results', finished) : ''}
    ${upcoming.length ? renderBlock('Upcoming Matches', upcoming) : ''}
    ${(!finished.length && !upcoming.length)
      ? '<div class="p-10 text-center text-gray-500">No data available</div>'
      : ''}
  `;
}


// ---------- API ----------
async function apiGetJSON(url) {
  try {
    const r = await fetch(url);

    if (!r.ok) {
      console.error("API failed:", url, r.status);
      return null;
    }

    return await r.json();
  } catch (err) {
    console.error("Fetch error:", url, err);
    return null;
  }
}

async function loadFixturesByDateCached(d) {
  const key = `fx:${toYMD(d)}`;
  const now = Date.now();

  const hit = __CACHE__.get(key);
  if (hit && now - hit.t < CACHE_TTL) return hit.data;

  const data = await apiGetJSON(`/api/fixtures?date=${toYMD(d)}`);
  __CACHE__.set(key, { t: now, data: data || [] });
  return data || [];
}

const loadLive = () => apiGetJSON(`/api/live`);
// Load news from database API (latest 5 published articles)
const loadNews = async () => {
  try {
    await window.CONFIG_READY;
    const apiBase = window.APP_CONFIG?.adminApiUrl || 'http://localhost:8080';
    const res = await fetch(`${apiBase}/api/public/articles?page=1&page_size=5`);
    const data = await res.json();
    if (data.success) return data.data;
    return [];
  } catch (err) {
    console.error('Load news error:', err);
    return [];
  }
};

// ---------- Clock ----------
function updateClock() {
  const n = new Date();
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = `${pad2(n.getDate())}/${pad2(n.getMonth()+1)}/${n.getFullYear()} ${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
}

// ---------- Date strip ----------
function renderDateStrip() {
  const strip = document.getElementById("date-strip");
  if (!strip) return;
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const todayYMD = toYMD(new Date());
  const base = new Date(state.date);
  const baseYMD = toYMD(base);
  let html = "";
  for (let i = -2; i <= 2; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const ymd = toYMD(d);
    const label = ymd === todayYMD ? "TODAY" : days[d.getDay()];
    html += `<div class="date-chip ${ymd===baseYMD?"active":""}" data-ymd="${ymd}">
        <div class="d1">${pad2(d.getDate())}/${pad2(d.getMonth()+1)}</div>
        <div class="d2">${label}</div>
      </div>`;
  }
  strip.innerHTML = html;
  const dp = document.getElementById("datePicker");
  if (dp) dp.value = baseYMD;
}

function renderCompetitions() {
  const topContainer = document.getElementById('top-competitions');
  const allContainer = document.getElementById('all-competitions');
  if (!topContainer || !allContainer) return;
  const createItem = (c) => `
    <li class="flex items-center gap-3 p-2 hover:bg-[#252b31] rounded-md cursor-pointer group transition-colors ${state.selectedLeagueId === c.id ? 'bg-[#252b31]' : ''}" 
        data-action="filter-league" data-league-id="${c.id}">
        <img src="${c.logo}" class="league-logo-sm">
        <div class="flex flex-col min-w-0">
            <span class="text-[12px] font-bold text-gray-200 group-hover:text-[#00e676] truncate">${escapeHtml(c.name)}</span>
            <span class="text-[10px] text-gray-500">${escapeHtml(c.country)}</span>
        </div>
    </li>`;
  topContainer.innerHTML = COMPETITION_DATA.slice(0, 6).map(createItem).join('');
  allContainer.innerHTML = COMPETITION_DATA.slice(6).map(createItem).join('');
}

function renderLeftSidebar(fixtures) {
  const countryList = document.getElementById("countries-list");
  const pinnedList = document.getElementById("pinned-leagues");
  if (!fixtures) return;
  const leaguesMap = new Map();
  fixtures.forEach(f => {
    if (!leaguesMap.has(f.league.id)) leaguesMap.set(f.league.id, f.league);
  });
  if (countryList) {
    let cHtml = "";
    leaguesMap.forEach(l => {
      const activeCls = state.selectedLeagueId === l.id ? "bg-[#252b31] border-l-2 border-[#00e676]" : "";
      cHtml += `<div class="flex items-center gap-3 p-2 hover:bg-[#252b31] rounded-sm cursor-pointer group ${activeCls}" data-action="filter-league" data-league-id="${l.id}">
          <img src="${l.flag || l.logo}" class="w-4 h-3 object-cover rounded-[1px] opacity-80 group-hover:opacity-100">
          <span class="text-[11px] font-medium text-gray-400 group-hover:text-[#00e676] truncate">${escapeHtml(l.name)}</span>
        </div>`;
    });
    countryList.innerHTML = cHtml || '<div class="text-[10px] text-gray-600 p-2">No leagues</div>';
  }
  if (pinnedList) {
    const pinnedMap = new Map();
    fixtures.forEach(f => {
      if (state.favorites.has(f.fixture.id) && !pinnedMap.has(f.league.id)) pinnedMap.set(f.league.id, f.league);
    });
    let pHtml = "";
    pinnedMap.forEach(l => {
      pHtml += `<li class="flex items-center gap-3 p-2 hover:bg-[#252b31] rounded-sm cursor-pointer group" data-action="filter-league" data-league-id="${l.id}">
          <i class="fa-solid fa-thumbtack text-[10px] text-[#00e676]"></i>
          <span class="text-[11px] text-gray-300 group-hover:text-white truncate">${escapeHtml(l.name)}</span>
        </li>`;
    });
    pinnedList.innerHTML = pHtml || '<div class="text-[10px] text-gray-700 px-2 italic">No pinned items</div>';
  }
}

// ---------- Fixtures ----------
function applyTabFilter(all, live) {
    // 1. 合并所有数据并去重（fixture.id 唯一）
    // 这样确保 ALL 标签下既有已经结束的，也有正在滚球的
    const mergedMap = new Map();
    [...all, ...live].forEach(f => mergedMap.set(f.fixture.id, f));
    const dayMatches = Array.from(mergedMap.values());

    // 2. 根据 Tab 逻辑过滤
    switch (state.tab) {
        case "live":
            // 仅显示正在滚球的
            return live;

        case "finished":
            // 仅显示已结束的 (判断 FT, AET, PEN)
            return dayMatches.filter(f => isFinished(f.fixture.status.short));

        case "scheduled":
            // 仅显示未开赛的 (判断 NS, TBD)
            return dayMatches.filter(f => isScheduled(f.fixture.status.short));

        case "favorite":
            return dayMatches.filter(f => state.favorites.has(f.fixture.id))
                             .sort((a, b) => Number(isLiveStatus(b.fixture.status.short)) - Number(isLiveStatus(a.fixture.status.short)));

        case "all":
        default:
            // 显示当天所有：已结束 + 滚球 + 未开赛
            // 排序：滚球中的排最上面，其余按时间排
            return dayMatches.sort((a, b) => {
                const aLive = isLiveStatus(a.fixture.status.short);
                const bLive = isLiveStatus(b.fixture.status.short);
                if (aLive !== bLive) return Number(bLive) - Number(aLive);
                return new Date(a.fixture.date) - new Date(b.fixture.date);
            });
    }
}

function renderFixtures(fixtures, live) {
    const el = document.getElementById("fixtures-container");
    if (!el) return;

    let list = applyTabFilter(fixtures, live);
    if (state.selectedLeagueId) {
        list = list.filter(f => f.league.id === state.selectedLeagueId);
    }

    if (!list.length) {
        el.innerHTML = `<div class="loading-placeholder">No matches found</div>`;
        return;
    }

    // 按联赛分组
    const map = new Map();
    list.forEach(f => {
        if (!map.has(f.league.id)) map.set(f.league.id, { league: f.league, items: [] });
        map.get(f.league.id).items.push(f);
    });

let html = "";

// ✅ 关键：Map → Array，才能拿到 index
const leagueGroups = Array.from(map.entries());

leagueGroups.forEach(([leagueId, g], index) => {
    const l = g.league;

    // ✅ 前 10 个联赛默认展开，其余默认折叠
    if (index >= 10 && !state.collapsedLeagues.has(leagueId)) {
        state.collapsedLeagues.add(leagueId);
    }

    const isCollapsed = state.collapsedLeagues.has(leagueId);
    const matchCount = g.items.length;

    html += `
        <div class="league-group" data-league-id="${leagueId}">
            <div class="league-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                <div class="league-info-left">
                    ${l.flag ? `<img class="league-flag" src="${l.flag}">` : ""}
                    ${l.logo ? `<img class="league-logo-md" src="${l.logo}">` : ""}
                    <span class="league-name-text">
                      ${escapeHtml(l.country)} - ${escapeHtml(l.name)}
                    </span>
                </div>

                <div class="league-header-right" style="display: flex; align-items: center; gap: 8px;">
                    <span class="match-count-badge"
                          style="display:${isCollapsed ? 'inline-block' : 'none'}; background:#374151; color:#00e676; font-size:11px; padding:2px 6px; border-radius:10px; font-weight:bold;">
                        ${matchCount}
                    </span>
                    <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
                </div>
            </div>

            <div class="league-matches-container"
                 style="${isCollapsed ? 'display:none;' : 'display:block;'}">
                ${g.items.map(f => {
                    const s = f.fixture.status.short;
                    const isLive = isLiveStatus(s);
                    const isDone = isFinished(s);

                    let timeHtml = isLive
                      ? `<span class="live-time"><span class="live-dot"></span>${f.fixture.status.elapsed}'</span>`
                      : isDone
                        ? `<span class="status-finished">Finished</span>`
                        : formatHHMM(f.fixture.date);

                    return `
                        <div class="match-row" data-fixture-id="${f.fixture.id}">
                            <div class="match-left-group">
                                <div class="status-cell">${timeHtml}</div>
                                <div class="teams-container">
                                    <div class="team-line">
                                        <img class="team-logo" src="${f.teams.home.logo}">
                                        <span class="team-name">${escapeHtml(f.teams.home.name)}</span>
                                    </div>
                                    <div class="team-line">
                                        <img class="team-logo" src="${f.teams.away.logo}">
                                        <span class="team-name">${escapeHtml(f.teams.away.name)}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="score-section">
                                <div class="scores-column">
                                    <div class="team-score ${isLive ? 'live' : ''}">${f.goals.home ?? "-"}</div>
                                    <div class="team-score ${isLive ? 'live' : ''}">${f.goals.away ?? "-"}</div>
                                </div>
                                <div class="vertical-divider"></div>
                            </div>

                            <div class="match-actions">
                                <a class="live-btn ${isLive ? 'active' : 'inactive'}"
                                   href="https://xoigac.tv/" target="_blank">LIVE</a>
                                <button class="odds-btn" data-action="open-odds">ODDS</button>
                                <div class="star-btn ${state.favorites.has(f.fixture.id) ? "on" : ""}"
                                     data-action="toggle-fav">
                                    <i class="fa-${state.favorites.has(f.fixture.id) ? "solid" : "regular"} fa-star"></i>
                                </div>
                            </div>
                        </div>`;
                }).join("")}
            </div>
        </div>`;
});

el.innerHTML = html;

}

// ---------- Right Sidebar ----------
function renderFeaturedLive(live = []) {
  const box = document.getElementById("live-carousel-content");
  if (!box) return;
  if (!live.length) {
    box.innerHTML = `<div class="loading-placeholder">No live matches</div>`;
    return;
  }
  const fx = live[state.carouselIndex % live.length];
  box.innerHTML = `
    <div class="text-center">
      <div class="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">${escapeHtml(fx.league.name)}</div>
      <div class="flex items-center justify-around gap-2 mt-4">
        <div class="text-center">
          <img src="${fx.teams.home.logo}" class="w-10 h-10 mx-auto mb-2 object-contain">
          <div class="text-[11px] font-bold w-20 truncate">${escapeHtml(fx.teams.home.name)}</div>
        </div>
        <div class="text-xl font-black text-white">${fx.goals.home ?? 0} : ${fx.goals.away ?? 0}</div>
        <div class="text-center">
          <img src="${fx.teams.away.logo}" class="w-10 h-10 mx-auto mb-2 object-contain">
          <div class="text-[11px] font-bold w-20 truncate">${escapeHtml(fx.teams.away.name)}</div>
        </div>
      </div>
      <div class="mt-4 text-[10px] text-red-500 font-bold animate-pulse tracking-widest">
  LIVE ${
    (() => {
      const elapsed = fx.fixture.status.elapsed ?? 0;
      const extra = fx.fixture.status.extra;
      return extra
        ? `${elapsed}+${extra}'`
        : elapsed
          ? `${elapsed}'`
          : "";
    })()
  }
</div>
  `;
}

function renderNews(items) {
  const el = document.getElementById("news-container");
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = `<div class="loading-placeholder">No news available</div>`;
    return;
  }
  el.innerHTML = items.slice(0,5).map(n => `
    <div class="news-item" onclick="window.location.href='/${n.slug}'">
      <div class="news-title">${escapeHtml(n.title)}</div>
      <div class="news-meta">
        <span class="tag">${n.category_name || 'Article'}</span>
        <span>${new Date(n.created_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
      </div>
    </div>`).join("");
}

function updateLiveBadge(live) {
  const tab = document.querySelector(".tab-live");
  if (!tab) return;

  const hasLive = Array.isArray(live) && live.length > 0;
  tab.classList.toggle("has-live", hasLive);
}

// ---------- Match Detail Panel Logic ----------
async function openMatchDetails(matchId, rowElement) {
    // 1. 如果点击的是已经打开的详情，执行关闭逻辑
    const existingDetail = document.querySelector(`.detail-expanded[data-for="${matchId}"]`);
    if (existingDetail) {
        existingDetail.remove();
        rowElement.classList.remove('is-active'); // 关闭时移除绿色高亮
        return;
    }

    // 2. 清除所有其他行的详情和激活状态 (确保一次只开一个)
    document.querySelectorAll('.detail-expanded').forEach(el => el.remove());
    document.querySelectorAll('.match-row').forEach(r => r.classList.remove('is-active'));

    // 3. 给当前点击的行加上激活类 (.is-active) —— 这会触发你 CSS 里的绿色边框和背景
    rowElement.classList.add('is-active');

    // 4. 创建详情容器
    const detailContainer = document.createElement('div');
    detailContainer.className = 'detail-expanded';
    detailContainer.dataset.for = matchId;
    detailContainer.innerHTML = `<div class="inline-loader">Loading details...</div>`;
    
    // 5. 将详情插入到当前行之后
    rowElement.after(detailContainer);

    // 6. 执行平滑滚动 (滚动到该行，扣除 80px 的 Header 空间)
    setTimeout(() => {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    // 7. 开始获取数据 (保持你原有的逻辑不变)
    try {
        const result = await apiGetJSON(`/api/fixture-detail?id=${matchId}`);
        const match = extractMatch(result);

        if (!match) {
            detailContainer.innerHTML = `<div class="p-4 text-center text-gray-500">No data available</div>`;
            return;
        }

        // 渲染内部内容
        detailContainer.innerHTML = `
          <div class="inline-detail-content">
            <div class="detail-tabs">
               <button class="d-tab active" data-target="summary">Summary</button>
               <button class="d-tab" data-target="stats">Stats</button>
               <button class="d-tab" data-target="lineups">Lineups</button>
            </div>
            <div class="detail-body" id="inline-content-${matchId}">
               ${renderSummary(match)}
            </div>
          </div>
        `;

        // 绑定 Tab 点击事件 (保持你原有的逻辑不变)
        detailContainer.querySelectorAll('.d-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = btn.dataset.target;
                const contentEl = document.getElementById(`inline-content-${matchId}`);
                detailContainer.querySelectorAll('.d-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (target === "summary") contentEl.innerHTML = renderSummary(match);
                else if (target === "stats") contentEl.innerHTML = renderStats(match);
                else if (target === "lineups") contentEl.innerHTML = renderLineups(match);
            });
        });

    } catch (err) {
        detailContainer.innerHTML = `<div class="p-4 text-center text-red-500">Load failed</div>`;
    }
}

function renderSummary(match) {
  if (!Array.isArray(match.events) || !match.events.length) {
    return `<div class="loading-placeholder">No events</div>`;
  }

  const rows = match.events
    .map(ev => {
      const isHome = ev.team?.id === match.teams.home.id;

     const name =
  ev.player?.name ||
  ev.assist?.name ||
  ev.player_in?.name ||
  ev.player_out?.name ||
  "";

      if (!name) return null; // 彻底过滤“空白行”

      let icon = "⚽";
      if (ev.type === "Card") icon = ev.detail === "Yellow Card" ? "🟨" : "🟥";
      if (ev.type === "subst") icon = "🔄";

      const t = ev.time?.elapsed != null ? `${ev.time.elapsed}'` : "";

      return `
        <div class="event-row">
          <div class="event-time">${t}</div>

          <div class="event-side home ${isHome ? "show" : ""}">
            ${isHome ? escapeHtml(name) : ""}
          </div>

          <div class="event-mid">
            <span class="event-icon">${icon}</span>
          </div>

          <div class="event-side away ${!isHome ? "show" : ""}">
            ${!isHome ? escapeHtml(name) : ""}
          </div>
        </div>
      `;
    })
    .filter(Boolean);

  if (!rows.length) {
    return `<div class="loading-placeholder">No visible events</div>`;
  }

  return `
    <div class="events-container events-2col">
      ${rows.join("")}
    </div>
  `;
}


// ---------- Stats ----------
function renderStats(match) {
  if (!Array.isArray(match.statistics) || match.statistics.length < 2) {
    return `<div class="loading-placeholder">No stats</div>`;
  }

  const homeStats = match.statistics[0]?.statistics || [];
  const awayStats = match.statistics[1]?.statistics || [];

  const types = [
    "Ball Possession",
    "Total Shots",
    "Shots on Goal",
    "Corner Kicks"
  ];

  const getValNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseInt(v.replace("%",""), 10) || 0;
    return 0;
  };

  return `
    <div class="stats-container">
      ${types.map(type => {
        const hRaw = homeStats.find(s => s.type === type)?.value ?? 0;
        const aRaw = awayStats.find(s => s.type === type)?.value ?? 0;

        const h = getValNum(hRaw);
        const a = getValNum(aRaw);

        const total = (h + a) || 1;
        const hPct = Math.round((h / total) * 100);
        const aPct = 100 - hPct;

        const homeLead = h > a;
        const awayLead = a > h;

        return `
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-side ${homeLead ? "lead" : ""}">${escapeHtml(String(hRaw))}</span>
              <span class="stat-type">${escapeHtml(type)}</span>
              <span class="stat-side ${awayLead ? "lead" : ""}">${escapeHtml(String(aRaw))}</span>
            </div>

            <div class="stat-bar-bg">
              <div class="stat-bar-home ${homeLead ? "lead" : ""}" style="width:${hPct}%"></div>
              <div class="stat-bar-away ${awayLead ? "lead" : ""}" style="width:${aPct}%"></div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ---------- Lineups (FINAL CLEAN VERSION) ----------
function renderLineups(match) {
  const ROW_GAP = 8.5;   // 每一排垂直间距（%）
  const LEFT_MIN = 12;   // 左边界（%）
  const LEFT_MAX = 88;   // 右边界（%）

  const lineups = match.lineups;
  if (!Array.isArray(lineups) || lineups.length < 2) {
    return `<div class="loading-placeholder">No lineups</div>`;
  }

  const home =
    lineups.find(x => x.team?.id === match.teams.home.id) || lineups[0];
  const away =
    lineups.find(x => x.team?.id === match.teams.away.id) || lineups[1];

  const renderSide = (team, isAway) => {
    const players = team.startXI || [];
    if (!players.length) return "";

    // ① 按 row 分组
    const rows = {};
    players.forEach(p => {
      const grid = p.player?.grid;
      if (!grid) return;

      const [row, col] = grid.split(":").map(Number);
      if (!rows[row]) rows[row] = [];
      rows[row].push({ player: p.player, col });
    });

    // ② 行内按 col 排序（左 → 右）
    Object.values(rows).forEach(arr => {
      arr.sort((a, b) => a.col - b.col);
    });

    // ③ 渲染
    return Object.entries(rows).map(([rowStr, rowPlayers]) => {
      const row = Number(rowStr);
      const count = rowPlayers.length;

      const span = LEFT_MAX - LEFT_MIN;
      const step = (count <= 1) ? 0 : span / (count - 1);

      return rowPlayers.map((item, i) => {
        const left = (count <= 1)
          ? 50
          : LEFT_MIN + step * i;

        const top = isAway
          ? row * ROW_GAP
          : 100 - row * ROW_GAP;

        const pl = item.player;

        return `
          <div class="player-dot ${isAway ? "away-p" : "home-p"}"
               style="left:${left}%; top:${top}%;">

            <div class="shirt">${pl.number ?? ""}</div>
            <div class="name">
              ${escapeHtml(pl.name.split(" ").slice(-1)[0])}
            </div>

          </div>
        `;
      }).join("");
    }).join("");
  };

  return `
    <div class="lineup-container">
      <div class="pitch">
        <div class="pitch-markings">
          <div class="half-line"></div>
          <div class="center-circle"></div>
          <div class="penalty-area top"></div>
          <div class="penalty-area bottom"></div>
          <div class="goal-area top"></div>
          <div class="goal-area bottom"></div>
        </div>

        <div class="team-label away-label">
          ${escapeHtml(away.team.name)} · ${away.formation || ""}
        </div>

        <div class="team-label home-label">
          ${escapeHtml(home.team.name)} · ${home.formation || ""}
        </div>

        ${renderSide(away, true)}
        ${renderSide(home, false)}
      </div>
    </div>
  `;
}

// ---------- Refresh & Events ----------
async function refreshAll() {
  if (__REFRESHING__) return;
  __REFRESHING__ = true;

  try {
    // ① 立刻渲染不会等 API 的东西（页面先活过来）
    renderDateStrip();
    renderCompetitions();

    // ② fixtures 最慢，单独 await
    const fx = await loadFixturesByDateCached(state.date);
    state.lastFixtures = fx || [];
    renderFixtures(state.lastFixtures, state.lastLive);
    renderLeftSidebar(state.lastFixtures);

    // ③ live 不阻塞主页面
    loadLive().then(live => {
      state.lastLive = live || [];
      updateLiveBadge(state.lastLive);
      renderFeaturedLive(state.lastLive);
    });

    // ④ news 不阻塞
    loadNews().then(news => {
      renderNews(news || []);
    });

  } catch (err) {
    console.error("refreshAll failed:", err);
  } finally {
    __REFRESHING__ = false;
  }
}

function refreshCenter() {
  renderFixtures(state.lastFixtures, state.lastLive);
  renderCompetitions();
  renderLeftSidebar(state.lastFixtures);
}

function bindEvents() {

  // 防止重复绑定全局 click
  if (window.__GLOBAL_CLICK_BOUND__) return;
  window.__GLOBAL_CLICK_BOUND__ = true;

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      hideLeaguePage();
      state.tab = btn.dataset.tab;
      state.selectedLeagueId = null;
      document.querySelectorAll(".tab-btn").forEach(b =>
        b.classList.toggle("active", b === btn)
      );
      await refreshAll();
    });
  });

  // Sidebar Toggle
  const compBtn = document.getElementById('toggle-competitions');
  const allCompList = document.getElementById('all-competitions');
  const chevron = document.getElementById('comp-chevron');
  if (compBtn && allCompList) {
    compBtn.addEventListener('click', () => {
      const isHidden = allCompList.classList.contains('hidden');
      allCompList.classList.toggle('hidden');
      if (chevron) chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    });
  }

  // Date Nav
  const prev = document.getElementById("btnPrevDay");
  const next = document.getElementById("btnNextDay");
  const dp = document.getElementById("datePicker");
  async function onDateChange(d) {
    state.date = d;
    state.selectedLeagueId = null;
    await refreshAll();
  }
  prev?.addEventListener("click", () => { const d = new Date(state.date); d.setDate(d.getDate() - 1); onDateChange(d); });
  next?.addEventListener("click", () => { const d = new Date(state.date); d.setDate(d.getDate() + 1); onDateChange(d); });
  dp?.addEventListener("change", () => { const [y, m, d] = dp.value.split("-").map(Number); onDateChange(new Date(y, m - 1, d)); });

  // Carousel
  document.getElementById("carousel-prev")?.addEventListener("click", () => { state.carouselIndex = state.carouselIndex > 0 ? state.carouselIndex - 1 : 0; renderFeaturedLive(state.lastLive); });
  document.getElementById("carousel-next")?.addEventListener("click", () => { state.carouselIndex++; renderFeaturedLive(state.lastLive); });

  // ===== Global Clicks (Fav, Filter, Inline Details) =====
  document.addEventListener("click", e => {

    // 0. 返回首页按钮 (新增)
    if (e.target.closest("#back-to-home")) {
      hideLeaguePage();
      return;
    }

    // 1. 日期 chip 点击
    const chip = e.target.closest(".date-chip");
    if (chip) {
      const [y, m, d] = chip.dataset.ymd.split("-").map(Number);
      state.date = new Date(y, m - 1, d);
      state.selectedLeagueId = null;
      refreshAll();
      return;
    }

    // 2. 收藏星号
    const fav = e.target.closest("[data-action='toggle-fav']");
    if (fav) {
      e.stopPropagation();
const row = fav.closest(".match-row");
if (!row) return;

const id = Number(row.dataset.fixtureId || row.getAttribute("data-fixture-id"));
if (!id) return;
      const isAdding = !state.favorites.has(id);
      if (isAdding) state.favorites.add(id); else state.favorites.delete(id);
      localStorage.setItem("favMatches", JSON.stringify([...state.favorites]));
      document.querySelectorAll(`.match-row[data-fixture-id="${id}"] [data-action="toggle-fav"]`)
        .forEach(starElement => {
          if (isAdding) {
            starElement.classList.add("on");
            starElement.innerHTML = '<i class="fa-solid fa-star"></i>';
          } else {
            starElement.classList.remove("on");
            starElement.innerHTML = '<i class="fa-regular fa-star"></i>';
          }
        });
      return;
    }

    // 3. ODDS 按钮
    const oddsBtn = e.target.closest("[data-action='open-odds']");
    if (oddsBtn) {
      e.stopPropagation();
      window.open("https://www.ab77-vip.com", "_blank");
      return;
    }

    // 4. LIVE 按钮
    const liveLink = e.target.closest(".live-btn");
    if (liveLink) {
      e.stopPropagation();
      return;
    }

// 5. 侧边栏/列表联赛点击（进入 League Page）
const lg = e.target.closest("[data-action='filter-league']");
if (lg) {
    const lid = Number(lg.dataset.leagueId);
    state.selectedLeagueId = lid;
    
    // 提升体验：先显示详情页并放一个转圈圈
    showLeaguePage();
    const summaryContainer = document.getElementById("summary-content");
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center p-20">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00e676]"></div>
                <p class="text-gray-500 mt-4 text-sm">Fetching league data...</p>
            </div>`;
    }

    loadLeaguePage(lid); 
    return;
}

    // 5.5 联赛行折叠切换
    const leagueHeader = e.target.closest(".league-header");
    // 关键修正：只有在非详情页（即主页列表）时才触发折叠逻辑
    if (leagueHeader && !e.target.closest("#league-page")) {
      const group = leagueHeader.closest(".league-group");
      if (!group) return; // 防止在非分组内点击报错
      
      const leagueId = Number(group.dataset.leagueId);
      const container = group.querySelector(".league-matches-container");
      const icon = leagueHeader.querySelector("i");
      const countBadge = leagueHeader.querySelector(".match-count-badge");

      if (state.collapsedLeagues.has(leagueId)) {
        state.collapsedLeagues.delete(leagueId);
        if (container) container.style.display = "block";
        icon?.classList.replace("fa-chevron-right", "fa-chevron-down");
        if (countBadge) countBadge.style.display = "none";
      } else {
        state.collapsedLeagues.add(leagueId);
        if (container) container.style.display = "none";
        icon?.classList.replace("fa-chevron-down", "fa-chevron-right");
        if (countBadge) countBadge.style.display = "inline-block";
      }
      return;
    }

    // 6. 点击 match-row 整行，在行下展开详情
    const row = e.target.closest(".match-row");
    if (row) {
      if (e.target.closest(".match-actions")) return;
      const matchId = Number(row.dataset.fixtureId);
      openMatchDetails(matchId, row);
    }

  });
  
  // 初始化绑定详情页 Tab 切换
  setupLeagueTabs();
  
} // bindEvents 结束

function setupLeagueTabs() {
  const container = document.getElementById("league-tabs"); 
  if (!container || container.dataset.init === "true") return;
  
  container.dataset.init = "true"; // 防止重复初始化

  container.addEventListener("click", e => {
    const tab = e.target.closest(".league-tab");
    if (!tab) return;

    const key = tab.dataset.tab;
    
    // 1. 切换 Tab 按钮高亮
    container.querySelectorAll(".league-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    // 2. 切换对应的面板
    document.querySelectorAll(".league-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `league-${key}`);
    });

    // 3. 只有在面板切换后且容器为空时才加载数据
    if (key === 'standings') {
        renderStandingsPlaceholder(); // 先放个加载中
        // fetchStandings(state.selectedLeagueId); // 稍后实现
    }
  });
}

// ---------- Load News Categories for Navigation ----------
async function loadNavCategories() {
  try {
    await window.CONFIG_READY;
    const apiBase = window.APP_CONFIG?.adminApiUrl || 'http://localhost:8080';
    const res = await fetch(`${apiBase}/api/public/categories`);
    const data = await res.json();
    if (data.success && data.data.length > 0) {
      const nav = document.getElementById('main-nav');
      if (nav) {
        if (nav.getAttribute('data-managed-by') === 'articles-page') {
          return;
        }

        const normalizePathname = (pathname) => {
          const p = String(pathname || '/');
          if (p !== '/' && p.endsWith('/')) return p.slice(0, -1);
          return p;
        };

        const currentPath = normalizePathname(window.location.pathname);

        nav.innerHTML =
          `<a href="/" class="text-gray-500 hover:text-white transition-colors" style="${currentPath === '/' ? 'color:var(--green)' : ''}">Football</a>` +
          data.data.map(c => {
            const href = `/${c.slug}`;
            const isActive = normalizePathname(href) === currentPath;
            return `<a href="${href}" class="text-gray-500 hover:text-white transition-colors" style="${isActive ? 'color:var(--green)' : ''}">${c.name}</a>`;
          }).join('');
      }
      
      // Update footer category links (insert after News Feed)
      const footerCatLinks = document.getElementById('footer-category-links');
      if (footerCatLinks) {
        footerCatLinks.innerHTML = data.data.slice(0, 4).map(c => 
          `<a href="/${c.slug}" class="footer-link">${c.name}</a>`
        ).join('');
      }
      
      // Remove the old footer-categories section
      const oldFooterCats = document.getElementById('footer-categories');
      if (oldFooterCats) {
        oldFooterCats.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Load nav categories error:', err);
  }
}

// ---------- Init ----------
async function init() {
  // Clock and categories are now loaded in loadComponents()
  bindEvents();
  await refreshAll();
}

init(); // ✅【就是缺这一行】

setInterval(() => {
  const leaguePage = document.getElementById("league-page");
  const isLeaguePageVisible = leaguePage && !leaguePage.classList.contains("hidden");

  if (!isLeaguePageVisible) {
    refreshAll();
    return;
  }

  loadLive().then(live => {
    state.lastLive = live || [];
    updateLiveBadge(state.lastLive);

    if (state.selectedLeagueId) {
      const summaryPanel = document.getElementById("league-summary");
      if (summaryPanel && summaryPanel.classList.contains("active")) {
        renderLeagueSummary(state.selectedLeagueId);
      }
    }
  });
}, 60000);