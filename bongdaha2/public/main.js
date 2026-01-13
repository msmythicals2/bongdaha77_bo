// ==========================================
// BONGDAHA - main.js (CLEAN VERSION)
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
  collapsedLeagues: new Set(),
  carouselIndex: 0,
  lastFixtures: [],
  lastLive: [],
  selectedLeagueId: null,
};

let __REFRESHING__ = false;
const __CACHE__ = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// Enhanced caching system
async function apiGetJSONCached(url, ttl = CACHE_TTL) {
  const now = Date.now();
  const hit = __CACHE__.get(url);
  
  if (hit && now - hit.t < ttl) {
    return hit.data;
  }

  try {
    const r = await fetch(url);
    if (!r.ok) {
      console.error("API failed:", url, r.status);
      return null;
    }
    
    const data = await r.json();
    __CACHE__.set(url, { t: now, data });
    return data;
  } catch (err) {
    console.error("Fetch error:", url, err);
    return null;
  }
}

async function apiGetJSON(url) {
  return apiGetJSONCached(url, CACHE_TTL);
}
// Competition data
const COMPETITION_DATA = [
  { id: 39, name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { id: 140, name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { id: 135, name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { id: 78, name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { id: 61, name: "Ligue 1", country: "France", logo: "https://media.api-sports.io/football/leagues/61.png" },
  { id: 340, name: "V.League 1", country: "Vietnam", logo: "https://media.api-sports.io/football/leagues/340.png" },
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

// Helper functions
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

function isFinished(status) {
  return ["FT", "AET", "PEN", "ABD", "AWD", "CANC"].includes(status);
}

function isLiveStatus(status) {
  return ["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(status);
}

function isScheduled(status) {
  return ["NS", "TBD", "PST"].includes(status);
}

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

// Load navigation categories
async function loadNavCategories() {
  try {
    await window.CONFIG_READY;
    const apiBase = window.APP_CONFIG?.adminApiUrl || 'http://localhost:8080';
    const res = await fetch(`${apiBase}/api/public/categories`);
    const data = await res.json();
    
    if (data.success && data.data.length > 0) {
      const navContainer = document.querySelector('#main-nav');
      if (navContainer && !navContainer.hasAttribute('data-managed-by')) {
        // Only update nav if it's not being managed by another page (like articles.html)
        const footballLink = navContainer.querySelector('a[href="/"]');
        if (footballLink) {
          // Clear existing content and rebuild
          navContainer.innerHTML = `<a href="/" class="text-gray-500 hover:text-white transition-colors">Football</a>`;
          
          // Add category links
          data.data.forEach(category => {
            const link = document.createElement('a');
            link.href = `/${category.slug}`;
            link.className = 'text-gray-500 hover:text-white transition-colors';
            link.textContent = category.name.toUpperCase();
            navContainer.appendChild(link);
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// API functions
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

// Clock function
function updateClock() {
  const n = new Date();
  const el = document.getElementById("clock");
  if (!el) return;
  el.textContent = `${pad2(n.getDate())}/${pad2(n.getMonth()+1)}/${n.getFullYear()} ${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
}
// Date strip rendering
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

// Render competitions
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

// Render left sidebar
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

// Apply tab filter
function applyTabFilter(all, live) {
    const mergedMap = new Map();
    [...all, ...live].forEach(f => mergedMap.set(f.fixture.id, f));
    const dayMatches = Array.from(mergedMap.values());

    switch (state.tab) {
        case "live":
            return live;
        case "finished":
            return dayMatches.filter(f => isFinished(f.fixture.status.short));
        case "scheduled":
            return dayMatches.filter(f => isScheduled(f.fixture.status.short));
        case "favorite":
            return dayMatches.filter(f => state.favorites.has(f.fixture.id))
                             .sort((a, b) => Number(isLiveStatus(b.fixture.status.short)) - Number(isLiveStatus(a.fixture.status.short)));
        case "all":
        default:
            return dayMatches.sort((a, b) => {
                const aLive = isLiveStatus(a.fixture.status.short);
                const bLive = isLiveStatus(b.fixture.status.short);
                if (aLive !== bLive) return Number(bLive) - Number(aLive);
                return new Date(a.fixture.date) - new Date(b.fixture.date);
            });
    }
}
// Render fixtures
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

    // Group by league
    const map = new Map();
    list.forEach(f => {
        if (!map.has(f.league.id)) map.set(f.league.id, { league: f.league, items: [] });
        map.get(f.league.id).items.push(f);
    });

    let html = "";
    const leagueGroups = Array.from(map.entries());

    leagueGroups.forEach(([leagueId, g], index) => {
        const l = g.league;

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

                        const getMatchTimeDisplay = (fixture) => {
                            const elapsed = fixture.status.elapsed;
                            const extra = fixture.status.extra;
                            
                            if (elapsed !== null && elapsed !== undefined) {
                                if (extra && extra > 0) {
                                    return `${elapsed}+${extra}'`;
                                }
                                return `${elapsed}'`;
                            }
                            return '';
                        };

                        let timeHtml = isLive
                          ? `<span class="live-time"><span class="live-dot"></span>${getMatchTimeDisplay(f.fixture) || 'LIVE'}</span>`
                          : isDone
                            ? `<span class="status-finished">Finished</span>`
                            : formatHHMM(f.fixture.date);

                        return `
                            <div class="match-row" data-fixture-id="${f.fixture.id}" data-match-status="${f.fixture.status.short}">
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
// Render featured live
function renderFeaturedLive(live = []) {
  const box = document.getElementById("live-carousel-content");
  if (!box) return;
  if (!live.length) {
    box.innerHTML = `<div class="loading-placeholder">No live matches</div>`;
    return;
  }
  const fx = live[state.carouselIndex % live.length];
  
  const getMatchTime = (fixture) => {
    const elapsed = fixture.status.elapsed;
    const extra = fixture.status.extra;
    
    if (elapsed !== null && elapsed !== undefined) {
      if (extra && extra > 0) {
        return `${elapsed}+${extra}'`;
      }
      return `${elapsed}'`;
    }
    return '';
  };
  
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
        ${getMatchTime(fx.fixture) ? `<span class="live-dot" style="display: inline-block; width: 6px; height: 6px; background-color: #ef4444; border-radius: 50%; margin-right: 4px; animation: pulse 2s infinite;"></span>${getMatchTime(fx.fixture)}` : 'LIVE'}
      </div>
    </div>
  `;
}

// Render news
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

// Update live badge
function updateLiveBadge(live) {
  const tab = document.querySelector(".tab-live");
  if (!tab) return;
  const hasLive = Array.isArray(live) && live.length > 0;
  tab.classList.toggle("has-live", hasLive);
}

// Match detail functions
function renderSummary(match) {
  if (!Array.isArray(match.events) || !match.events.length) {
    return `<div class="loading-placeholder">No events</div>`;
  }

  const rows = match.events
    .map(ev => {
      const isHome = ev.team?.id === match.teams.home.id;
      const name = ev.player?.name || ev.assist?.name || ev.player_in?.name || ev.player_out?.name || "";

      if (!name) return null;

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
// Render stats
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

// Render lineups
function renderLineups(match) {
  const ROW_GAP = 8.5;
  const LEFT_MIN = 12;
  const LEFT_MAX = 88;

  const lineups = match.lineups;
  if (!Array.isArray(lineups) || lineups.length < 2) {
    return `<div class="loading-placeholder">No lineups</div>`;
  }

  const home = lineups.find(x => x.team?.id === match.teams.home.id) || lineups[0];
  const away = lineups.find(x => x.team?.id === match.teams.away.id) || lineups[1];

  const renderSide = (team, isAway) => {
    const players = team.startXI || [];
    if (!players.length) return "";

    const rows = {};
    players.forEach(p => {
      const grid = p.player?.grid;
      if (!grid) return;

      const [row, col] = grid.split(":").map(Number);
      if (!rows[row]) rows[row] = [];
      rows[row].push({ player: p.player, col });
    });

    Object.values(rows).forEach(arr => {
      arr.sort((a, b) => a.col - b.col);
    });

    return Object.entries(rows).map(([rowStr, rowPlayers]) => {
      const row = Number(rowStr);
      const count = rowPlayers.length;

      const span = LEFT_MAX - LEFT_MIN;
      const step = (count <= 1) ? 0 : span / (count - 1);

      return rowPlayers.map((item, i) => {
        const left = (count <= 1) ? 50 : LEFT_MIN + step * i;
        const top = isAway ? row * ROW_GAP : 100 - row * ROW_GAP;
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
// Match detail panel logic
async function openMatchDetails(matchId, rowElement) {
    const existingDetail = document.querySelector(`.detail-expanded[data-for="${matchId}"]`);
    if (existingDetail) {
        existingDetail.remove();
        rowElement.classList.remove('is-active');
        return;
    }

    document.querySelectorAll('.detail-expanded').forEach(el => el.remove());
    document.querySelectorAll('.match-row, .result-item, .fixture-match-card').forEach(r => r.classList.remove('is-active'));

    rowElement.classList.add('is-active');

    const detailContainer = document.createElement('div');
    detailContainer.className = 'detail-expanded';
    detailContainer.dataset.for = matchId;
    detailContainer.innerHTML = `
        <div class="inline-loader">
            <div class="loading-spinner"></div>
            <p>Loading match details...</p>
        </div>
    `;
    
    rowElement.after(detailContainer);

    setTimeout(() => {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    try {
        const result = await Promise.race([
            apiGetJSON(`/api/fixture-detail?id=${matchId}`),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 3000)
            )
        ]);
        
        const match = extractMatch(result);

        if (!match) {
            detailContainer.innerHTML = `
                <div class="error-message">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <h3>No Data Available</h3>
                    <p>Unable to load match details</p>
                    <button class="retry-btn" onclick="openMatchDetails(${matchId}, this.closest('.detail-expanded').previousElementSibling)">
                        <i class="fa-solid fa-refresh"></i> Retry
                    </button>
                </div>
            `;
            return;
        }

        const matchStatus = match.fixture.status.short;
        const isScheduledMatch = isScheduled(matchStatus);
        const isLiveMatch = isLiveStatus(matchStatus);
        const isFinishedMatch = isFinished(matchStatus);

        let tabsHtml = '';
        let contentHtml = '';

        if (isScheduledMatch) {
            tabsHtml = `
                <div class="detail-tabs">
                    <button class="d-tab active" data-target="match">MATCH</button>
                    <button class="d-tab" data-target="odds">ODDS</button>
                    <button class="d-tab" data-target="h2h">H2H</button>
                    <button class="d-tab" data-target="standings">STANDINGS</button>
                </div>
            `;
            contentHtml = renderScheduledContent(match);
        } else if (isLiveMatch) {
            tabsHtml = `
                <div class="detail-tabs">
                    <button class="d-tab active" data-target="match">MATCH</button>
                    <button class="d-tab" data-target="odds">ODDS</button>
                    <button class="d-tab" data-target="h2h">H2H</button>
                    <button class="d-tab" data-target="standings">STANDINGS</button>
                </div>
            `;
            contentHtml = renderLiveContent(match);
        } else if (isFinishedMatch) {
            tabsHtml = `
                <div class="detail-tabs">
                    <button class="d-tab active" data-target="match">MATCH</button>
                    <button class="d-tab" data-target="odds">ODDS</button>
                    <button class="d-tab" data-target="h2h">H2H</button>
                    <button class="d-tab" data-target="standings">STANDINGS</button>
                </div>
                <div class="detail-sub-tabs" style="display: block;">
                    <button class="d-sub-tab active" data-target="summary">SUMMARY</button>
                    <button class="d-sub-tab" data-target="stats">STATS</button>
                    <button class="d-sub-tab" data-target="lineups">LINEUPS</button>
                </div>
            `;
            contentHtml = renderSummary(match);
        }

        detailContainer.innerHTML = `
          <div class="inline-detail-content">
            <div class="match-header-inline">
                <div class="teams-score">
                    <div class="team-info">
                        <img src="${match.teams.home.logo}" class="team-logo-md">
                        <span class="team-name">${escapeHtml(match.teams.home.name)}</span>
                    </div>
                    <div class="score-display">
                        ${match.goals.home !== null ? `${match.goals.home} - ${match.goals.away}` : 'VS'}
                        <div class="match-status">${match.fixture.status.long}</div>
                    </div>
                    <div class="team-info">
                        <img src="${match.teams.away.logo}" class="team-logo-md">
                        <span class="team-name">${escapeHtml(match.teams.away.name)}</span>
                    </div>
                </div>
            </div>
            ${tabsHtml}
            <div class="detail-body" id="inline-content-${matchId}">
               ${contentHtml}
            </div>
          </div>
        `;

        // Bind main tab events
        detailContainer.querySelectorAll('.d-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = btn.dataset.target;
                const contentEl = document.getElementById(`inline-content-${matchId}`);
                
                detailContainer.querySelectorAll('.d-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const subTabs = detailContainer.querySelector('.detail-sub-tabs');
                if (target === 'match' && isFinishedMatch) {
                    if (subTabs) subTabs.style.display = 'block';
                } else {
                    if (subTabs) subTabs.style.display = 'none';
                }
                
                contentEl.innerHTML = '<div class="tab-loading"><div class="loading-spinner"></div></div>';
                
                setTimeout(() => {
                    if (target === "match") {
                        if (isScheduledMatch) contentEl.innerHTML = renderScheduledContent(match);
                        else if (isLiveMatch) contentEl.innerHTML = renderLiveContent(match);
                        else if (isFinishedMatch) contentEl.innerHTML = renderSummary(match);
                    } else if (target === "odds") {
                        contentEl.innerHTML = renderComingSoon("Odds data will be available soon");
                    } else if (target === "h2h") {
                        contentEl.innerHTML = renderComingSoon("Head-to-head data coming soon");
                    } else if (target === "standings") {
                        contentEl.innerHTML = renderComingSoon("Standings data coming soon");
                    }
                }, 100);
            });
        });

        // Bind sub-tab events for finished matches
        if (isFinishedMatch) {
            detailContainer.querySelectorAll('.d-sub-tab').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const target = btn.dataset.target;
                    const contentEl = document.getElementById(`inline-content-${matchId}`);
                    
                    detailContainer.querySelectorAll('.d-sub-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    contentEl.innerHTML = '<div class="tab-loading"><div class="loading-spinner"></div></div>';
                    
                    setTimeout(() => {
                        if (target === "summary") contentEl.innerHTML = renderSummary(match);
                        else if (target === "stats") contentEl.innerHTML = renderStats(match);
                        else if (target === "lineups") contentEl.innerHTML = renderLineups(match);
                    }, 100);
                });
            });
        }

    } catch (err) {
        console.error('Match detail error:', err);
        detailContainer.innerHTML = `
            <div class="error-message">
                <i class="fa-solid fa-wifi"></i>
                <h3>Connection Error</h3>
                <p>Please check your connection and try again</p>
                <button class="retry-btn" onclick="openMatchDetails(${matchId}, this.closest('.detail-expanded').previousElementSibling)">
                    <i class="fa-solid fa-refresh"></i> Retry
                </button>
            </div>
        `;
    }
}
// Content renderers for different match states
function renderScheduledContent(match) {
    const venue = match.fixture.venue;
    return `
        <div class="match-info-section">
            <h3><i class="fa-solid fa-info-circle"></i> Match Information</h3>
            <div class="venue-info">
                ${venue?.name ? `
                    <div class="info-item">
                        <span class="info-label">Stadium:</span>
                        <span class="info-value">${escapeHtml(venue.name)}</span>
                    </div>
                ` : ''}
                ${venue?.capacity ? `
                    <div class="info-item">
                        <span class="info-label">Capacity:</span>
                        <span class="info-value">${venue.capacity.toLocaleString()}</span>
                    </div>
                ` : ''}
                ${venue?.city ? `
                    <div class="info-item">
                        <span class="info-label">City:</span>
                        <span class="info-value">${escapeHtml(venue.city)}</span>
                    </div>
                ` : ''}
                <div class="info-item">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${new Date(match.fixture.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Time:</span>
                    <span class="info-value">${formatHHMM(match.fixture.date)}</span>
                </div>
            </div>
            
            <div class="team-form-section">
                <h3><i class="fa-solid fa-chart-line"></i> Team Form</h3>
                <div class="form-comparison">
                    <div class="team-form">
                        <div class="team-header">
                            <img src="${match.teams.home.logo}" class="team-logo-sm">
                            <span>${escapeHtml(match.teams.home.name)}</span>
                        </div>
                        <div class="form-dots">
                            <span class="form-dot form-w">W</span>
                            <span class="form-dot form-w">W</span>
                            <span class="form-dot form-d">D</span>
                            <span class="form-dot form-w">W</span>
                            <span class="form-dot form-l">L</span>
                        </div>
                    </div>
                    <div class="team-form">
                        <div class="team-header">
                            <img src="${match.teams.away.logo}" class="team-logo-sm">
                            <span>${escapeHtml(match.teams.away.name)}</span>
                        </div>
                        <div class="form-dots">
                            <span class="form-dot form-w">W</span>
                            <span class="form-dot form-d">D</span>
                            <span class="form-dot form-w">W</span>
                            <span class="form-dot form-w">W</span>
                            <span class="form-dot form-d">D</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderLiveContent(match) {
    const venue = match.fixture.venue;
    return `
        <div class="live-match-section">
            <div class="match-info-section">
                <h3><i class="fa-solid fa-info-circle"></i> Match Information</h3>
                <div class="venue-info">
                    ${venue?.name ? `
                        <div class="info-item">
                            <span class="info-label">Stadium:</span>
                            <span class="info-value">${escapeHtml(venue.name)}</span>
                        </div>
                    ` : ''}
                    ${venue?.capacity ? `
                        <div class="info-item">
                            <span class="info-label">Capacity:</span>
                            <span class="info-value">${venue.capacity.toLocaleString()}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="live-summary-section">
                <h3><i class="fa-solid fa-futbol"></i> Live Events</h3>
                <div class="live-events-tabs">
                    <button class="live-event-tab active" data-period="all">MATCH</button>
                    <button class="live-event-tab" data-period="1st">1ST HALF</button>
                    <button class="live-event-tab" data-period="2nd">2ND HALF</button>
                </div>
                <div class="live-events-content">
                    ${renderSummary(match)}
                </div>
            </div>
            
            <div class="watch-live-section">
                <a href="https://xoigac.tv/" target="_blank" class="watch-live-btn">
                    <i class="fa-solid fa-play"></i>
                    WATCH LIVE
                </a>
            </div>
            
            <div class="live-stats-section">
                <h3><i class="fa-solid fa-chart-bar"></i> Live Stats</h3>
                <div class="stats-period-tabs">
                    <button class="stats-period-tab active" data-period="match">MATCH</button>
                    <button class="stats-period-tab" data-period="1st">1ST HALF</button>
                    <button class="stats-period-tab" data-period="2nd">2ND HALF</button>
                </div>
                <div class="stats-content">
                    ${renderStats(match)}
                </div>
            </div>
        </div>
    `;
}

function renderComingSoon(message) {
    return `
        <div class="coming-soon">
            <i class="fa-solid fa-clock"></i>
            <h3>Coming Soon</h3>
            <p>${message}</p>
        </div>
    `;
}
// Refresh and events
async function refreshAll() {
  if (__REFRESHING__) return;
  __REFRESHING__ = true;

  try {
    renderDateStrip();
    renderCompetitions();

    const fx = await loadFixturesByDateCached(state.date);
    state.lastFixtures = fx || [];
    renderFixtures(state.lastFixtures, state.lastLive);
    renderLeftSidebar(state.lastFixtures);

    loadLive().then(live => {
      state.lastLive = live || [];
      updateLiveBadge(state.lastLive);
      renderFeaturedLive(state.lastLive);
    });

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
  if (window.__GLOBAL_CLICK_BOUND__) return;
  window.__GLOBAL_CLICK_BOUND__ = true;

  // Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
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

  // Global clicks
  document.addEventListener("click", e => {
    // Date chip click
    const chip = e.target.closest(".date-chip");
    if (chip) {
      const [y, m, d] = chip.dataset.ymd.split("-").map(Number);
      state.date = new Date(y, m - 1, d);
      state.selectedLeagueId = null;
      refreshAll();
      return;
    }

    // Favorite star
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

    // ODDS button
    const oddsBtn = e.target.closest("[data-action='open-odds']");
    if (oddsBtn) {
      e.stopPropagation();
      window.open("https://www.ab77-vip.com", "_blank");
      return;
    }

    // LIVE button
    const liveLink = e.target.closest(".live-btn");
    if (liveLink) {
      e.stopPropagation();
      return;
    }

    // League filter
    const lg = e.target.closest("[data-action='filter-league']");
    if (lg) {
      const lid = Number(lg.dataset.leagueId);
      state.selectedLeagueId = lid;
      refreshCenter();
      return;
    }

    // League header collapse
    const leagueHeader = e.target.closest(".league-header");
    if (leagueHeader) {
      const group = leagueHeader.closest(".league-group");
      if (!group) return;
      
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

    // Match row click
    const row = e.target.closest(".match-row");
    if (row) {
      if (e.target.closest(".match-actions")) return;
      const matchId = Number(row.dataset.fixtureId);
      if (!matchId) return;
      openMatchDetails(matchId, row);
    }
  });
}

// Init
async function init() {
  bindEvents();
  await refreshAll();
}

init();

setInterval(() => {
  refreshAll();
}, 30000);

setInterval(() => {
  loadLive().then(live => {
    if (live && live.length > 0) {
      state.lastLive = live;
      updateLiveBadge(state.lastLive);
      renderFeaturedLive(state.lastLive);
      
      if (state.tab === 'all' || state.tab === 'live') {
        renderFixtures(state.lastFixtures, state.lastLive);
      }
    }
  });
}, 15000);