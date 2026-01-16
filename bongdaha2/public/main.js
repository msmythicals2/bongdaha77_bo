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
  pinnedTeams: new Set(JSON.parse(localStorage.getItem("pinnedTeams") || "[]")),
};

// Migrate old team IDs to new correct IDs
function migrateTeamIDs() {
  const ID_MIGRATIONS = {
    2274: 3670, // Hanoi FC: Trans Narva (Estonia) -> Ha Noi (Vietnam)
    2277: 3681, // Viettel FC: Birkirkara (Malta) -> Viettel (Vietnam)
    2931: 2932, // Al-Hilal: Al-Fateh -> Al-Hilal Saudi FC
    2932: 2938, // Al-Ittihad: Al-Hilal -> Al-Ittihad FC
    1604: 9568, // Inter Miami: NYC FC -> Inter Miami
    1613: 1605, // LA Galaxy: Columbus Crew -> LA Galaxy
    228: 127,   // Flamengo: Sporting CP -> Flamengo
    131: 451    // Boca Juniors: Corinthians -> Boca Juniors
  };

  try {
    // Migrate pinnedTeams Set
    const pinnedTeamsArray = JSON.parse(localStorage.getItem("pinnedTeams") || "[]");
    const migratedPinnedTeams = pinnedTeamsArray.map(id => ID_MIGRATIONS[id] || id);
    localStorage.setItem("pinnedTeams", JSON.stringify(migratedPinnedTeams));
    state.pinnedTeams = new Set(migratedPinnedTeams);

    // Migrate pinnedTeamsData object
    const pinnedTeamsData = JSON.parse(localStorage.getItem("pinnedTeamsData") || "{}");
    const migratedData = {};
    
    Object.entries(pinnedTeamsData).forEach(([oldId, teamData]) => {
      const oldIdNum = parseInt(oldId);
      const newId = ID_MIGRATIONS[oldIdNum] || oldIdNum;
      
      // Update team data with new ID
      migratedData[newId] = {
        ...teamData,
        id: newId
      };
      
      // Update team name if it was one of the corrected teams
      if (oldIdNum === 2274) {
        migratedData[newId].name = "Ha Noi";
      } else if (oldIdNum === 2277) {
        migratedData[newId].name = "Viettel";
      } else if (oldIdNum === 2931) {
        migratedData[newId].name = "Al-Hilal";
      } else if (oldIdNum === 2932) {
        migratedData[newId].name = "Al-Ittihad";
      } else if (oldIdNum === 1604) {
        migratedData[newId].name = "Inter Miami CF";
      } else if (oldIdNum === 1613) {
        migratedData[newId].name = "LA Galaxy";
      } else if (oldIdNum === 228) {
        migratedData[newId].name = "Flamengo";
      } else if (oldIdNum === 131) {
        migratedData[newId].name = "Boca Juniors";
      }
    });
    
    localStorage.setItem("pinnedTeamsData", JSON.stringify(migratedData));
    
    console.log("Team IDs migrated successfully");
  } catch (err) {
    console.error("Error migrating team IDs:", err);
  }
}

// Run migration on page load
migrateTeamIDs();

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

// Get country code from country name for flag display
function getCountryCode(countryName) {
  if (!countryName) return null;
  
  const countryMap = {
    'England': 'gb-eng', 'Spain': 'es', 'France': 'fr', 'Germany': 'de', 'Italy': 'it',
    'Portugal': 'pt', 'Brazil': 'br', 'Argentina': 'ar', 'Netherlands': 'nl', 'Belgium': 'be',
    'Croatia': 'hr', 'Denmark': 'dk', 'Sweden': 'se', 'Norway': 'no', 'Poland': 'pl',
    'Switzerland': 'ch', 'Austria': 'at', 'Czech Republic': 'cz', 'Serbia': 'rs', 
    'Turkey': 'tr', 'Türkiye': 'tr', // Turkish name for Turkey
    'Uruguay': 'uy', 'Colombia': 'co', 'Chile': 'cl', 'Mexico': 'mx', 'USA': 'us',
    'Canada': 'ca', 'Japan': 'jp', 'South Korea': 'kr', 'Australia': 'au', 'Morocco': 'ma',
    'Senegal': 'sn', 'Nigeria': 'ng', 'Ghana': 'gh', 'Cameroon': 'cm', 'Ivory Coast': 'ci',
    'Egypt': 'eg', 'Algeria': 'dz', 'Tunisia': 'tn', 'Mali': 'ml', 'Burkina Faso': 'bf',
    'Scotland': 'gb-sct', 'Wales': 'gb-wls', 'Northern Ireland': 'gb-nir', 'Ireland': 'ie',
    'Greece': 'gr', 'Romania': 'ro', 'Bulgaria': 'bg', 'Ukraine': 'ua', 'Russia': 'ru',
    'Slovakia': 'sk', 'Hungary': 'hu', 'Slovenia': 'si', 'Bosnia and Herzegovina': 'ba',
    'Albania': 'al', 'North Macedonia': 'mk', 'Montenegro': 'me', 'Kosovo': 'xk',
    'Iceland': 'is', 'Finland': 'fi', 'Estonia': 'ee', 'Latvia': 'lv', 'Lithuania': 'lt',
    'Paraguay': 'py', 'Peru': 'pe', 'Ecuador': 'ec', 'Venezuela': 've', 'Bolivia': 'bo',
    'Costa Rica': 'cr', 'Panama': 'pa', 'Jamaica': 'jm', 'Honduras': 'hn', 'El Salvador': 'sv',
    'China': 'cn', 'Iran': 'ir', 'Saudi Arabia': 'sa', 'Qatar': 'qa', 'UAE': 'ae',
    'Iraq': 'iq', 'Uzbekistan': 'uz', 'Thailand': 'th', 'Vietnam': 'vn', 'Indonesia': 'id',
    'South Africa': 'za', 'DR Congo': 'cd', 'Guinea': 'gn', 'Gabon': 'ga', 'Angola': 'ao',
    'Cameroun': 'cm', 'Côte d\'Ivoire': 'ci', 'Cape Verde': 'cv', 'Comoros': 'km',
    'New Zealand': 'nz', 'India': 'in', 'Bangladesh': 'bd', 'Pakistan': 'pk',
    'Afghanistan': 'af', 'Philippines': 'ph', 'Malaysia': 'my', 'Singapore': 'sg',
    'Israel': 'il', 'Palestine': 'ps', 'Jordan': 'jo', 'Lebanon': 'lb', 'Syria': 'sy',
    'Kuwait': 'kw', 'Bahrain': 'bh', 'Oman': 'om', 'Yemen': 'ye',
    'Kazakhstan': 'kz', 'Kyrgyzstan': 'kg', 'Tajikistan': 'tj', 'Turkmenistan': 'tm',
    'Armenia': 'am', 'Azerbaijan': 'az', 'Georgia': 'ge', 'Belarus': 'by', 'Moldova': 'md',
    'Luxembourg': 'lu', 'Monaco': 'mc', 'Liechtenstein': 'li', 'San Marino': 'sm',
    'Andorra': 'ad', 'Malta': 'mt', 'Cyprus': 'cy',
    'Togo': 'tg', 'Benin': 'bj', 'Niger': 'ne', 'Chad': 'td', 'CAR': 'cf',
    'Equatorial Guinea': 'gq', 'Sao Tome and Principe': 'st', 'Mauritania': 'mr',
    'Gambia': 'gm', 'Sierra Leone': 'sl', 'Liberia': 'lr', 'Guinea-Bissau': 'gw',
    'Zimbabwe': 'zw', 'Zambia': 'zm', 'Mozambique': 'mz', 'Malawi': 'mw',
    'Botswana': 'bw', 'Namibia': 'na', 'Lesotho': 'ls', 'Eswatini': 'sz',
    'Madagascar': 'mg', 'Mauritius': 'mu', 'Seychelles': 'sc', 'Reunion': 're',
    'Kenya': 'ke', 'Uganda': 'ug', 'Tanzania': 'tz', 'Rwanda': 'rw', 'Burundi': 'bi',
    'Ethiopia': 'et', 'Eritrea': 'er', 'Djibouti': 'dj', 'Somalia': 'so', 'Sudan': 'sd',
    'South Sudan': 'ss', 'Libya': 'ly'
  };
  
  // Check if country is in map
  if (countryMap[countryName]) {
    return countryMap[countryName];
  }
  
  // Fallback: try to get first 2 letters as country code
  const code = countryName.toLowerCase().replace(/\s+/g, '').substring(0, 2);
  return code.length === 2 ? code : null;
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
                            let extra = fixture.status.extra;
                            
                            if (elapsed !== null && elapsed !== undefined) {
                                // Fix: If extra time seems wrong (e.g., extra > 45), calculate it correctly
                                if (extra && extra > 0) {
                                    // If extra is greater than elapsed, it might be the total time
                                    if (extra > elapsed) {
                                        extra = extra - elapsed;
                                    }
                                    // Limit extra time to reasonable values (max 15 minutes)
                                    if (extra > 15) {
                                        extra = extra % 45; // Get remainder after 45 minutes
                                        if (extra > 15) extra = 15;
                                    }
                                    if (extra > 0) {
                                        return `${elapsed}+${extra}'`;
                                    }
                                }
                                return `${elapsed}'`;
                            }
                            return '';
                        };

                        let timeHtml = isLive
                          ? `<span class="live-time" data-fixture-id="${f.fixture.id}"><span class="live-dot"></span>${getMatchTimeDisplay(f.fixture) || 'LIVE'}</span>`
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
// Live match time tracking
let liveMatchTimers = {};
let liveDataSyncInterval = null;

function renderFeaturedLive(live = []) {
  const box = document.getElementById("live-carousel-content");
  if (!box) return;
  if (!live.length) {
    box.innerHTML = `<div class="loading-placeholder">No live matches</div>`;
    return;
  }
  
  const fx = live[state.carouselIndex % live.length];
  
  // Clear existing timer for this match
  if (liveMatchTimers[fx.fixture.id]) {
    clearInterval(liveMatchTimers[fx.fixture.id]);
  }
  
  const getMatchTime = (fixture) => {
    const elapsed = fixture.status.elapsed;
    let extra = fixture.status.extra;
    
    if (elapsed !== null && elapsed !== undefined) {
      if (extra && extra > 0) {
        // Fix: If extra time seems wrong, calculate it correctly
        if (extra > elapsed) {
          extra = extra - elapsed;
        }
        // Limit extra time to reasonable values
        if (extra > 15) {
          extra = extra % 45;
          if (extra > 15) extra = 15;
        }
        if (extra > 0) {
          return { minutes: elapsed, extra: extra };
        }
      }
      return { minutes: elapsed, extra: 0 };
    }
    return null;
  };
  
  const timeData = getMatchTime(fx.fixture);
  const initialTime = timeData ? `${timeData.minutes}'${timeData.extra > 0 ? `+${timeData.extra}` : ''}` : 'LIVE';
  
  box.innerHTML = `
    <div class="live-match-card">
      <div class="live-match-league">${escapeHtml(fx.league.name)}</div>
      <div class="live-match-teams">
        <div class="live-team live-team-home">
          <img src="${fx.teams.home.logo}" class="live-team-logo" onerror="this.src='https://via.placeholder.com/80'">
          <div class="live-team-name">${escapeHtml(fx.teams.home.name)}</div>
        </div>
        <div class="live-match-score">
          <div class="live-score-numbers">
            <span class="live-score-home">${fx.goals.home ?? 0}</span>
            <span class="live-score-separator">:</span>
            <span class="live-score-away">${fx.goals.away ?? 0}</span>
          </div>
          <div class="live-match-time" id="live-time-${fx.fixture.id}">
            <span class="live-dot"></span>
            <span class="live-time-text">${initialTime}</span>
          </div>
          <button class="watch-live-btn" onclick="window.open('https://xoilac.tv', '_blank')">
            <i class="fa-solid fa-play"></i> Watch Live
          </button>
        </div>
        <div class="live-team live-team-away">
          <img src="${fx.teams.away.logo}" class="live-team-logo" onerror="this.src='https://via.placeholder.com/80'">
          <div class="live-team-name">${escapeHtml(fx.teams.away.name)}</div>
        </div>
      </div>
    </div>
  `;
  
  // Update display - increment minutes automatically
  if (timeData) {
    const baseMinutes = timeData.minutes;
    
    // Track when this match started (only set once per match)
    if (!matchStartTimes[fx.fixture.id]) {
      matchStartTimes[fx.fixture.id] = Date.now();
      console.log(`Match ${fx.fixture.id} start time recorded:`, new Date(matchStartTimes[fx.fixture.id]).toLocaleTimeString());
    }
    
    const matchStartTime = matchStartTimes[fx.fixture.id];
    
    // Update every second to ensure smooth minute transitions
    liveMatchTimers[fx.fixture.id] = setInterval(() => {
      const timeElement = document.getElementById(`live-time-${fx.fixture.id}`);
      if (timeElement) {
        const timeText = timeElement.querySelector('.live-time-text');
        if (timeText) {
          // Calculate minutes elapsed since this match was FIRST displayed
          const minutesElapsed = Math.floor((Date.now() - matchStartTime) / 60000);
          const currentMinutes = baseMinutes + minutesElapsed;
          const displayTime = `${currentMinutes}'${timeData.extra > 0 ? `+${timeData.extra}` : ''}`;
          timeText.textContent = displayTime;
        }
      }
    }, 1000); // Update every second to catch minute changes
  }
}

// Note: Live data is automatically refreshed when:
// 1. Page loads
// 2. Auto-rotate switches to next match (every 60 seconds)
// 3. User manually clicks prev/next arrows
// This ensures fresh data without interrupting the smooth timer

// Auto-rotate live matches every 15 seconds
let autoRotateInterval = null;

function startLiveMatchAutoRotate() {
  // Clear existing interval
  if (autoRotateInterval) {
    clearInterval(autoRotateInterval);
  }
  
  // Only start if there are multiple matches
  if (!state.lastLive || state.lastLive.length <= 1) {
    console.log('Auto-rotate: Not enough matches to rotate');
    return;
  }
  
  console.log(`Auto-rotate: Starting with ${state.lastLive.length} matches`);
  
  // Start new interval
  autoRotateInterval = setInterval(() => {
    if (state.lastLive && state.lastLive.length > 1) {
      const oldIndex = state.carouselIndex;
      state.carouselIndex = (state.carouselIndex + 1) % state.lastLive.length;
      console.log(`Auto-rotate: ${oldIndex} → ${state.carouselIndex}`);
      renderFeaturedLive(state.lastLive);
    }
  }, 60000); // 60 seconds (1 minute)
}

// Stop auto-rotate (call this when user manually navigates)
function stopLiveMatchAutoRotate() {
  if (autoRotateInterval) {
    console.log('Auto-rotate: Stopped');
    clearInterval(autoRotateInterval);
    autoRotateInterval = null;
  }
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
function renderSummary(match, period = 'all') {
  if (!Array.isArray(match.events) || !match.events.length) {
    return `<div class="loading-placeholder">No events</div>`;
  }

  // 根据period过滤事件
  let filteredEvents = match.events;
  if (period === '1st') {
    filteredEvents = match.events.filter(ev => {
      const elapsed = ev.time?.elapsed || 0;
      return elapsed <= 45;
    });
  } else if (period === '2nd') {
    filteredEvents = match.events.filter(ev => {
      const elapsed = ev.time?.elapsed || 0;
      return elapsed > 45;
    });
  }

  const rows = filteredEvents
    .map(ev => {
      const isHome = ev.team?.id === match.teams.home.id;
      const name = ev.player?.name || ev.assist?.name || ev.player_in?.name || ev.player_out?.name || "";

      if (!name) return null;

      let icon = '<img src="/images/icons/goal.svg" class="event-icon-img" alt="Goal">';
      if (ev.type === "Card") {
        icon = ev.detail === "Yellow Card" 
          ? '<img src="/images/icons/yellow-card.svg" class="event-icon-img" alt="Yellow Card">' 
          : '<img src="/images/icons/red-card.svg" class="event-icon-img" alt="Red Card">';
      }
      if (ev.type === "subst") {
        icon = '<img src="/images/icons/substitute-player.svg" class="event-icon-img" alt="Substitution">';
      }

      // 显示时间，包含加时时间
      let t = "";
      if (ev.time?.elapsed != null) {
        const elapsed = ev.time.elapsed;
        let extra = ev.time.extra;
        if (extra && extra > 0) {
          // Fix: If extra time seems wrong, calculate it correctly
          if (extra > elapsed) {
            extra = extra - elapsed;
          }
          // Limit extra time to reasonable values
          if (extra > 15) {
            extra = extra % 45;
            if (extra > 15) extra = 15;
          }
          if (extra > 0) {
            t = `${elapsed}+${extra}'`;
          } else {
            t = `${elapsed}'`;
          }
        } else {
          t = `${elapsed}'`;
        }
      }

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
    return `<div class="loading-placeholder">No events in this period</div>`;
  }

  return `
    <div class="events-container events-2col">
      ${rows.join("")}
    </div>
  `;
}
// Render stats
function renderStats(match, period = 'match') {
  if (!Array.isArray(match.statistics) || match.statistics.length < 2) {
    return `<div class="loading-placeholder">No stats</div>`;
  }

  // 根据period选择对应的统计数据
  let homeStats, awayStats;
  
  if (period === '1st') {
    // 查找1st half的统计数据
    const homeTeam = match.statistics.find(s => s.team?.id === match.teams.home.id);
    const awayTeam = match.statistics.find(s => s.team?.id === match.teams.away.id);
    
    // 如果有periods数据，使用1st half的数据
    if (homeTeam?.periods && homeTeam.periods['1st']) {
      homeStats = homeTeam.periods['1st'].statistics || [];
    } else {
      homeStats = homeTeam?.statistics || [];
    }
    
    if (awayTeam?.periods && awayTeam.periods['1st']) {
      awayStats = awayTeam.periods['1st'].statistics || [];
    } else {
      awayStats = awayTeam?.statistics || [];
    }
  } else if (period === '2nd') {
    // 查找2nd half的统计数据
    const homeTeam = match.statistics.find(s => s.team?.id === match.teams.home.id);
    const awayTeam = match.statistics.find(s => s.team?.id === match.teams.away.id);
    
    // 如果有periods数据，使用2nd half的数据
    if (homeTeam?.periods && homeTeam.periods['2nd']) {
      homeStats = homeTeam.periods['2nd'].statistics || [];
    } else {
      homeStats = homeTeam?.statistics || [];
    }
    
    if (awayTeam?.periods && awayTeam.periods['2nd']) {
      awayStats = awayTeam.periods['2nd'].statistics || [];
    } else {
      awayStats = awayTeam?.statistics || [];
    }
  } else {
    // MATCH - 显示全场统计
    homeStats = match.statistics[0]?.statistics || [];
    awayStats = match.statistics[1]?.statistics || [];
  }

  // 定义所有统计类型分组
  const statGroups = {
    "TOP STATS": [
      { type: "expected_goals", label: "Expected goals (xG)", format: "decimal" },
      { type: "Ball Possession", label: "Ball Possession", format: "percent" },
      { type: "Total Shots", label: "Total Shots", format: "number" },
      { type: "Shots on Goal", label: "Shots on Target", format: "number" },
      { type: "Big Chances", label: "Big Chances", format: "number" },
      { type: "Corner Kicks", label: "Corner Kicks", format: "number" },
      { type: "passes_percentage", label: "Passes", format: "passes" },
      { type: "Yellow Cards", label: "Yellow Cards", format: "number" }
    ],
    "SHOTS": [
      { type: "expected_goals", label: "Expected goals (xG)", format: "decimal" },
      { type: "xg_on_target", label: "xG on target (xGOT)", format: "decimal" },
      { type: "Total Shots", label: "Total Shots", format: "number" },
      { type: "Shots on Goal", label: "Shots on Target", format: "number" },
      { type: "Shots off Goal", label: "Shots off Target", format: "number" },
      { type: "Blocked Shots", label: "Blocked Shots", format: "number" },
      { type: "Shots insidebox", label: "Shots inside the Box", format: "number" },
      { type: "Shots outsidebox", label: "Shots outside the Box", format: "number" },
      { type: "Hit woodwork", label: "Hit the Woodwork", format: "number" },
      { type: "headed_goals", label: "Headed Goals", format: "number" }
    ],
    "ATTACK": [
      { type: "Big Chances", label: "Big Chances", format: "number" },
      { type: "Corner Kicks", label: "Corner Kicks", format: "number" },
      { type: "touches_in_opposition_box", label: "Touches in Opposition Box", format: "number" },
      { type: "accurate_through_passes", label: "Accurate Through Passes", format: "number" },
      { type: "Offsides", label: "Offsides", format: "number" },
      { type: "free_kicks", label: "Free Kicks", format: "number" }
    ],
    "PASSES": [
      { type: "passes_percentage", label: "Passes", format: "passes" },
      { type: "long_passes", label: "Long Passes", format: "passes_detail" },
      { type: "passes_in_final_third", label: "Passes in Final Third", format: "passes_detail" },
      { type: "crosses", label: "Crosses", format: "passes_detail" },
      { type: "expected_assists", label: "Expected Assists (xA)", format: "decimal" },
      { type: "throw_ins", label: "Throw Ins", format: "number" }
    ],
    "DEFENSE": [
      { type: "Fouls", label: "Fouls", format: "number" },
      { type: "tackles", label: "Tackles", format: "tackles" },
      { type: "duels_won", label: "Duels Won", format: "number" },
      { type: "Clearances", label: "Clearances", format: "number" },
      { type: "interceptions", label: "Interceptions", format: "number" },
      { type: "errors_leading_to_shot", label: "Errors Leading to Shot", format: "number" },
      { type: "errors_leading_to_goal", label: "Errors Leading to Goal", format: "number" }
    ],
    "GOALKEEPING": [
      { type: "Goalkeeper Saves", label: "Goalkeeper Saves", format: "number" },
      { type: "xgot_faced", label: "xGOT Faced", format: "decimal" },
      { type: "goals_prevented", label: "Goals Prevented", format: "decimal" }
    ]
  };

  const getValNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v.replace("%","")) || 0;
    return 0;
  };

  const getStat = (stats, type) => {
    return stats.find(s => s.type === type)?.value ?? null;
  };

  const renderStatGroup = (title, statTypes) => {
    const items = statTypes.map(({ type, label, format }) => {
      const hRaw = getStat(homeStats, type);
      const aRaw = getStat(awayStats, type);

      if (hRaw === null && aRaw === null) return '';

      const h = getValNum(hRaw);
      const a = getValNum(aRaw);

      const total = (h + a) || 1;
      const hPct = Math.round((h / total) * 100);
      const aPct = 100 - hPct;

      const homeLead = h > a;
      const awayLead = a > h;

      // 格式化显示值
      let hDisplay = hRaw;
      let aDisplay = aRaw;
      
      if (format === "passes") {
        const hTotal = getStat(homeStats, "Total passes");
        const aTotal = getStat(awayStats, "Total passes");
        const hAcc = getStat(homeStats, "Passes accurate");
        const aAcc = getStat(awayStats, "Passes accurate");
        if (hAcc && hTotal) {
          const hPercent = Math.round((getValNum(hAcc)/getValNum(hTotal))*100);
          hDisplay = `${hPercent}%\n(${hAcc}/${hTotal})`;
        }
        if (aAcc && aTotal) {
          const aPercent = Math.round((getValNum(aAcc)/getValNum(aTotal))*100);
          aDisplay = `${aPercent}%\n(${aAcc}/${aTotal})`;
        }
      } else if (format === "passes_detail") {
        const hTotal = getStat(homeStats, type.replace('_', ' ') + ' total');
        const hAcc = getStat(homeStats, type.replace('_', ' ') + ' accurate');
        if (hAcc && hTotal) {
          const hPercent = Math.round((getValNum(hAcc)/getValNum(hTotal))*100);
          hDisplay = `${hPercent}%\n(${hAcc}/${hTotal})`;
        }
        const aTotal = getStat(awayStats, type.replace('_', ' ') + ' total');
        const aAcc = getStat(awayStats, type.replace('_', ' ') + ' accurate');
        if (aAcc && aTotal) {
          const aPercent = Math.round((getValNum(aAcc)/getValNum(aTotal))*100);
          aDisplay = `${aPercent}%\n(${aAcc}/${aTotal})`;
        }
      } else if (format === "tackles") {
        const hTotal = getStat(homeStats, "Total tackles");
        const hSuccess = getStat(homeStats, "tackles_successful");
        if (hSuccess && hTotal) {
          const hPercent = Math.round((getValNum(hSuccess)/getValNum(hTotal))*100);
          hDisplay = `${hPercent}%\n(${hSuccess}/${hTotal})`;
        }
        const aTotal = getStat(awayStats, "Total tackles");
        const aSuccess = getStat(awayStats, "tackles_successful");
        if (aSuccess && aTotal) {
          const aPercent = Math.round((getValNum(aSuccess)/getValNum(aTotal))*100);
          aDisplay = `${aPercent}%\n(${aSuccess}/${aTotal})`;
        }
      } else if (format === "decimal") {
        hDisplay = h.toFixed(2);
        aDisplay = a.toFixed(2);
      }

      return `
        <div class="stat-item-enhanced">
          <div class="stat-values">
            <span class="stat-value-left ${homeLead ? "lead" : ""}">${escapeHtml(String(hDisplay)).replace('\n', '<br>')}</span>
            <span class="stat-label">${escapeHtml(label)}</span>
            <span class="stat-value-right ${awayLead ? "lead" : ""}">${escapeHtml(String(aDisplay)).replace('\n', '<br>')}</span>
          </div>
          <div class="stat-bar-split-fixed">
            <div class="stat-bar-half stat-bar-left">
              <div class="stat-bar-fill ${homeLead ? "lead" : ""}" style="width:${hPct}%"></div>
            </div>
            <div class="stat-bar-half stat-bar-right">
              <div class="stat-bar-fill ${awayLead ? "lead" : ""}" style="width:${aPct}%"></div>
            </div>
          </div>
        </div>
      `;
    }).filter(Boolean);

    if (items.length === 0) return '';

    return `
      <div class="stats-group">
        <div class="stats-group-title">${title}</div>
        ${items.join("")}
      </div>
    `;
  };

  return `
    <div class="stats-container-enhanced">
      ${Object.entries(statGroups).map(([title, stats]) => renderStatGroup(title, stats)).filter(Boolean).join("")}
    </div>
  `;
}

// Render lineups
function renderLineups(match) {
  const lineups = match.lineups;
  if (!Array.isArray(lineups) || lineups.length < 2) {
    return `<div class="loading-placeholder">No lineups</div>`;
  }

  const home = lineups.find(x => x.team?.id === match.teams.home.id) || lineups[0];
  const away = lineups.find(x => x.team?.id === match.teams.away.id) || lineups[1];

  // Pitch view rendering
  const renderPitchView = () => {
    const renderSide = (team, isHome) => {
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

        // Calculate positions for horizontal pitch
        const verticalSpan = 80; // 10% to 90%
        const verticalMin = 10;
        const verticalStep = (count <= 1) ? 0 : verticalSpan / (count - 1);

        return rowPlayers.map((item, i) => {
          const pl = item.player;
          
          // Horizontal position (left to right)
          const horizontalPos = isHome ? (row * 9) : (100 - row * 9);
          
          // Vertical position (top to bottom)
          const verticalPos = (count <= 1) ? 50 : verticalMin + verticalStep * i;
          
          const rating = pl.rating ? parseFloat(pl.rating) : null;
          const ratingColor = rating ? (
            rating >= 8.0 ? '#00e676' :
            rating >= 7.0 ? '#76ff03' :
            rating >= 6.5 ? '#ffa726' : '#ff5252'
          ) : null;

          return `
            <div class="player-dot-horizontal ${isHome ? "home-p" : "away-p"}"
                 style="left:${horizontalPos}%; top:${verticalPos}%;">
              ${rating ? `<div class="player-rating-badge" style="background: ${ratingColor}">${rating}</div>` : ''}
              <div class="player-shirt">${pl.number ?? ""}</div>
              <div class="player-name-horizontal">
                ${escapeHtml(pl.name.split(" ").slice(-1)[0])}
              </div>
            </div>
          `;
        }).join("");
      }).join("");
    };

    return `
      <div class="pitch-horizontal-container">
        <div class="pitch-header">
          <div class="pitch-team-info home-info">
            <img src="${home.team.logo}" class="pitch-team-logo">
            <span class="pitch-team-name">${escapeHtml(home.team.name)}</span>
            <span class="pitch-formation">${home.formation || "N/A"}</span>
          </div>
          
          <div class="pitch-title">FORMATION</div>
          
          <div class="pitch-team-info away-info">
            <span class="pitch-formation">${away.formation || "N/A"}</span>
            <span class="pitch-team-name">${escapeHtml(away.team.name)}</span>
            <img src="${away.team.logo}" class="pitch-team-logo">
          </div>
        </div>
        
        <div class="pitch-horizontal">
          <div class="pitch-markings-horizontal">
            <div class="center-line-h"></div>
            <div class="center-circle-h"></div>
            <div class="penalty-area-h left"></div>
            <div class="penalty-area-h right"></div>
            <div class="goal-area-h left"></div>
            <div class="goal-area-h right"></div>
            <div class="corner-arc top-left"></div>
            <div class="corner-arc top-right"></div>
            <div class="corner-arc bottom-left"></div>
            <div class="corner-arc bottom-right"></div>
          </div>

          ${renderSide(home, true)}
          ${renderSide(away, false)}
        </div>
      </div>
    `;
  };

  // List view rendering
  const renderPlayerRow = (player, showRating = true) => {
    const number = player.number ?? '-';
    const name = player.name || 'Unknown';
    const photo = player.photo || null;
    const rating = player.rating || null;
    
    return `
      <div class="lineup-player-row">
        <div class="lineup-player-info">
          ${photo ? `<img src="${photo}" class="lineup-player-photo" alt="${escapeHtml(name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
          <div class="lineup-player-avatar" style="display: ${photo ? 'none' : 'flex'}">
            <i class="fa-solid fa-user"></i>
          </div>
          <span class="lineup-player-name">${escapeHtml(name)}</span>
        </div>
        <div class="lineup-player-number">${number}</div>
        ${showRating && rating ? `<div class="lineup-player-rating" style="background: ${getRatingColor(rating)}">${rating}</div>` : ''}
      </div>
    `;
  };

  const renderSubstitution = (sub) => {
    const playerIn = sub.player;
    const playerOut = sub.assist;
    const time = sub.time?.elapsed || '-';
    const photo = playerIn.photo || null;
    
    return `
      <div class="lineup-sub-row">
        <div class="lineup-sub-player">
          ${photo ? `<img src="${photo}" class="lineup-sub-photo" alt="${escapeHtml(playerIn.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
          <div class="lineup-sub-avatar" style="display: ${photo ? 'none' : 'flex'}">
            <i class="fa-solid fa-user"></i>
          </div>
          <div class="lineup-sub-info">
            <span class="lineup-sub-name">${escapeHtml(playerIn.name)}</span>
            <span class="lineup-sub-detail"><i class="fa-solid fa-arrow-rotate-left"></i> ${escapeHtml(playerOut?.name || 'Unknown')} ${time}'</span>
          </div>
        </div>
        <div class="lineup-sub-number">${playerIn.number ?? '-'}</div>
      </div>
    `;
  };

  const getRatingColor = (rating) => {
    const r = parseFloat(rating);
    if (r >= 8.0) return '#00e676';
    if (r >= 7.0) return '#76ff03';
    if (r >= 6.5) return '#ffa726';
    return '#ff5252';
  };

  const renderTeamLineup = (team, isHome) => {
    const startXI = team.startXI || [];
    const substitutes = team.substitutes || [];
    
    // Get substitution events from match events
    const teamId = team.team.id;
    const substitutions = (match.events || []).filter(ev => 
      ev.type === 'subst' && 
      (ev.team.id === teamId)
    );

    return `
      <div class="lineup-team-section">
        <div class="lineup-team-header">
          <img src="${team.team.logo}" class="lineup-team-logo">
          <div class="lineup-team-info">
            <h3>${escapeHtml(team.team.name)}</h3>
            <span class="lineup-formation">${team.formation || 'N/A'}</span>
          </div>
        </div>

        <div class="lineup-section">
          <h4 class="lineup-section-title">STARTING XI</h4>
          <div class="lineup-players-list">
            ${startXI.map(p => renderPlayerRow(p.player, true)).join('')}
          </div>
        </div>

        ${substitutions.length > 0 ? `
          <div class="lineup-section">
            <h4 class="lineup-section-title">SUBSTITUTED PLAYERS</h4>
            <div class="lineup-subs-list">
              ${substitutions.map(sub => renderSubstitution(sub)).join('')}
            </div>
          </div>
        ` : ''}

        ${substitutes.length > 0 ? `
          <div class="lineup-section">
            <h4 class="lineup-section-title">SUBSTITUTES</h4>
            <div class="lineup-players-list">
              ${substitutes.map(p => renderPlayerRow(p.player, false)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };

  const renderListView = () => {
    return `
      <div class="lineups-container-new">
        <div class="lineups-grid">
          ${renderTeamLineup(home, true)}
          ${renderTeamLineup(away, false)}
        </div>
      </div>
    `;
  };

  return `
    <div class="lineups-wrapper">
      <div class="lineups-view-toggle">
        <button class="lineup-view-btn active" data-view="pitch">
          <i class="fa-solid fa-futbol"></i> FORMATION
        </button>
        <button class="lineup-view-btn" data-view="list">
          <i class="fa-solid fa-list"></i> PLAYERS
        </button>
      </div>
      
      <div class="lineups-views">
        <div class="lineup-view-content active" data-view="pitch">
          ${renderPitchView()}
        </div>
        <div class="lineup-view-content" data-view="list">
          ${renderListView()}
        </div>
      </div>
    </div>
  `;
}

// Render H2H (Head to Head)
async function renderH2H(match) {
  const homeId = match.teams.home.id;
  const awayId = match.teams.away.id;
  const h2hParam = `${homeId}-${awayId}`;
  
  try {
    // Fetch H2H data
    const h2hData = await apiGetJSON(`/api/h2h?h2h=${h2hParam}`);
    
    if (!h2hData || h2hData.length === 0) {
      return `
        <div class="h2h-container">
          <div class="h2h-header">
            <h3><i class="fa-solid fa-trophy"></i> Head to Head</h3>
            <p class="h2h-subtitle">Recent matches between these teams</p>
          </div>
          <div class="h2h-placeholder">
            <i class="fa-solid fa-chart-line"></i>
            <p>No head-to-head data available</p>
          </div>
        </div>
      `;
    }
    
    // Separate matches by team
    const homeTeamMatches = [];
    const awayTeamMatches = [];
    const h2hMatches = [];
    
    h2hData.forEach(fixture => {
      const isH2H = (fixture.teams.home.id === homeId && fixture.teams.away.id === awayId) ||
                    (fixture.teams.home.id === awayId && fixture.teams.away.id === homeId);
      
      if (isH2H) {
        h2hMatches.push(fixture);
      } else if (fixture.teams.home.id === homeId || fixture.teams.away.id === homeId) {
        homeTeamMatches.push(fixture);
      } else if (fixture.teams.home.id === awayId || fixture.teams.away.id === awayId) {
        awayTeamMatches.push(fixture);
      }
    });
    
    const renderMatchRow = (fixture, highlightTeamId) => {
      const date = new Date(fixture.fixture.date);
      const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const homeGoals = fixture.goals.home ?? 0;
      const awayGoals = fixture.goals.away ?? 0;
      
      let resultClass = '';
      if (fixture.teams.home.id === highlightTeamId) {
        resultClass = homeGoals > awayGoals ? 'win' : homeGoals < awayGoals ? 'loss' : 'draw';
      } else if (fixture.teams.away.id === highlightTeamId) {
        resultClass = awayGoals > homeGoals ? 'win' : awayGoals < homeGoals ? 'loss' : 'draw';
      }
      
      return `
        <div class="h2h-match-row">
          <div class="h2h-date">${dateStr}</div>
          <div class="h2h-league">
            <img src="${fixture.league.flag || fixture.league.logo}" class="h2h-flag" alt="${escapeHtml(fixture.league.country)}">
            <span>${escapeHtml(fixture.league.name)}</span>
          </div>
          <div class="h2h-teams">
            <div class="h2h-team-name">
              <img src="${fixture.teams.home.logo}" class="h2h-team-logo">
              <span>${escapeHtml(fixture.teams.home.name)}</span>
            </div>
            <div class="h2h-score">${homeGoals} - ${awayGoals}</div>
            <div class="h2h-team-name">
              <img src="${fixture.teams.away.logo}" class="h2h-team-logo">
              <span>${escapeHtml(fixture.teams.away.name)}</span>
            </div>
          </div>
          <div class="h2h-result ${resultClass}">${resultClass.toUpperCase()[0] || '-'}</div>
        </div>
      `;
    };
    
    return `
      <div class="h2h-container">
        <div class="h2h-header">
          <h3><i class="fa-solid fa-trophy"></i> Head to Head</h3>
          <p class="h2h-subtitle">Recent matches between these teams</p>
        </div>
        
        <div class="h2h-tabs">
          <button class="h2h-tab active" data-section="overall">OVERALL</button>
          <button class="h2h-tab" data-section="home">${escapeHtml(match.teams.home.name).toUpperCase()} - HOME</button>
          <button class="h2h-tab" data-section="away">${escapeHtml(match.teams.away.name).toUpperCase()} - AWAY</button>
        </div>
        
        <div class="h2h-content">
          <div class="h2h-section active" data-section="overall">
            ${h2hMatches.length > 0 ? `
              <h4>HEAD-TO-HEAD MATCHES</h4>
              ${h2hMatches.slice(0, 10).map(f => renderMatchRow(f, null)).join('')}
            ` : '<p class="h2h-no-data">No head-to-head matches found</p>'}
          </div>
          
          <div class="h2h-section" data-section="home">
            <h4>LAST MATCHES: ${escapeHtml(match.teams.home.name).toUpperCase()}</h4>
            ${homeTeamMatches.slice(0, 5).map(f => renderMatchRow(f, homeId)).join('')}
          </div>
          
          <div class="h2h-section" data-section="away">
            <h4>LAST MATCHES: ${escapeHtml(match.teams.away.name).toUpperCase()}</h4>
            ${awayTeamMatches.slice(0, 5).map(f => renderMatchRow(f, awayId)).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('H2H error:', err);
    return `
      <div class="h2h-container">
        <div class="h2h-header">
          <h3><i class="fa-solid fa-trophy"></i> Head to Head</h3>
        </div>
        <div class="h2h-placeholder">
          <i class="fa-solid fa-exclamation-triangle"></i>
          <p>Error loading head-to-head data</p>
        </div>
      </div>
    `;
  }
}

// Render Standings
async function renderStandings(match) {
  const leagueId = match.league.id;
  const season = match.league.season;
  
  try {
    // Fetch standings data
    const standingsData = await apiGetJSON(`/api/standings?league=${leagueId}&season=${season}`);
    
    if (!standingsData || standingsData.length === 0) {
      return `
        <div class="standings-container">
          <div class="standings-header">
            <h3><i class="fa-solid fa-ranking-star"></i> League Standings</h3>
            <p class="standings-subtitle">${escapeHtml(match.league.name)} - ${season}</p>
          </div>
          <div class="standings-placeholder">
            <i class="fa-solid fa-table"></i>
            <p>No standings data available</p>
          </div>
        </div>
      `;
    }
    
    const standings = standingsData[0]?.league?.standings?.[0] || [];
    
    if (standings.length === 0) {
      return `
        <div class="standings-container">
          <div class="standings-header">
            <h3><i class="fa-solid fa-ranking-star"></i> League Standings</h3>
            <p class="standings-subtitle">${escapeHtml(match.league.name)} - ${season}</p>
          </div>
          <div class="standings-placeholder">
            <i class="fa-solid fa-table"></i>
            <p>No standings data available</p>
          </div>
        </div>
      `;
    }
    
    const homeTeamId = match.teams.home.id;
    const awayTeamId = match.teams.away.id;
    
    const renderFormBadge = (form) => {
      if (!form) return '';
      return form.split('').slice(-5).map(result => {
        const className = result === 'W' ? 'win' : result === 'L' ? 'loss' : 'draw';
        return `<span class="form-badge ${className}">${result}</span>`;
      }).join('');
    };
    
    return `
      <div class="standings-container">
        <div class="standings-header">
          <h3><i class="fa-solid fa-ranking-star"></i> League Standings</h3>
          <p class="standings-subtitle">${escapeHtml(match.league.name)} - ${season}</p>
        </div>
        
        <div class="standings-table">
          <div class="standings-table-header">
            <div class="st-rank">#</div>
            <div class="st-team">TEAM</div>
            <div class="st-stat">MP</div>
            <div class="st-stat">W</div>
            <div class="st-stat">D</div>
            <div class="st-stat">L</div>
            <div class="st-stat">G</div>
            <div class="st-stat">GD</div>
            <div class="st-stat">PTS</div>
            <div class="st-form">FORM</div>
          </div>
          
          ${standings.map(team => {
            const isHomeTeam = team.team.id === homeTeamId;
            const isAwayTeam = team.team.id === awayTeamId;
            const highlightClass = isHomeTeam || isAwayTeam ? 'highlight' : '';
            
            return `
              <div class="standings-table-row ${highlightClass}">
                <div class="st-rank">
                  <span class="rank-number" style="background: ${team.rank <= 4 ? '#00e676' : team.rank <= 6 ? '#2196f3' : team.rank >= standings.length - 2 ? '#ff3b3b' : 'transparent'}">${team.rank}</span>
                </div>
                <div class="st-team">
                  <img src="${team.team.logo}" class="st-team-logo">
                  <span>${escapeHtml(team.team.name)}</span>
                </div>
                <div class="st-stat">${team.all.played}</div>
                <div class="st-stat">${team.all.win}</div>
                <div class="st-stat">${team.all.draw}</div>
                <div class="st-stat">${team.all.lose}</div>
                <div class="st-stat">${team.all.goals.for}:${team.all.goals.against}</div>
                <div class="st-stat ${team.goalsDiff > 0 ? 'positive' : team.goalsDiff < 0 ? 'negative' : ''}">${team.goalsDiff > 0 ? '+' : ''}${team.goalsDiff}</div>
                <div class="st-stat st-points">${team.points}</div>
                <div class="st-form">${renderFormBadge(team.form)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Standings error:', err);
    return `
      <div class="standings-container">
        <div class="standings-header">
          <h3><i class="fa-solid fa-ranking-star"></i> League Standings</h3>
        </div>
        <div class="standings-placeholder">
          <i class="fa-solid fa-exclamation-triangle"></i>
          <p>Error loading standings data</p>
        </div>
      </div>
    `;
  }
}

// Match detail panel logic
async function openMatchDetails(matchId, rowElement) {
    // 创建或获取模态框
    let modal = document.getElementById('match-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'match-detail-modal';
        modal.className = 'match-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="match-modal-overlay"></div>
        <div class="match-modal-content">
            <button class="modal-close-btn">
                <i class="fa-solid fa-times"></i>
            </button>
            <div class="modal-body">
                <div class="inline-loader">
                    <div class="loading-spinner"></div>
                    <p>Loading match details...</p>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // 关闭按钮事件
    const closeBtn = modal.querySelector('.modal-close-btn');
    const overlay = modal.querySelector('.match-modal-overlay');
    
    const closeModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    };
    
    closeBtn.onclick = closeModal;
    overlay.onclick = closeModal;

    const modalBody = modal.querySelector('.modal-body');

    try {
        const result = await Promise.race([
            apiGetJSON(`/api/fixture-detail?id=${matchId}`),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 3000)
            )
        ]);
        
        const match = extractMatch(result);

        if (!match) {
            modalBody.innerHTML = `
                <div class="error-message">
                    <i class="fa-solid fa-exclamation-triangle"></i>
                    <h3>No Data Available</h3>
                    <p>Unable to load match details</p>
                    <button class="retry-btn" onclick="openMatchDetails(${matchId}, null)">
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

        modalBody.innerHTML = `
            <div class="match-header-inline">
                <div class="teams-score">
                    <div class="team-info">
                        <i class="fa-regular fa-star team-favorite-star" 
                           data-team-id="${match.teams.home.id}" 
                           data-team-name="${escapeHtml(match.teams.home.name)}" 
                           data-team-logo="${match.teams.home.logo}"
                           data-team-country="${escapeHtml(match.league.country || '')}"
                           title="Add to My Favorite Teams"></i>
                        <img src="${match.teams.home.logo}" class="team-logo-md clickable-team-logo" 
                             data-team-id="${match.teams.home.id}" 
                             data-team-name="${escapeHtml(match.teams.home.name)}" 
                             data-team-logo="${match.teams.home.logo}"
                             data-team-country="${escapeHtml(match.league.country || '')}">
                        <span class="team-name clickable-team-name" 
                              data-team-id="${match.teams.home.id}" 
                              data-team-name="${escapeHtml(match.teams.home.name)}" 
                              data-team-logo="${match.teams.home.logo}"
                              data-team-country="${escapeHtml(match.league.country || '')}">${escapeHtml(match.teams.home.name)}</span>
                    </div>
                    <div class="score-display">
                        ${match.goals.home !== null ? `${match.goals.home} - ${match.goals.away}` : 'VS'}
                        <div class="match-status">${match.fixture.status.long}</div>
                    </div>
                    <div class="team-info">
                        <span class="team-name clickable-team-name" 
                              data-team-id="${match.teams.away.id}" 
                              data-team-name="${escapeHtml(match.teams.away.name)}" 
                              data-team-logo="${match.teams.away.logo}"
                              data-team-country="${escapeHtml(match.league.country || '')}">${escapeHtml(match.teams.away.name)}</span>
                        <img src="${match.teams.away.logo}" class="team-logo-md clickable-team-logo" 
                             data-team-id="${match.teams.away.id}" 
                             data-team-name="${escapeHtml(match.teams.away.name)}" 
                             data-team-logo="${match.teams.away.logo}"
                             data-team-country="${escapeHtml(match.league.country || '')}">
                        <i class="fa-regular fa-star team-favorite-star" 
                           data-team-id="${match.teams.away.id}" 
                           data-team-name="${escapeHtml(match.teams.away.name)}" 
                           data-team-logo="${match.teams.away.logo}"
                           data-team-country="${escapeHtml(match.league.country || '')}"
                           title="Add to My Favorite Teams"></i>
                    </div>
                </div>
            </div>
            ${tabsHtml}
            <div class="detail-body" id="inline-content-${matchId}">
               ${contentHtml}
            </div>
        `;

        // Bind main tab events
        modalBody.querySelectorAll('.d-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = btn.dataset.target;
                const contentEl = document.getElementById(`inline-content-${matchId}`);
                
                modalBody.querySelectorAll('.d-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const subTabs = modalBody.querySelector('.detail-sub-tabs');
                if (target === 'match' && isFinishedMatch) {
                    if (subTabs) subTabs.style.display = 'block';
                } else {
                    if (subTabs) subTabs.style.display = 'none';
                }
                
                contentEl.innerHTML = '<div class="tab-loading"><div class="loading-spinner"></div></div>';
                
                setTimeout(async () => {
                    if (target === "match") {
                        if (isScheduledMatch) contentEl.innerHTML = renderScheduledContent(match);
                        else if (isLiveMatch) contentEl.innerHTML = renderLiveContent(match);
                        else if (isFinishedMatch) contentEl.innerHTML = renderSummary(match);
                    } else if (target === "odds") {
                        contentEl.innerHTML = renderComingSoon("Odds data will be available soon");
                    } else if (target === "h2h") {
                        contentEl.innerHTML = await renderH2H(match);
                        // Bind H2H tab events
                        contentEl.querySelectorAll('.h2h-tab').forEach(tab => {
                            tab.addEventListener('click', () => {
                                contentEl.querySelectorAll('.h2h-tab').forEach(t => t.classList.remove('active'));
                                tab.classList.add('active');
                                const section = tab.dataset.section;
                                contentEl.querySelectorAll('.h2h-section').forEach(s => {
                                    s.classList.toggle('active', s.dataset.section === section);
                                });
                            });
                        });
                    } else if (target === "standings") {
                        contentEl.innerHTML = await renderStandings(match);
                    }
                }, 100);
            });
        });

        // Bind sub-tab events for finished matches
        if (isFinishedMatch) {
            modalBody.querySelectorAll('.d-sub-tab').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const target = btn.dataset.target;
                    const contentEl = document.getElementById(`inline-content-${matchId}`);
                    
                    modalBody.querySelectorAll('.d-sub-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    contentEl.innerHTML = '<div class="tab-loading"><div class="loading-spinner"></div></div>';
                    
                    setTimeout(() => {
                        if (target === "summary") contentEl.innerHTML = renderSummary(match);
                        else if (target === "stats") contentEl.innerHTML = renderStats(match);
                        else if (target === "lineups") {
                            contentEl.innerHTML = renderLineups(match);
                            
                            // Bind lineup view toggle buttons
                            contentEl.querySelectorAll('.lineup-view-btn').forEach(viewBtn => {
                                viewBtn.addEventListener('click', () => {
                                    const view = viewBtn.dataset.view;
                                    
                                    // Update button states
                                    contentEl.querySelectorAll('.lineup-view-btn').forEach(b => b.classList.remove('active'));
                                    viewBtn.classList.add('active');
                                    
                                    // Update view content
                                    contentEl.querySelectorAll('.lineup-view-content').forEach(v => {
                                        v.classList.toggle('active', v.dataset.view === view);
                                    });
                                });
                            });
                        }
                    }, 100);
                });
            });
        }

        // Bind Live Events period tabs for live matches
        if (isLiveMatch) {
            modalBody.querySelectorAll('.live-event-tab').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const period = btn.dataset.period;
                    const eventsContent = modalBody.querySelector('.live-events-content');
                    
                    modalBody.querySelectorAll('.live-event-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    eventsContent.innerHTML = '<div class="tab-loading"><div class="loading-spinner"></div></div>';
                    
                    setTimeout(() => {
                        eventsContent.innerHTML = renderSummary(match, period);
                    }, 100);
                });
            });
            
            // Bind Live Stats period tabs for live matches
            modalBody.querySelectorAll('.stats-period-tab').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const period = btn.dataset.period;
                    const statsContent = modalBody.querySelector('.stats-content');
                    
                    modalBody.querySelectorAll('.stats-period-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    statsContent.innerHTML = '<div class="tab-loading"><div class="loading-spinner"></div></div>';
                    
                    setTimeout(() => {
                        statsContent.innerHTML = renderStats(match, period);
                    }, 100);
                });
            });
        }

        // Add event listeners for clickable team names and logos
        modalBody.querySelectorAll('.clickable-team-name, .clickable-team-logo').forEach(el => {
            el.addEventListener('click', () => {
                const teamId = parseInt(el.dataset.teamId);
                const teamName = el.dataset.teamName;
                const teamLogo = el.dataset.teamLogo;
                const teamCountry = el.dataset.teamCountry;
                
                closeModal(); // Close match detail modal first
                showTeamDetails({ id: teamId, name: teamName, logo: teamLogo, country: teamCountry });
            });
        });

        // Add event listeners for favorite stars
        modalBody.querySelectorAll('.team-favorite-star').forEach(star => {
            const teamId = parseInt(star.dataset.teamId);
            const teamName = star.dataset.teamName;
            const teamLogo = star.dataset.teamLogo;
            const teamCountry = star.dataset.teamCountry;
            
            // Check if team is already pinned
            const pinnedTeamsData = JSON.parse(localStorage.getItem('pinnedTeamsData') || '{}');
            if (pinnedTeamsData[teamId]) {
                star.classList.remove('fa-regular');
                star.classList.add('fa-solid');
            }
            
            star.addEventListener('click', () => {
                const pinnedTeamsData = JSON.parse(localStorage.getItem('pinnedTeamsData') || '{}');
                
                if (pinnedTeamsData[teamId]) {
                    // Unpin team
                    delete pinnedTeamsData[teamId];
                    state.pinnedTeams.delete(teamId);
                    star.classList.remove('fa-solid');
                    star.classList.add('fa-regular');
                    star.title = 'Add to My Favorite Teams';
                } else {
                    // Pin team
                    pinnedTeamsData[teamId] = { id: teamId, name: teamName, logo: teamLogo, country: teamCountry };
                    state.pinnedTeams.add(teamId);
                    star.classList.remove('fa-regular');
                    star.classList.add('fa-solid');
                    star.title = 'Remove from My Favorite Teams';
                }
                
                // Update both localStorage keys
                localStorage.setItem('pinnedTeamsData', JSON.stringify(pinnedTeamsData));
                localStorage.setItem('pinnedTeams', JSON.stringify([...state.pinnedTeams]));
                
                // Refresh pinned teams display
                if (typeof renderPinnedTeams === 'function') {
                    renderPinnedTeams();
                }
            });
        });

    } catch (err) {
        console.error('Match detail error:', err);
        modalBody.innerHTML = `
            <div class="error-message">
                <i class="fa-solid fa-wifi"></i>
                <h3>Connection Error</h3>
                <p>Please check your connection and try again</p>
                <button class="retry-btn" onclick="openMatchDetails(${matchId}, null)">
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
            
            <div class="live-stats-section">
                <div class="live-stats-header-row">
                    <div class="live-stats-title">
                        <i class="fa-solid fa-chart-bar"></i>
                        <h3>LIVE STATS</h3>
                    </div>
                    <a href="https://xoigac.tv/" target="_blank" class="watch-live-btn">
                        <i class="fa-solid fa-play"></i>
                        WATCH LIVE
                    </a>
                </div>
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
      startLiveMatchAutoRotate(); // Start auto-rotate
      startFixturesTimeUpdate(); // Start auto-updating fixtures times
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
  document.getElementById("carousel-prev")?.addEventListener("click", () => { 
    stopLiveMatchAutoRotate(); 
    state.carouselIndex = state.carouselIndex > 0 ? state.carouselIndex - 1 : 0; 
    renderFeaturedLive(state.lastLive); 
    startLiveMatchAutoRotate(); 
  });
  document.getElementById("carousel-next")?.addEventListener("click", () => { 
    stopLiveMatchAutoRotate(); 
    state.carouselIndex++; 
    renderFeaturedLive(state.lastLive); 
    startLiveMatchAutoRotate(); 
  });

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
      // 忽略操作按钮区域的点击
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
      startLiveMatchAutoRotate(); // Start auto-rotate
      
      if (state.tab === 'all' || state.tab === 'live') {
        renderFixtures(state.lastFixtures, state.lastLive);
      }
    }
  });
}, 15000);

// ========== MY TEAMS FUNCTIONALITY ==========

// Default popular teams (for display only, not auto-pinned)
const POPULAR_TEAMS = [
  { id: 33, name: "Manchester United", logo: "https://media.api-sports.io/football/teams/33.png", country: "England" },
  { id: 40, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png", country: "England" },
  { id: 529, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png", country: "Spain" },
  { id: 541, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png", country: "Spain" },
  { id: 50, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png", country: "England" },
  { id: 42, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png", country: "England" },
  { id: 49, name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png", country: "England" },
  { id: 85, name: "Paris Saint Germain", logo: "https://media.api-sports.io/football/teams/85.png", country: "France" },
  { id: 157, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png", country: "Germany" },
  { id: 496, name: "Juventus", logo: "https://media.api-sports.io/football/teams/496.png", country: "Italy" },
  { id: 47, name: "Tottenham", logo: "https://media.api-sports.io/football/teams/47.png", country: "England" },
  { id: 489, name: "AC Milan", logo: "https://media.api-sports.io/football/teams/489.png", country: "Italy" },
  { id: 492, name: "Napoli", logo: "https://media.api-sports.io/football/teams/492.png", country: "Italy" },
  { id: 165, name: "Borussia Dortmund", logo: "https://media.api-sports.io/football/teams/165.png", country: "Germany" },
  { id: 81, name: "Marseille", logo: "https://media.api-sports.io/football/teams/81.png", country: "France" },
  { id: 548, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/548.png", country: "Spain" },
  { id: 530, name: "Sevilla", logo: "https://media.api-sports.io/football/teams/530.png", country: "Spain" },
  { id: 532, name: "Valencia", logo: "https://media.api-sports.io/football/teams/532.png", country: "Spain" },
  { id: 497, name: "AS Roma", logo: "https://media.api-sports.io/football/teams/497.png", country: "Italy" },
  { id: 487, name: "Lazio", logo: "https://media.api-sports.io/football/teams/487.png", country: "Italy" },
  { id: 505, name: "Inter", logo: "https://media.api-sports.io/football/teams/505.png", country: "Italy" },
  { id: 173, name: "RB Leipzig", logo: "https://media.api-sports.io/football/teams/173.png", country: "Germany" },
  { id: 168, name: "Bayer Leverkusen", logo: "https://media.api-sports.io/football/teams/168.png", country: "Germany" },
  { id: 79, name: "Lille", logo: "https://media.api-sports.io/football/teams/79.png", country: "France" },
  { id: 80, name: "Lyon", logo: "https://media.api-sports.io/football/teams/80.png", country: "France" },
  { id: 83, name: "Monaco", logo: "https://media.api-sports.io/football/teams/83.png", country: "France" },
  { id: 34, name: "Newcastle", logo: "https://media.api-sports.io/football/teams/34.png", country: "England" },
  { id: 66, name: "Aston Villa", logo: "https://media.api-sports.io/football/teams/66.png", country: "England" },
  { id: 48, name: "West Ham", logo: "https://media.api-sports.io/football/teams/48.png", country: "England" },
  { id: 35, name: "Bournemouth", logo: "https://media.api-sports.io/football/teams/35.png", country: "England" },
  { id: 39, name: "Wolves", logo: "https://media.api-sports.io/football/teams/39.png", country: "England" },
  { id: 45, name: "Everton", logo: "https://media.api-sports.io/football/teams/45.png", country: "England" },
  { id: 36, name: "Fulham", logo: "https://media.api-sports.io/football/teams/36.png", country: "England" },
  { id: 51, name: "Brighton", logo: "https://media.api-sports.io/football/teams/51.png", country: "England" },
  { id: 543, name: "Real Betis", logo: "https://media.api-sports.io/football/teams/543.png", country: "Spain" },
  { id: 727, name: "Atalanta", logo: "https://media.api-sports.io/football/teams/727.png", country: "Italy" },
  { id: 499, name: "Fiorentina", logo: "https://media.api-sports.io/football/teams/499.png", country: "Italy" },
  { id: 169, name: "Eintracht Frankfurt", logo: "https://media.api-sports.io/football/teams/169.png", country: "Germany" },
  { id: 172, name: "VfB Stuttgart", logo: "https://media.api-sports.io/football/teams/172.png", country: "Germany" },
  // Saudi Pro League
  { id: 2939, name: "Al-Nassr FC", logo: "https://media.api-sports.io/football/teams/2939.png", country: "Saudi Arabia" },
  { id: 2932, name: "Al-Hilal", logo: "https://media.api-sports.io/football/teams/2932.png", country: "Saudi Arabia" },
  { id: 2938, name: "Al-Ittihad", logo: "https://media.api-sports.io/football/teams/2938.png", country: "Saudi Arabia" },
  // MLS
  { id: 9568, name: "Inter Miami CF", logo: "https://media.api-sports.io/football/teams/9568.png", country: "USA" },
  { id: 1605, name: "LA Galaxy", logo: "https://media.api-sports.io/football/teams/1605.png", country: "USA" },
  // Other leagues
  { id: 127, name: "Flamengo", logo: "https://media.api-sports.io/football/teams/127.png", country: "Brazil" },
  { id: 121, name: "Palmeiras", logo: "https://media.api-sports.io/football/teams/121.png", country: "Brazil" },
  { id: 451, name: "Boca Juniors", logo: "https://media.api-sports.io/football/teams/451.png", country: "Argentina" },
  { id: 435, name: "River Plate", logo: "https://media.api-sports.io/football/teams/435.png", country: "Argentina" },
  { id: 3670, name: "Ha Noi", logo: "https://media.api-sports.io/football/teams/3670.png", country: "Vietnam" },
  { id: 3681, name: "Viettel", logo: "https://media.api-sports.io/football/teams/3681.png", country: "Vietnam" }
];

// All searchable teams cache
let allTeamsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Search history
const MAX_SEARCH_HISTORY = 5;

function getSearchHistory() {
  return JSON.parse(localStorage.getItem("teamSearchHistory") || "[]");
}

function addToSearchHistory(team) {
  let history = getSearchHistory();
  
  // Remove if already exists
  history = history.filter(t => t.id !== team.id);
  
  // Add to beginning
  history.unshift(team);
  
  // Keep only last MAX_SEARCH_HISTORY items
  history = history.slice(0, MAX_SEARCH_HISTORY);
  
  localStorage.setItem("teamSearchHistory", JSON.stringify(history));
}

// Render pinned teams
function renderPinnedTeams() {
  const container = document.getElementById("pinned-teams");
  if (!container) return;
  
  if (state.pinnedTeams.size === 0) {
    container.innerHTML = '<div class="text-[10px] text-gray-700 px-2 italic">No pinned teams</div>';
    return;
  }
  
  // Get team details from localStorage
  const pinnedTeamsData = JSON.parse(localStorage.getItem("pinnedTeamsData") || "{}");
  
  let html = "";
  state.pinnedTeams.forEach(teamId => {
    const team = pinnedTeamsData[teamId];
    if (team) {
      html += `
        <li class="pinned-team-item" data-team-id="${team.id}" style="cursor: pointer;">
          <div class="pinned-team-content">
            <img src="${team.logo}" class="pinned-team-logo">
            <div class="pinned-team-info">
              <span class="pinned-team-name">${escapeHtml(team.name)}</span>
              <span class="pinned-team-country">${escapeHtml(team.country || 'Unknown')}</span>
            </div>
          </div>
          <button class="team-unpin-btn" data-team-id="${team.id}" title="Unpin team">
            <i class="fa-solid fa-star"></i>
          </button>
        </li>
      `;
    }
  });
  
  container.innerHTML = html;
  
  // Bind click events to open team details
  container.querySelectorAll('.pinned-team-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't open if clicking the unpin button
      if (e.target.closest('.team-unpin-btn')) return;
      
      const teamId = parseInt(item.dataset.teamId);
      const team = pinnedTeamsData[teamId];
      if (team) {
        showTeamDetails(team);
      }
    });
  });
  
  // Bind unpin events
  container.querySelectorAll('.team-unpin-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const teamId = parseInt(btn.dataset.teamId);
      state.pinnedTeams.delete(teamId);
      
      // Update localStorage
      const pinnedTeamsData = JSON.parse(localStorage.getItem("pinnedTeamsData") || "{}");
      delete pinnedTeamsData[teamId];
      localStorage.setItem("pinnedTeamsData", JSON.stringify(pinnedTeamsData));
      localStorage.setItem("pinnedTeams", JSON.stringify([...state.pinnedTeams]));
      
      renderPinnedTeams();
    });
  });
}

// Search teams from API
let searchTimeout;
async function searchTeams(query) {
  if (query.length < 2) return { teams: [], source: 'none' };
  
  try {
    const queryLower = query.toLowerCase();
    
    // Search using real API
    const response = await fetch(`/api/teams/search?name=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    const apiResults = [];
    if (data && Array.isArray(data)) {
      data.forEach(item => {
        if (item.team && item.team.name.toLowerCase().includes(queryLower)) {
          apiResults.push({
            id: item.team.id,
            name: item.team.name,
            logo: item.team.logo,
            country: item.team.country
          });
        }
      });
    }
    
    // Also search in POPULAR_TEAMS
    const popularResults = POPULAR_TEAMS.filter(team => 
      team.name.toLowerCase().includes(queryLower)
    );
    
    // Combine results: popular first, then API results
    const combined = [...popularResults];
    const popularIds = new Set(popularResults.map(t => t.id));
    
    apiResults.forEach(team => {
      if (!popularIds.has(team.id)) {
        combined.push(team);
      }
    });
    
    // Sort results: teams starting with query first, then others
    combined.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(queryLower);
      const bStarts = b.name.toLowerCase().startsWith(queryLower);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // If both start with query or both don't, sort alphabetically
      return a.name.localeCompare(b.name);
    });
    
    return { 
      teams: combined.slice(0, 30), 
      source: apiResults.length > 0 ? 'api' : 'popular' 
    };
  } catch (err) {
    console.error('Search teams error:', err);
    // Fallback to POPULAR_TEAMS
    const queryLower = query.toLowerCase();
    const popularResults = POPULAR_TEAMS.filter(team => 
      team.name.toLowerCase().includes(queryLower)
    );
    
    // Sort fallback results too
    popularResults.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(queryLower);
      const bStarts = b.name.toLowerCase().startsWith(queryLower);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      return a.name.localeCompare(b.name);
    });
    
    return { teams: popularResults.slice(0, 20), source: 'popular' };
  }
}

// Show add team modal
function showAddTeamModal() {
  const searchHistory = getSearchHistory();
  
  const modal = document.createElement('div');
  modal.className = 'team-search-modal';
  modal.innerHTML = `
    <div class="team-search-content">
      <div class="team-search-header">
        <h3><i class="fa-solid fa-magnifying-glass"></i> Search Teams</h3>
        <button class="team-search-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      
      <div class="team-search-body">
        <input type="text" class="team-search-input" placeholder="Type to search teams..." autofocus>
        <div class="team-search-hint">
          <i class="fa-solid fa-circle-info"></i> Please type at least 2 characters. The results will start displaying here immediately.
        </div>
        
        ${searchHistory.length > 0 ? `
          <div class="team-search-history">
            <div class="team-search-section-header">
              <h4>RECENT SEARCHES</h4>
              <button class="clear-all-history-btn" title="Clear all search history">
                <i class="fa-solid fa-trash"></i> Clear All
              </button>
            </div>
            <div class="team-search-results">
              ${searchHistory.slice(0, 5).map(team => `
                <div class="team-search-item" data-team-id="${team.id}">
                  <img src="${team.logo}" class="team-search-logo">
                  <div class="team-search-info">
                    <span class="team-search-name">${escapeHtml(team.name)}</span>
                    <span class="team-search-country">${escapeHtml(team.country)}</span>
                  </div>
                  <div class="team-search-actions">
                    <button class="team-delete-btn" 
                            data-team-id="${team.id}"
                            title="Remove from history">
                      <i class="fa-solid fa-times"></i>
                    </button>
                    <button class="team-star-btn ${state.pinnedTeams.has(team.id) ? 'active' : ''}" 
                            data-team-id="${team.id}"
                            data-team-name="${escapeHtml(team.name)}"
                            data-team-logo="${team.logo}"
                            data-team-country="${escapeHtml(team.country)}">
                      <i class="fa-${state.pinnedTeams.has(team.id) ? 'solid' : 'regular'} fa-star"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="team-search-popular">
          <h4>MOST POPULAR TEAMS</h4>
          <div class="team-search-results">
            ${POPULAR_TEAMS.map(team => `
              <div class="team-search-item" data-team-id="${team.id}">
                <img src="${team.logo}" class="team-search-logo">
                <div class="team-search-info">
                  <span class="team-search-name">${escapeHtml(team.name)}</span>
                  <span class="team-search-country">${escapeHtml(team.country)}</span>
                </div>
                <button class="team-star-btn ${state.pinnedTeams.has(team.id) ? 'active' : ''}" 
                        data-team-id="${team.id}"
                        data-team-name="${escapeHtml(team.name)}"
                        data-team-logo="${team.logo}"
                        data-team-country="${escapeHtml(team.country)}">
                  <i class="fa-${state.pinnedTeams.has(team.id) ? 'solid' : 'regular'} fa-star"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal
  const closeBtn = modal.querySelector('.team-search-close');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Search functionality
  const searchInput = modal.querySelector('.team-search-input');
  const resultsContainer = modal.querySelector('.team-search-results');
  const popularSection = modal.querySelector('.team-search-popular');
  
  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    // Hide search history when typing
    const historySection = modal.querySelector('.team-search-history');
    if (historySection) {
      historySection.style.display = query.length > 0 ? 'none' : 'block';
    }
    
    // Get or create temp results container
    const searchResultsSection = modal.querySelector('.team-search-body');
    let tempResultsContainer = modal.querySelector('.temp-search-results');
    
    if (query.length < 2) {
      // Remove temp results container if it exists
      if (tempResultsContainer) {
        tempResultsContainer.remove();
      }
      
      // Show popular teams and history
      popularSection.style.display = 'block';
      popularSection.querySelector('h4').textContent = 'MOST POPULAR TEAMS';
      const popularResults = popularSection.querySelector('.team-search-results');
      popularResults.innerHTML = POPULAR_TEAMS.map(team => `
        <div class="team-search-item" data-team-id="${team.id}">
          <img src="${team.logo}" class="team-search-logo">
          <div class="team-search-info">
            <span class="team-search-name">${escapeHtml(team.name)}</span>
            <span class="team-search-country">${escapeHtml(team.country)}</span>
          </div>
          <button class="team-star-btn ${state.pinnedTeams.has(team.id) ? 'active' : ''}" 
                  data-team-id="${team.id}"
                  data-team-name="${escapeHtml(team.name)}"
                  data-team-logo="${team.logo}"
                  data-team-country="${escapeHtml(team.country)}">
            <i class="fa-${state.pinnedTeams.has(team.id) ? 'solid' : 'regular'} fa-star"></i>
          </button>
        </div>
      `).join('');
      bindStarButtons();
      return;
    }
    
    // Hide popular teams section when searching
    popularSection.style.display = 'none';
    
    // Create temp results container if it doesn't exist
    if (!tempResultsContainer) {
      tempResultsContainer = document.createElement('div');
      tempResultsContainer.className = 'temp-search-results';
      tempResultsContainer.innerHTML = `
        <div class="team-search-section-header">
          <h4>SEARCH RESULTS</h4>
        </div>
        <div class="team-search-results"></div>
      `;
      searchResultsSection.appendChild(tempResultsContainer);
    }
    
    const tempResults = tempResultsContainer.querySelector('.team-search-results');
    tempResults.innerHTML = '<div class="team-search-loading"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>';
    
    searchTimeout = setTimeout(async () => {
      const result = await searchTeams(query);
      let teams = result.teams || [];
      
      // Filter: prioritize teams that START with the query
      const queryLower = query.toLowerCase();
      
      // Separate teams into two groups: starts with query, and contains query
      const startsWithQuery = teams.filter(team => 
        team.name.toLowerCase().startsWith(queryLower)
      );
      
      const containsQuery = teams.filter(team => {
        const nameLower = team.name.toLowerCase();
        return nameLower.includes(queryLower) && !nameLower.startsWith(queryLower);
      });
      
      // Combine: teams starting with query first, then others
      teams = [...startsWithQuery, ...containsQuery];
      
      console.log(`Search for "${query}" returned ${teams.length} teams:`, teams.map(t => t.name));
      console.log(`- Starts with "${query}": ${startsWithQuery.length}`, startsWithQuery.map(t => t.name));
      console.log(`- Contains "${query}": ${containsQuery.length}`, containsQuery.map(t => t.name));
      
      if (teams.length === 0) {
        tempResults.innerHTML = '<div class="team-search-empty">No teams found. Try a different search term.</div>';
      } else {
        tempResults.innerHTML = teams.map(team => `
          <div class="team-search-item" data-team-id="${team.id}">
            <img src="${team.logo}" class="team-search-logo">
            <div class="team-search-info">
              <span class="team-search-name">${escapeHtml(team.name)}</span>
              <span class="team-search-country">${escapeHtml(team.country)}</span>
            </div>
            <button class="team-star-btn ${state.pinnedTeams.has(team.id) ? 'active' : ''}" 
                    data-team-id="${team.id}"
                    data-team-name="${escapeHtml(team.name)}"
                    data-team-logo="${team.logo}"
                    data-team-country="${escapeHtml(team.country)}">
              <i class="fa-${state.pinnedTeams.has(team.id) ? 'solid' : 'regular'} fa-star"></i>
            </button>
          </div>
        `).join('');
      }
      
      bindStarButtons();
    }, 300); // Reduced debounce to 300ms
  });
  
  // Bind star buttons
  function bindStarButtons() {
    // Bind delete history buttons
    modal.querySelectorAll('.team-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const teamId = parseInt(btn.dataset.teamId);
        
        // Remove from search history
        let searchHistory = JSON.parse(localStorage.getItem('teamSearchHistory') || '[]');
        searchHistory = searchHistory.filter(t => t.id !== teamId);
        localStorage.setItem('teamSearchHistory', JSON.stringify(searchHistory));
        
        // Update the history section without closing modal
        const historySection = modal.querySelector('.team-search-history');
        if (searchHistory.length === 0) {
          // Remove history section if empty
          if (historySection) {
            historySection.remove();
          }
        } else {
          // Update history section
          const historyResults = historySection.querySelector('.team-search-results');
          historyResults.innerHTML = searchHistory.slice(0, 5).map(team => `
            <div class="team-search-item" data-team-id="${team.id}">
              <img src="${team.logo}" class="team-search-logo">
              <div class="team-search-info">
                <span class="team-search-name">${escapeHtml(team.name)}</span>
                <span class="team-search-country">${escapeHtml(team.country)}</span>
              </div>
              <div class="team-search-actions">
                <button class="team-delete-btn" 
                        data-team-id="${team.id}"
                        title="Remove from history">
                  <i class="fa-solid fa-times"></i>
                </button>
                <button class="team-star-btn ${state.pinnedTeams.has(team.id) ? 'active' : ''}" 
                        data-team-id="${team.id}"
                        data-team-name="${escapeHtml(team.name)}"
                        data-team-logo="${team.logo}"
                        data-team-country="${escapeHtml(team.country)}">
                  <i class="fa-${state.pinnedTeams.has(team.id) ? 'solid' : 'regular'} fa-star"></i>
                </button>
              </div>
            </div>
          `).join('');
          
          // Re-bind events for new elements
          bindStarButtons();
        }
      });
    });
    
    // Bind clear all history button
    const clearAllBtn = modal.querySelector('.clear-all-history-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        localStorage.setItem('teamSearchHistory', '[]');
        
        // Remove history section
        const historySection = modal.querySelector('.team-search-history');
        if (historySection) {
          historySection.remove();
        }
      });
    }
    
    // Bind star button clicks
    modal.querySelectorAll('.team-star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const teamId = parseInt(btn.dataset.teamId);
        const teamName = btn.dataset.teamName;
        const teamLogo = btn.dataset.teamLogo;
        const teamCountry = btn.dataset.teamCountry;
        
        // Get existing teams data
        const pinnedTeamsData = JSON.parse(localStorage.getItem("pinnedTeamsData") || "{}");
        
        if (state.pinnedTeams.has(teamId)) {
          // Unpin
          state.pinnedTeams.delete(teamId);
          delete pinnedTeamsData[teamId];
          btn.classList.remove('active');
          btn.innerHTML = '<i class="fa-regular fa-star"></i>';
        } else {
          // Pin
          state.pinnedTeams.add(teamId);
          pinnedTeamsData[teamId] = {
            id: teamId,
            name: teamName,
            logo: teamLogo,
            country: teamCountry
          };
          btn.classList.add('active');
          btn.innerHTML = '<i class="fa-solid fa-star"></i>';
          
          // Add to search history
          addToSearchHistory({ id: teamId, name: teamName, logo: teamLogo, country: teamCountry });
        }
        
        // Save to localStorage
        localStorage.setItem("pinnedTeamsData", JSON.stringify(pinnedTeamsData));
        localStorage.setItem("pinnedTeams", JSON.stringify([...state.pinnedTeams]));
        renderPinnedTeams();
      });
    });
    
    // Bind team item clicks to open details
    modal.querySelectorAll('.team-search-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't open if clicking the star button
        if (e.target.closest('.team-star-btn')) return;
        
        const teamId = parseInt(item.dataset.teamId);
        const teamName = item.querySelector('.team-search-name').textContent;
        const teamLogo = item.querySelector('.team-search-logo').src;
        const teamCountry = item.querySelector('.team-search-country').textContent;
        
        // Add to search history
        addToSearchHistory({ id: teamId, name: teamName, logo: teamLogo, country: teamCountry });
        
        // Close search modal
        modal.remove();
        
        // Open team details
        showTeamDetails({ id: teamId, name: teamName, logo: teamLogo, country: teamCountry });
      });
    });
  }
  
  bindStarButtons();
}

// Initialize MY TEAMS
document.addEventListener('DOMContentLoaded', () => {
  renderPinnedTeams();
  
  const addTeamBtn = document.getElementById('add-team-btn');
  if (addTeamBtn) {
    addTeamBtn.addEventListener('click', showAddTeamModal);
  }
});


// Show team details in center column (not modal)
function showTeamDetails(team) {
  // Hide fixtures view
  document.getElementById('fixtures-view').classList.add('hidden');
  document.getElementById('league-page').classList.add('hidden');
  document.getElementById('player-details-view').classList.add('hidden');
  
  // Show team details view
  const teamView = document.getElementById('team-details-view');
  teamView.classList.remove('hidden');
  
  const content = document.getElementById('team-details-content');
  content.innerHTML = `
    <div class="team-detail-header">
      <img src="${team.logo}" class="team-detail-logo">
      <div class="team-detail-info">
        <h1>${escapeHtml(team.name)}</h1>
        <div class="team-detail-meta">
          <span><i class="fa-solid fa-flag"></i> ${escapeHtml(team.country)}</span>
        </div>
      </div>
    </div>
    
    <div class="detail-tabs">
      <button class="detail-tab active" data-tab="fixtures">Fixtures</button>
      <button class="detail-tab" data-tab="results">Recent Result</button>
      <button class="detail-tab" data-tab="standings">Standings</button>
      <button class="detail-tab" data-tab="players">Players</button>
      <button class="detail-tab" data-tab="statistics">Statistics</button>
      <button class="detail-tab" data-tab="details">Details</button>
    </div>
    
    <div class="detail-tab-content active" id="team-tab-fixtures">
      <div class="loading-placeholder">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <div>Loading fixtures...</div>
      </div>
    </div>
    <div class="detail-tab-content" id="team-tab-results"></div>
    <div class="detail-tab-content" id="team-tab-standings"></div>
    <div class="detail-tab-content" id="team-tab-players"></div>
    <div class="detail-tab-content" id="team-tab-statistics"></div>
    <div class="detail-tab-content" id="team-tab-details"></div>
  `;
  
  // Tab switching
  const tabs = content.querySelectorAll('.detail-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabName = tab.dataset.tab;
      
      // Hide all tab contents
      content.querySelectorAll('.detail-tab-content').forEach(tc => tc.classList.remove('active'));
      
      // Show selected tab content
      const tabContent = content.querySelector(`#team-tab-${tabName}`);
      tabContent.classList.add('active');
      
      // Load content if not already loaded
      if (!tabContent.dataset.loaded) {
        loadTeamTabContent(team, tabName, tabContent);
      }
    });
  });
  
  // Load initial tab
  const initialTab = content.querySelector('#team-tab-fixtures');
  loadTeamTabContent(team, 'fixtures', initialTab);
}

// Close team details view
function closeTeamDetailsView() {
  document.getElementById('team-details-view').classList.add('hidden');
  document.getElementById('fixtures-view').classList.remove('hidden');
}

// Load team tab content
async function loadTeamTabContent(team, tabName, container) {
  container.innerHTML = `
    <div class="loading-placeholder">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <div>Loading ${tabName}...</div>
    </div>
  `;
  
  try {
    switch(tabName) {
      case 'fixtures':
        await renderTeamFixtures(team, container);
        break;
      case 'results':
        await renderTeamResults(team, container);
        break;
      case 'standings':
        await renderTeamStandings(team, container);
        break;
      case 'players':
        await renderTeamPlayers(team, container);
        break;
      case 'statistics':
        await renderTeamStatistics(team, container);
        break;
      case 'details':
        await renderTeamDetailsInfo(team, container);
        break;
    }
    container.dataset.loaded = 'true';
  } catch (err) {
    console.error('Error loading team tab:', err);
    container.innerHTML = `
      <div class="loading-placeholder">
        <i class="fa-solid fa-circle-exclamation"></i>
        <div>Failed to load ${tabName}. Please try again.</div>
      </div>
    `;
  }
}

// Render team fixtures (upcoming matches)
async function renderTeamFixtures(team, container) {
  try {
    console.log('Loading fixtures for team:', team.id, team.name);
    const response = await fetch(`/api/teams/${team.id}/fixtures`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fixtures data received:', data);
    console.log('Total fixtures:', data.fixtures?.length || 0);
    
    const fixtures = data.fixtures || [];
    
    console.log('Total fixtures received:', fixtures.length);
    
    if (fixtures.length === 0) {
      container.innerHTML = `
        <div class="loading-placeholder">
          <i class="fa-solid fa-info-circle"></i>
          <div>No fixtures data available</div>
          <div style="font-size: 11px; color: #7b8794; margin-top: 6px;">Season data may not be available yet</div>
        </div>
      `;
      return;
    }
    
    // Filter upcoming matches and sort by date (earliest first)
    const upcoming = fixtures
      .filter(f => f.fixture.status.short === 'NS' || f.fixture.status.short === 'TBD')
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date))
      .slice(0, 20);
    
    console.log('Upcoming fixtures:', upcoming.length);
    if (upcoming.length > 0) {
      console.log('Next fixture date:', upcoming[0].fixture.date);
    }
    
    if (upcoming.length === 0) {
      container.innerHTML = `
        <div class="loading-placeholder">
          <i class="fa-solid fa-info-circle"></i>
          <div>No upcoming fixtures</div>
          <div style="font-size: 11px; color: #7b8794; margin-top: 6px;">All fixtures may have been completed</div>
        </div>
      `;
      return;
    }
    
    // Group by league
    const byLeague = {};
    upcoming.forEach(f => {
      const leagueName = f.league.name;
      if (!byLeague[leagueName]) {
        byLeague[leagueName] = [];
      }
      byLeague[leagueName].push(f);
    });
    
    let html = '';
    Object.entries(byLeague).forEach(([leagueName, matches]) => {
      html += `
        <div class="fixtures-league-group">
          <div class="fixtures-league-header">
            <img src="${matches[0].league.logo}" style="width: 20px; height: 20px; object-fit: contain; margin-right: 8px;">
            <span>${escapeHtml(leagueName)}</span>
          </div>
          ${matches.map(f => {
            const date = new Date(f.fixture.date);
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
            const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            return `
              <div class="fixture-card">
                <div class="fixture-date-time">
                  <div class="fixture-date">${dateStr}</div>
                  <div class="fixture-time">${timeStr}</div>
                </div>
                <div class="fixture-match">
                  <div class="fixture-team">
                    <img src="${f.teams.home.logo}" alt="${f.teams.home.name}">
                    <span>${escapeHtml(f.teams.home.name)}</span>
                  </div>
                  <div class="fixture-vs">-</div>
                  <div class="fixture-team">
                    <img src="${f.teams.away.logo}" alt="${f.teams.away.name}">
                    <span>${escapeHtml(f.teams.away.name)}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading team fixtures:', err);
    container.innerHTML = '<div class="team-details-loading"><div>Failed to load fixtures</div></div>';
  }
}

// Render team results (finished matches)
async function renderTeamResults(team, container) {
  try {
    console.log('Loading results for team:', team.id, team.name);
    const response = await fetch(`/api/teams/${team.id}/fixtures`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const fixtures = data.fixtures || [];
    
    console.log('Total fixtures received:', fixtures.length);
    
    if (fixtures.length === 0) {
      container.innerHTML = `
        <div class="loading-placeholder">
          <i class="fa-solid fa-info-circle"></i>
          <div>No results data available</div>
          <div style="font-size: 11px; color: #7b8794; margin-top: 6px;">Season data may not be available yet</div>
        </div>
      `;
      return;
    }
    
    // Filter finished matches and sort by date (newest first)
    const results = fixtures
      .filter(f => f.fixture.status.short === 'FT')
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 20);
    
    console.log('Finished matches found:', results.length);
    if (results.length > 0) {
      console.log('Latest result date:', results[0].fixture.date);
      console.log('Oldest result date:', results[results.length - 1].fixture.date);
    }
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="loading-placeholder">
          <i class="fa-solid fa-info-circle"></i>
          <div>No recent results</div>
          <div style="font-size: 11px; color: #7b8794; margin-top: 6px;">No completed matches found</div>
        </div>
      `;
      return;
    }
    
    // Group by league
    const byLeague = {};
    results.forEach(f => {
      const leagueName = f.league.name;
      if (!byLeague[leagueName]) {
        byLeague[leagueName] = [];
      }
      byLeague[leagueName].push(f);
    });
    
    let html = '';
    Object.entries(byLeague).forEach(([leagueName, matches]) => {
      html += `
        <div class="fixtures-league-group">
          <div class="fixtures-league-header">
            <img src="${matches[0].league.logo}" style="width: 20px; height: 20px; object-fit: contain; margin-right: 8px;">
            <span>${escapeHtml(leagueName)}</span>
          </div>
          ${matches.map(f => {
            const date = new Date(f.fixture.date);
            const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            // Determine result (W/D/L) from team's perspective
            let result = '';
            let resultClass = '';
            const isHome = f.teams.home.id === team.id;
            const isAway = f.teams.away.id === team.id;
            
            if (isHome) {
              if (f.goals.home > f.goals.away) {
                result = 'W';
                resultClass = 'result-win';
              } else if (f.goals.home < f.goals.away) {
                result = 'L';
                resultClass = 'result-loss';
              } else {
                result = 'D';
                resultClass = 'result-draw';
              }
            } else if (isAway) {
              if (f.goals.away > f.goals.home) {
                result = 'W';
                resultClass = 'result-win';
              } else if (f.goals.away < f.goals.home) {
                result = 'L';
                resultClass = 'result-loss';
              } else {
                result = 'D';
                resultClass = 'result-draw';
              }
            }
            
            return `
              <div class="fixture-card">
                <div class="fixture-date-time">
                  <div class="fixture-date">${dateStr}</div>
                </div>
                <div class="fixture-match">
                  <div class="fixture-team">
                    <img src="${f.teams.home.logo}" alt="${f.teams.home.name}">
                    <span>${escapeHtml(f.teams.home.name)}</span>
                  </div>
                  <div class="fixture-score">${f.goals.home} - ${f.goals.away}</div>
                  <div class="fixture-team">
                    <img src="${f.teams.away.logo}" alt="${f.teams.away.name}">
                    <span>${escapeHtml(f.teams.away.name)}</span>
                  </div>
                </div>
                ${result ? `<div class="fixture-result ${resultClass}">${result}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading team results:', err);
    container.innerHTML = '<div class="team-details-loading"><div>Failed to load results</div></div>';
  }
}

// Render team summary (fixtures and results) - DEPRECATED, keeping for compatibility
async function renderTeamSummary(team, container) {
  await renderTeamFixtures(team, container);
}

// Render team standings
async function renderTeamStandings(team, container) {
  try {
    const response = await fetch(`/api/teams/${team.id}/standings`);
    const data = await response.json();
    
    if (!data.standings || data.standings.length === 0) {
      container.innerHTML = '<div class="team-details-loading"><div>No standings available</div></div>';
      return;
    }
    
    // Store standings data globally for tab switching
    window.currentStandingsData = data.standings;
    window.currentTeamId = team.id;
    
    // Create league dropdown and tabs
    const leagueOptions = data.standings.map((standing, index) => 
      `<option value="${index}">${escapeHtml(standing.league.name)} - ${standing.league.season}</option>`
    ).join('');
    
    let html = `
      <div class="standings-controls">
        <select class="standings-league-select" onchange="updateStandingsLeague(this.value)">
          ${leagueOptions}
        </select>
        
        <div class="standings-tabs">
          <button class="standings-tab active" data-type="all" onclick="updateStandingsType('all', this)">OVERALL</button>
          <button class="standings-tab" data-type="home" onclick="updateStandingsType('home', this)">HOME</button>
          <button class="standings-tab" data-type="away" onclick="updateStandingsType('away', this)">AWAY</button>
        </div>
      </div>
      
      <div id="standings-content"></div>
    `;
    
    container.innerHTML = html;
    
    // Render first league by default
    renderStandingsTable(0, 'all');
    
  } catch (err) {
    console.error('Error loading team standings:', err);
    container.innerHTML = '<div class="team-details-loading"><div>Failed to load standings</div></div>';
  }
}

// Render standings table for selected league and type
function renderStandingsTable(leagueIndex, type) {
  const standing = window.currentStandingsData[leagueIndex];
  let leagueStandings = standing.league.standings[0];
  const teamId = window.currentTeamId;
  
  // Create a copy and recalculate points and ranking based on type
  leagueStandings = leagueStandings.map(s => {
    const stats = type === 'all' ? s.all : (type === 'home' ? s.home : s.away);
    // Calculate points based on selected type
    const points = (stats.win * 3) + stats.draw;
    // Calculate goal difference
    const goalsDiff = stats.goals.for - stats.goals.against;
    
    return {
      ...s,
      displayPoints: points,
      displayGoalsDiff: goalsDiff,
      displayStats: stats
    };
  });
  
  // Sort by points, then goal difference, then goals scored
  leagueStandings.sort((a, b) => {
    if (b.displayPoints !== a.displayPoints) {
      return b.displayPoints - a.displayPoints;
    }
    if (b.displayGoalsDiff !== a.displayGoalsDiff) {
      return b.displayGoalsDiff - a.displayGoalsDiff;
    }
    return b.displayStats.goals.for - a.displayStats.goals.for;
  });
  
  const contentDiv = document.getElementById('standings-content');
  
  const html = `
    <div class="standings-container">
      <div class="standings-table-wrapper">
        <table class="standings-table">
          <thead>
            <tr>
              <th class="standings-rank">#</th>
              <th class="standings-team">TEAM</th>
              <th>MP</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>G</th>
              <th>GD</th>
              <th>PTS</th>
              <th>FORM</th>
            </tr>
          </thead>
          <tbody>
            ${leagueStandings.map((s, index) => {
              const stats = s.displayStats;
              const rank = index + 1;
              
              // Determine row color based on rank position
              let rankClass = '';
              if (rank <= 4) {
                rankClass = 'rank-champions';
              } else if (rank <= 6) {
                rankClass = 'rank-europa';
              } else if (rank >= leagueStandings.length - 2) {
                rankClass = 'rank-relegation';
              }
              
              const isCurrentTeam = s.team.id === teamId;
              
              return `
                <tr class="${rankClass} ${isCurrentTeam ? 'current-team' : ''}">
                  <td class="standings-rank">
                    <div class="rank-badge ${rankClass}">${rank}</div>
                  </td>
                  <td class="standings-team">
                    <div class="team-cell">
                      <img src="${s.team.logo}" alt="${s.team.name}">
                      <span>${escapeHtml(s.team.name)}</span>
                    </div>
                  </td>
                  <td>${stats.played}</td>
                  <td>${stats.win}</td>
                  <td>${stats.draw}</td>
                  <td>${stats.lose}</td>
                  <td>${stats.goals.for}:${stats.goals.against}</td>
                  <td>${s.displayGoalsDiff > 0 ? '+' : ''}${s.displayGoalsDiff}</td>
                  <td class="standings-points">${s.displayPoints}</td>
                  <td class="standings-form">
                    ${s.form ? s.form.split('').slice(-5).map(f => {
                      if (f === 'W') return '<span class="form-badge form-win">W</span>';
                      if (f === 'D') return '<span class="form-badge form-draw">D</span>';
                      if (f === 'L') return '<span class="form-badge form-loss">L</span>';
                      return '<span class="form-badge form-unknown">?</span>';
                    }).join('') : '<span class="form-badge form-unknown">?</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="standings-legend">
        <div class="legend-item">
          <span class="legend-color rank-champions"></span>
          <span>Promotion - Champions League (League phase)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color rank-europa"></span>
          <span>Promotion - Europa League (League phase)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color rank-relegation"></span>
          <span>Relegation - Championship</span>
        </div>
      </div>
    </div>
  `;
  
  contentDiv.innerHTML = html;
}

// Update standings when league is changed
function updateStandingsLeague(leagueIndex) {
  const activeTab = document.querySelector('.standings-tab.active');
  const type = activeTab ? activeTab.dataset.type : 'all';
  renderStandingsTable(parseInt(leagueIndex), type);
}

// Update standings when type is changed
function updateStandingsType(type, button) {
  // Update active tab
  document.querySelectorAll('.standings-tab').forEach(tab => tab.classList.remove('active'));
  button.classList.add('active');
  
  // Get current league index
  const leagueSelect = document.querySelector('.standings-league-select');
  const leagueIndex = parseInt(leagueSelect.value);
  
  renderStandingsTable(leagueIndex, type);
}

// Phase 2 functions removed - search/filter/sort functionality removed per user request

// Toggle position group collapse/expand
function togglePositionGroup(header) {
  const mainSection = header.parentElement;
  const subdivisions = mainSection.querySelector('.players-subdivisions');
  const icon = header.querySelector('.position-toggle-icon');
  
  if (subdivisions.style.display === 'none') {
    subdivisions.style.display = 'block';
    icon.style.transform = 'rotate(0deg)';
  } else {
    subdivisions.style.display = 'none';
    icon.style.transform = 'rotate(-90deg)';
  }
}

// Global state for player data (Phase 3 modal only)
let _currentTeamPlayers = [];
let currentTeamData = null;
let playerClickHandlerAttached = false;

// Add getter/setter to track when currentTeamPlayers is modified
Object.defineProperty(window, 'currentTeamPlayers', {
  get: function() {
    return _currentTeamPlayers;
  },
  set: function(value) {
    console.log('🔄 currentTeamPlayers is being set:', value.length, 'players');
    console.trace('Stack trace:');
    _currentTeamPlayers = value;
  }
});

// Event handler for player row clicks (using event delegation)
function handlePlayerRowClick(e) {
  console.log('=== handlePlayerRowClick triggered ===');
  console.log('Event target:', e.target);
  console.log('Event currentTarget:', e.currentTarget);
  
  // Find the closest player-row element
  const playerRow = e.target.closest('.player-row');
  
  console.log('Found player row:', playerRow);
  
  if (!playerRow) {
    console.log('Click was not on a player row, ignoring');
    return; // Click was not on a player row
  }
  
  const playerId = parseInt(playerRow.getAttribute('data-player-id'));
  const playerName = playerRow.querySelector('.player-name-cell span')?.textContent || 'Unknown';
  
  console.log('=== PLAYER ROW CLICKED ===');
  console.log('Player ID:', playerId);
  console.log('Player Name:', playerName);
  console.log('currentTeamPlayers length:', currentTeamPlayers.length);
  
  if (playerId) {
    showPlayerDetails(playerId);
  } else {
    console.error('No player ID found on row');
  }
}

// Set up global click handler for player rows
function setupGlobalPlayerClickHandler() {
  if (playerClickHandlerAttached) {
    console.log('Global player click handler already attached');
    return;
  }
  
  console.log('=== Setting up GLOBAL player click handler ===');
  
  // Use event delegation on document body
  document.body.addEventListener('click', function(e) {
    // Check if click is within team details content (center column)
    const teamDetailsContent = e.target.closest('#team-details-content');
    if (!teamDetailsContent) {
      return;
    }
    
    // Check if click is on a player row
    const playerRow = e.target.closest('.player-row');
    if (!playerRow) {
      return;
    }
    
    console.log('=== PLAYER ROW CLICKED (Global Handler) ===');
    console.log('Player row element:', playerRow);
    
    const playerIdStr = playerRow.getAttribute('data-player-id');
    const playerId = parseInt(playerIdStr);
    const playerName = playerRow.querySelector('.player-name-cell span')?.textContent || 'Unknown';
    
    console.log('Player ID string:', playerIdStr);
    console.log('Player ID parsed:', playerId);
    console.log('Player Name:', playerName);
    console.log('currentTeamPlayers length:', currentTeamPlayers.length);
    
    if (!playerIdStr || isNaN(playerId) || playerId === 0) {
      console.error('❌ ERROR: Invalid player ID!');
      console.error('playerIdStr:', playerIdStr);
      console.error('playerId:', playerId);
      alert('Player ID is missing. This is a data issue. Please check the console for details.');
      return;
    }
    
    if (currentTeamPlayers.length === 0) {
      console.error('❌ ERROR: No player data available!');
      alert('Player data not loaded. Please switch to another tab and back to Players tab, then try again.');
      return;
    }
    
    console.log('✓ Calling showPlayerDetails with player ID:', playerId);
    showPlayerDetails(playerId);
  });
  
  playerClickHandlerAttached = true;
  console.log('✓ Global player click handler attached');
}

// Initialize global handler on page load
document.addEventListener('DOMContentLoaded', setupGlobalPlayerClickHandler);

// Render team players
async function renderTeamPlayers(team, container) {
  try {
    console.log('=== renderTeamPlayers called ===');
    console.log('Team:', team.name, 'ID:', team.id);
    console.log('Container:', container);
    console.log('Container class:', container.className);
    
    const response = await fetch(`/api/teams/${team.id}/players`);
    const data = await response.json();
    
    console.log('Players data received:', data);
    
    if (!data.players || data.players.length === 0) {
      container.innerHTML = '<div class="team-details-loading"><div>No players available</div></div>';
      return;
    }
    
    // Store data globally for the click handler
    currentTeamPlayers = data.players;
    currentTeamData = team;
    
    const players = data.players;
    console.log('Total players:', players.length);
    console.log('✓ Stored currentTeamPlayers:', currentTeamPlayers.length);
    console.log('✓ Stored currentTeamData:', currentTeamData.name);
    
    // Debug: Check first player structure
    if (players.length > 0) {
      const firstPlayer = players[0];
      console.log('First player object keys:', Object.keys(firstPlayer));
      console.log('First player.player keys:', Object.keys(firstPlayer.player || {}));
      console.log('First player.player.id:', firstPlayer.player?.id);
      console.log('First player.player.name:', firstPlayer.player?.name);
      
      // Try to find the ID field
      const playerObj = firstPlayer.player || {};
      const possibleIdFields = ['id', 'player_id', 'playerId', 'ID', 'Id'];
      for (const field of possibleIdFields) {
        if (playerObj[field]) {
          console.log(`Found ID in field "${field}":`, playerObj[field]);
        }
      }
    }
    
    // Render players directly without filters
    container.innerHTML = '';
    renderPlayersContent(players, container);
    
    console.log('✓ Players HTML rendered');
    
    // Verify that player rows exist
    setTimeout(() => {
      const rows = container.querySelectorAll('.player-row');
      console.log('✓ Verification: Found', rows.length, 'player rows in container');
      if (rows.length > 0) {
        console.log('First player row data-player-id:', rows[0].getAttribute('data-player-id'));
        console.log('First player name:', rows[0].querySelector('.player-name-cell span')?.textContent);
      }
      console.log('✓ Global click handler is active, clicks should work now');
    }, 100);
  } catch (err) {
    console.error('Error loading team players:', err);
    container.innerHTML = '<div class="team-details-loading"><div>Failed to load players: ' + err.message + '</div></div>';
  }
}

// Render team details info
async function renderTeamDetailsInfo(team, container) {
  try {
    const response = await fetch(`/api/teams/${team.id}/info`);
    const data = await response.json();
    
    const teamInfo = data.team || {};
    const venue = data.venue || {};
    
    let html = `
      <div class="team-info-container">
        <!-- Team Basic Info -->
        <div class="team-info-section">
          <h3 class="team-info-section-title">
            <i class="fa-solid fa-shield-halved"></i> Team Information
          </h3>
          <div class="team-info-grid">
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-calendar"></i> Founded</span>
              <span class="team-info-value">${teamInfo.founded || 'Unknown'}</span>
            </div>
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-flag"></i> Country</span>
              <span class="team-info-value">${escapeHtml(teamInfo.country || 'Unknown')}</span>
            </div>
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-code"></i> Team Code</span>
              <span class="team-info-value">${escapeHtml(teamInfo.code || 'N/A')}</span>
            </div>
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-building"></i> Type</span>
              <span class="team-info-value">${teamInfo.national ? 'National Team' : 'Club Team'}</span>
            </div>
          </div>
        </div>

        <!-- Venue Information -->
        <div class="team-info-section">
          <h3 class="team-info-section-title">
            <i class="fa-solid fa-location-dot"></i> Stadium Information
          </h3>
          <div class="team-info-grid">
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-building-columns"></i> Stadium Name</span>
              <span class="team-info-value">${escapeHtml(venue.name || 'Unknown')}</span>
            </div>
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-city"></i> City</span>
              <span class="team-info-value">${escapeHtml(venue.city || 'Unknown')}</span>
            </div>
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-users"></i> Capacity</span>
              <span class="team-info-value">${venue.capacity ? venue.capacity.toLocaleString() : 'Unknown'}</span>
            </div>
            <div class="team-info-item">
              <span class="team-info-label"><i class="fa-solid fa-seedling"></i> Surface</span>
              <span class="team-info-value">${escapeHtml(venue.surface || 'Unknown')}</span>
            </div>
            ${venue.address ? `
              <div class="team-info-item team-info-item-full">
                <span class="team-info-label"><i class="fa-solid fa-map-marker-alt"></i> Address</span>
                <span class="team-info-value">${escapeHtml(venue.address)}</span>
              </div>
            ` : ''}
          </div>
          
          ${venue.image ? `
            <div class="venue-image-container">
              <img src="${venue.image}" alt="${escapeHtml(venue.name)}" class="venue-image">
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading team details:', err);
    container.innerHTML = '<div class="team-details-loading"><div>Failed to load team details</div></div>';
  }
}

// Render team statistics
async function renderTeamStatistics(team, container) {
  try {
    const response = await fetch(`/api/teams/${team.id}/statistics`);
    const data = await response.json();
    
    if (!data.statistics || !data.statistics.details) {
      container.innerHTML = '<div class="team-details-loading"><div>No statistics available</div></div>';
      return;
    }
    
    const details = data.statistics.details;
    
    // Helper function to find stat by type_id
    const findStat = (typeId) => details.find(d => d.type_id === typeId);
    
    // Extract key statistics
    const goals = findStat(52); // Goals
    const goalsConceded = findStat(88); // Goals Conceded
    const cleanSheets = findStat(214); // Clean Sheets
    const failedToScore = findStat(216); // Failed to Score
    const btts = findStat(215); // Both Teams to Score
    const penalties = findStat(47); // Penalties
    const scoringMinutes = findStat(196); // Scoring Minutes
    const concededMinutes = findStat(213); // Conceded Scoring Minutes
    
    let html = `
      <div class="team-stats-container">
        <!-- Goals Statistics -->
        ${goals ? `
          <div class="stats-section">
            <h3 class="stats-section-title">
              <i class="fa-solid fa-futbol"></i> Goals Scored
            </h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total</div>
                <div class="stat-value">${goals.value.all?.count || 0}</div>
                <div class="stat-sublabel">Avg: ${goals.value.all?.average?.toFixed(2) || 0} per game</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Home</div>
                <div class="stat-value">${goals.value.home?.count || 0}</div>
                <div class="stat-sublabel">${goals.value.home?.percentage?.toFixed(1) || 0}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Away</div>
                <div class="stat-value">${goals.value.away?.count || 0}</div>
                <div class="stat-sublabel">${goals.value.away?.percentage?.toFixed(1) || 0}%</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Goals Conceded Statistics -->
        ${goalsConceded ? `
          <div class="stats-section">
            <h3 class="stats-section-title">
              <i class="fa-solid fa-shield"></i> Goals Conceded
            </h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total</div>
                <div class="stat-value">${goalsConceded.value.all?.count || 0}</div>
                <div class="stat-sublabel">Avg: ${goalsConceded.value.all?.average?.toFixed(2) || 0} per game</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Home</div>
                <div class="stat-value">${goalsConceded.value.home?.count || 0}</div>
                <div class="stat-sublabel">${goalsConceded.value.home?.percentage?.toFixed(1) || 0}%</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Away</div>
                <div class="stat-value">${goalsConceded.value.away?.count || 0}</div>
                <div class="stat-sublabel">${goalsConceded.value.away?.percentage?.toFixed(1) || 0}%</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Match Results -->
        ${cleanSheets || failedToScore || btts ? `
          <div class="stats-section">
            <h3 class="stats-section-title">
              <i class="fa-solid fa-chart-simple"></i> Match Results
            </h3>
            <div class="stats-grid">
              ${cleanSheets ? `
                <div class="stat-card stat-card-success">
                  <div class="stat-label">Clean Sheets</div>
                  <div class="stat-value">${cleanSheets.value.all?.count || 0}</div>
                  <div class="stat-sublabel">${cleanSheets.value.all?.percentage?.toFixed(1) || 0}% of matches</div>
                </div>
              ` : ''}
              ${failedToScore ? `
                <div class="stat-card stat-card-danger">
                  <div class="stat-label">Failed to Score</div>
                  <div class="stat-value">${failedToScore.value.all?.count || 0}</div>
                  <div class="stat-sublabel">${failedToScore.value.all?.percentage?.toFixed(1) || 0}% of matches</div>
                </div>
              ` : ''}
              ${btts ? `
                <div class="stat-card">
                  <div class="stat-label">Both Teams Scored</div>
                  <div class="stat-value">${btts.value.all?.count || 0}</div>
                  <div class="stat-sublabel">${btts.value.all?.percentage?.toFixed(1) || 0}% of matches</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Penalties -->
        ${penalties ? `
          <div class="stats-section">
            <h3 class="stats-section-title">
              <i class="fa-solid fa-circle-dot"></i> Penalties
            </h3>
            <div class="stats-grid">
              <div class="stat-card stat-card-success">
                <div class="stat-label">Scored</div>
                <div class="stat-value">${penalties.value.scored || 0}</div>
              </div>
              <div class="stat-card stat-card-danger">
                <div class="stat-label">Missed</div>
                <div class="stat-value">${penalties.value.missed || 0}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Conversion Rate</div>
                <div class="stat-value">${penalties.value.conversion_rate || 0}%</div>
              </div>
            </div>
          </div>
        ` : ''}
        
        <!-- Scoring Minutes -->
        ${scoringMinutes ? `
          <div class="stats-section">
            <h3 class="stats-section-title">
              <i class="fa-solid fa-clock"></i> When Goals Are Scored
            </h3>
            <div class="time-distribution">
              ${Object.entries(scoringMinutes.value).map(([period, data]) => `
                <div class="time-bar">
                  <div class="time-label">${period} min</div>
                  <div class="time-bar-container">
                    <div class="time-bar-fill" style="width: ${data.percentage}%"></div>
                  </div>
                  <div class="time-value">${data.count} (${data.percentage.toFixed(1)}%)</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Conceded Minutes -->
        ${concededMinutes ? `
          <div class="stats-section">
            <h3 class="stats-section-title">
              <i class="fa-solid fa-clock"></i> When Goals Are Conceded
            </h3>
            <div class="time-distribution">
              ${Object.entries(concededMinutes.value).map(([period, data]) => `
                <div class="time-bar">
                  <div class="time-label">${period} min</div>
                  <div class="time-bar-container">
                    <div class="time-bar-fill time-bar-fill-danger" style="width: ${data.percentage}%"></div>
                  </div>
                  <div class="time-value">${data.count} (${data.percentage.toFixed(1)}%)</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading team statistics:', err);
    container.innerHTML = '<div class="team-details-loading"><div>Failed to load statistics</div></div>';
  }
}
// ============================================
// PHASE 2 & 3: ADD THESE FUNCTIONS TO THE END OF main.js
// ============================================

// Duplicate Phase 2 functions removed - see above for comment

function renderPlayersContent(players, container) {
  const positionGroups = {
    'Goalkeepers': { 'GK': [] },
    'Defenders': { 'CB': [], 'LB': [], 'RB': [] },
    'Midfielders': { 'CDM': [], 'CM': [], 'CAM': [] },
    'Attackers': { 'LW': [], 'RW': [], 'ST': [] }
  };
  
  players.forEach(p => {
    const pos = p.statistics?.[0]?.games?.position || p.player?.position || '';
    const posUpper = pos.toUpperCase();
    
    if (posUpper.includes('GK') || posUpper.includes('GOALKEEPER')) {
      positionGroups['Goalkeepers']['GK'].push(p);
    } else if (posUpper.includes('CB') || posUpper === 'CENTRE-BACK' || posUpper === 'CENTER-BACK') {
      positionGroups['Defenders']['CB'].push(p);
    } else if (posUpper.includes('LB') || posUpper === 'LEFT-BACK' || posUpper.includes('LEFT BACK')) {
      positionGroups['Defenders']['LB'].push(p);
    } else if (posUpper.includes('RB') || posUpper === 'RIGHT-BACK' || posUpper.includes('RIGHT BACK')) {
      positionGroups['Defenders']['RB'].push(p);
    } else if (posUpper.includes('DEFENDER')) {
      positionGroups['Defenders']['CB'].push(p);
    } else if (posUpper.includes('CDM') || posUpper === 'DEFENSIVE MIDFIELD') {
      positionGroups['Midfielders']['CDM'].push(p);
    } else if (posUpper.includes('CAM') || posUpper === 'ATTACKING MIDFIELD') {
      positionGroups['Midfielders']['CAM'].push(p);
    } else if (posUpper.includes('CM') || posUpper.includes('CENTRAL MIDFIELD') || posUpper.includes('MIDFIELDER')) {
      positionGroups['Midfielders']['CM'].push(p);
    } else if (posUpper.includes('LW') || posUpper.includes('LEFT WING')) {
      positionGroups['Attackers']['LW'].push(p);
    } else if (posUpper.includes('RW') || posUpper.includes('RIGHT WING')) {
      positionGroups['Attackers']['RW'].push(p);
    } else if (posUpper.includes('ST') || posUpper.includes('STRIKER') || posUpper.includes('FORWARD') || posUpper.includes('ATTACKER') || posUpper.includes('CF')) {
      positionGroups['Attackers']['ST'].push(p);
    } else {
      positionGroups['Midfielders']['CM'].push(p);
    }
  });
  
  let html = '<div class="players-content">';
  
  Object.entries(positionGroups).forEach(([mainPosition, subPositions]) => {
    const totalPlayers = Object.values(subPositions).reduce((sum, players) => sum + players.length, 0);
    
    if (totalPlayers > 0) {
      html += `
        <div class="players-main-section">
          <div class="players-main-header" onclick="togglePositionGroup(this)">
            <div class="players-main-title">
              <i class="fa-solid fa-chevron-down position-toggle-icon"></i>
              <span>${mainPosition}</span>
              <span class="player-count">(${totalPlayers})</span>
            </div>
          </div>
          <div class="players-subdivisions">`;
      
      Object.entries(subPositions).forEach(([subPosition, playersList]) => {
        if (playersList.length > 0) {
          html += `
            <div class="players-section">
              <div class="players-sub-header">
                <span class="sub-position-name">${subPosition}</span>
                <span class="sub-player-count">${playersList.length} player${playersList.length > 1 ? 's' : ''}</span>
              </div>
              <table class="players-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th><img src="/images/icons/football-jersey.svg" alt="Jersey" style="width: 20px; height: 20px;"></th>
                    <th title="Rating">Rating</th>
                    <th title="Minutes">Min</th>
                    <th title="Lineups">Lineups</th>
                    <th><img src="/images/icons/goal.svg" alt="Goals" style="width: 20px; height: 20px;"></th>
                    <th><img src="/images/icons/football-assist.svg" alt="Assists" style="width: 20px; height: 20px;"></th>
                    <th title="Goals per 90 minutes">G/90</th>
                    <th title="Assists per 90 minutes">A/90</th>
                    <th title="Shots">Shots</th>
                    <th title="Pass%">Pass%</th>
                    <th title="Tackles">Tackles</th>
                    <th><img src="/images/icons/yellow-card.svg" alt="Yellow" style="width: 14px; height: 18px;"></th>
                    <th><img src="/images/icons/red-card.svg" alt="Red" style="width: 14px; height: 18px;"></th>
                  </tr>
                </thead>
                <tbody>`;
          
          playersList.forEach(p => {
            try {
              let stats = p.statistics?.find(s => s.games && s.games.number) || p.statistics?.[0] || {};
              const games = stats.games || {};
              const goals = stats.goals || {};
              const cards = stats.cards || {};
              const shots = stats.shots || {};
              const passes = stats.passes || {};
              const tackles = stats.tackles || {};
              
              const playerName = p.player.name || 'Unknown';
              const playerNationality = p.player.nationality || '';
              const jerseyNumber = games.number || p.player.number || '-';
              const countryCode = getCountryCode(playerNationality);
              const flagUrl = countryCode ? `https://flagcdn.com/w40/${countryCode}.png` : '';
              
              // Improved Rating display
              let ratingDisplay = '-';
              let ratingClass = '';
              let ratingTitle = '';
              
              if (games.rating) {
                const ratingValue = parseFloat(games.rating);
                ratingDisplay = ratingValue.toFixed(1);
                if (ratingValue >= 7.5) {
                  ratingClass = 'rating-excellent';
                } else if (ratingValue >= 7.0) {
                  ratingClass = 'rating-good';
                } else if (ratingValue >= 6.5) {
                  ratingClass = 'rating-average';
                } else {
                  ratingClass = 'rating-poor';
                }
              } else {
                // Show reason for no rating
                const appearances = games.appearences || 0;
                const minutes = games.minutes || 0;
                
                if (appearances === 0) {
                  ratingDisplay = '-';
                  ratingTitle = 'No appearances this season';
                  ratingClass = 'rating-no-data';
                } else if (minutes < 45) {
                  ratingDisplay = '-';
                  ratingTitle = 'Insufficient playing time';
                  ratingClass = 'rating-no-data';
                } else {
                  ratingDisplay = '-';
                  ratingTitle = 'Rating not available';
                  ratingClass = 'rating-no-data';
                }
              }
              
              const shotsDisplay = shots.total ? `${shots.total}${shots.on ? '/' + shots.on : ''}` : '-';
              const passAccuracy = passes.accuracy ? `${passes.accuracy.toFixed(0)}%` : '-';
              
              // Calculate per 90 minutes stats
              const minutes = games.minutes || 0;
              let goalsPer90 = '-';
              let assistsPer90 = '-';
              
              if (minutes >= 90) {
                const goalsTotal = goals.total || 0;
                const assistsTotal = goals.assists || 0;
                goalsPer90 = ((goalsTotal / minutes) * 90).toFixed(2);
                assistsPer90 = ((assistsTotal / minutes) * 90).toFixed(2);
              }
              
              // Captain badge
              const isCaptain = games.captain || false;
              const captainBadge = isCaptain ? '<span class="captain-badge" title="Team Captain">⭐</span>' : '';
              
              // Ensure player ID exists
              const playerId = p.player?.id || p.player?.player_id || 0;
              if (!playerId) {
                console.warn('Player without ID:', p.player?.name);
              }
              
              html += `
                <tr data-player-id="${playerId}" class="player-row">
                  <td>
                    <div class="player-name-cell">
                      <img src="${p.player.photo}" class="player-photo" onerror="this.src='https://via.placeholder.com/32'">
                      ${flagUrl ? `<img src="${flagUrl}" class="player-flag" alt="${playerNationality}" onerror="this.style.display='none'">` : ''}
                      <span>${playerName}</span>
                      ${captainBadge}
                    </div>
                  </td>
                  <td>${p.player.age || '-'}</td>
                  <td><strong>${jerseyNumber}</strong></td>
                  <td><span class="player-rating ${ratingClass}" title="${ratingTitle}">${ratingDisplay}</span></td>
                  <td>${games.minutes || 0}</td>
                  <td>${games.lineups || 0}</td>
                  <td>${goals.total || 0}</td>
                  <td>${goals.assists || 0}</td>
                  <td class="per90-stat">${goalsPer90}</td>
                  <td class="per90-stat">${assistsPer90}</td>
                  <td>${shotsDisplay}</td>
                  <td>${passAccuracy}</td>
                  <td>${tackles.total || 0}</td>
                  <td>${cards.yellow || 0}</td>
                  <td>${cards.red || 0}</td>
                </tr>
              `;
            } catch (playerErr) {
              console.error('Error rendering player:', playerErr);
            }
          });
          
          html += `</tbody></table></div>`;
        }
      });
      
      html += `</div></div>`;
    }
  });
  
  if (players.length === 0) {
    html += '<div class="no-players-found"><i class="fa-solid fa-search"></i><p>No players found matching your filters</p></div>';
  }
  
  html += '</div>';
  container.insertAdjacentHTML('beforeend', html);
  
  console.log('=== Setting up event delegation for player clicks ===');
  console.log('Container:', container);
}

// PHASE 3: Player Details in Center Column (not modal)
function showPlayerDetails(playerId) {
  console.log('showPlayerDetails called with playerId:', playerId);
  console.log('currentTeamPlayers array:', currentTeamPlayers);
  console.log('Looking for player with ID:', playerId);
  
  const player = currentTeamPlayers.find(p => p.player.id === playerId);
  if (!player) {
    console.error('Player not found:', playerId);
    console.log('Available player IDs:', currentTeamPlayers.map(p => p.player.id));
    return;
  }
  
  console.log('Found player:', player.player.name, 'ID:', player.player.id);
  
  // Hide other views
  document.getElementById('fixtures-view').classList.add('hidden');
  document.getElementById('league-page').classList.add('hidden');
  document.getElementById('team-details-view').classList.add('hidden');
  
  // Show player details view
  const playerView = document.getElementById('player-details-view');
  playerView.classList.remove('hidden');
  
  const stats = player.statistics?.[0] || {};
  const games = stats.games || {};
  const goals = stats.goals || {};
  const shots = stats.shots || {};
  const passes = stats.passes || {};
  const tackles = stats.tackles || {};
  const cards = stats.cards || {};
  const penalty = stats.penalty || {};
  
  const content = document.getElementById('player-details-content');
  content.innerHTML = `
    <div class="player-detail-header">
      <img src="${player.player.photo}" class="player-detail-photo" onerror="this.src='https://via.placeholder.com/120'">
      <div class="player-detail-info">
        <h1>${player.player.name}</h1>
        <div class="player-detail-meta">
          <span><i class="fa-solid fa-shirt"></i> #${games.number || '-'}</span>
          <span><i class="fa-solid fa-location-dot"></i> ${games.position || '-'}</span>
          <span><i class="fa-solid fa-calendar"></i> ${player.player.age || '-'} years</span>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h3><i class="fa-solid fa-user"></i> Personal Information</h3>
      <div class="player-info-grid">
        <div class="player-info-item">
          <span class="label">Full Name</span>
          <span class="value">${player.player.firstname || ''} ${player.player.lastname || ''}</span>
        </div>
        <div class="player-info-item">
          <span class="label">Nationality</span>
          <span class="value">${player.player.nationality || '-'}</span>
        </div>
        <div class="player-info-item">
          <span class="label">Date of Birth</span>
          <span class="value">${player.player.birth?.date || '-'}</span>
        </div>
        <div class="player-info-item">
          <span class="label">Place of Birth</span>
          <span class="value">${
            (() => {
              const place = player.player.birth?.place;
              const country = player.player.birth?.country;
              if (place && place !== 'Unknown' && country) {
                return `${place}, ${country}`;
              } else if (country) {
                return country;
              } else {
                return '-';
              }
            })()
          }</span>
        </div>
        <div class="player-info-item">
          <span class="label">Height</span>
          <span class="value">${player.player.height || '-'}</span>
        </div>
        <div class="player-info-item">
          <span class="label">Weight</span>
          <span class="value">${player.player.weight || '-'}</span>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h3><i class="fa-solid fa-chart-bar"></i> Season Statistics</h3>
      <div class="player-stats-grid">
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-futbol"></i></div>
          <div class="stat-value">${games.appearences || 0}</div>
          <div class="stat-label">Appearances</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-play"></i></div>
          <div class="stat-value">${games.lineups || 0}</div>
          <div class="stat-label">Lineups</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-clock"></i></div>
          <div class="stat-value">${games.minutes || 0}</div>
          <div class="stat-label">Minutes</div>
        </div>
        <div class="stat-box ${games.rating >= 7.5 ? 'stat-excellent' : games.rating >= 7.0 ? 'stat-good' : 'stat-average'}">
          <div class="stat-icon"><i class="fa-solid fa-star"></i></div>
          <div class="stat-value">${games.rating ? parseFloat(games.rating).toFixed(2) : '-'}</div>
          <div class="stat-label">Rating</div>
        </div>
      </div>
      
      <div class="player-stats-grid">
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-bullseye"></i></div>
          <div class="stat-value">${goals.total || 0}</div>
          <div class="stat-label">Goals</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-hands-helping"></i></div>
          <div class="stat-value">${goals.assists || 0}</div>
          <div class="stat-label">Assists</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-crosshairs"></i></div>
          <div class="stat-value">${shots.total || 0} / ${shots.on || 0}</div>
          <div class="stat-label">Shots / On Target</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-percentage"></i></div>
          <div class="stat-value">${shots.accuracy ? shots.accuracy + '%' : '-'}</div>
          <div class="stat-label">Shot Accuracy</div>
        </div>
      </div>
      
      <div class="player-stats-grid">
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-exchange-alt"></i></div>
          <div class="stat-value">${passes.total || 0}</div>
          <div class="stat-label">Passes</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-check-circle"></i></div>
          <div class="stat-value">${passes.accuracy ? passes.accuracy + '%' : '-'}</div>
          <div class="stat-label">Pass Accuracy</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-key"></i></div>
          <div class="stat-value">${passes.key || 0}</div>
          <div class="stat-label">Key Passes</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-shield-alt"></i></div>
          <div class="stat-value">${tackles.total || 0}</div>
          <div class="stat-label">Tackles</div>
        </div>
      </div>
      
      <div class="player-stats-grid">
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-hand-paper"></i></div>
          <div class="stat-value">${tackles.blocks || 0}</div>
          <div class="stat-label">Blocks</div>
        </div>
        <div class="stat-box">
          <div class="stat-icon"><i class="fa-solid fa-cut"></i></div>
          <div class="stat-value">${tackles.interceptions || 0}</div>
          <div class="stat-label">Interceptions</div>
        </div>
        <div class="stat-box stat-warning">
          <div class="stat-icon"><i class="fa-solid fa-square"></i></div>
          <div class="stat-value">${cards.yellow || 0}</div>
          <div class="stat-label">Yellow Cards</div>
        </div>
        <div class="stat-box stat-danger">
          <div class="stat-icon"><i class="fa-solid fa-square"></i></div>
          <div class="stat-value">${cards.red || 0}</div>
          <div class="stat-label">Red Cards</div>
        </div>
      </div>
      
      ${penalty.scored || penalty.missed ? `
        <div class="player-stats-grid">
          <div class="stat-box">
            <div class="stat-icon"><i class="fa-solid fa-circle-dot"></i></div>
            <div class="stat-value">${penalty.scored || 0}</div>
            <div class="stat-label">Penalties Scored</div>
          </div>
          <div class="stat-box">
            <div class="stat-icon"><i class="fa-solid fa-times-circle"></i></div>
            <div class="stat-value">${penalty.missed || 0}</div>
            <div class="stat-label">Penalties Missed</div>
          </div>
        </div>
      ` : ''}
    </div>
    
    <div class="detail-section" id="player-transfers-section">
      <h3><i class="fa-solid fa-exchange-alt"></i> Transfer History</h3>
      <div id="player-transfers-content">
        <div class="loading-placeholder">Loading transfer history...</div>
      </div>
    </div>
  `;
  
  // Load transfer history asynchronously
  loadPlayerTransfers(playerId);
}

// Close player details view
function closePlayerDetailsView() {
  document.getElementById('player-details-view').classList.add('hidden');
  document.getElementById('team-details-view').classList.remove('hidden');
}

async function loadPlayerTransfers(playerId) {
  try {
    const response = await fetch(`/api/players/${playerId}/transfers`);
    const data = await response.json();
    
    const transfersContent = document.getElementById('player-transfers-content');
    
    if (!data.transfers || data.transfers.length === 0) {
      transfersContent.innerHTML = '<div class="no-data-message"><i class="fa-solid fa-info-circle"></i> No transfer history available</div>';
      return;
    }
    
    // Sort transfers by date (newest first)
    const transfers = data.transfers.sort((a, b) => {
      const dateA = new Date(a.date || 0);
      const dateB = new Date(b.date || 0);
      return dateB - dateA;
    });
    
    let html = '<div class="transfers-timeline">';
    
    transfers.forEach((transfer, index) => {
      const transferDate = transfer.date ? new Date(transfer.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
      const fromTeam = transfer.from?.name || 'Unknown';
      const toTeam = transfer.to?.name || 'Unknown';
      const transferType = transfer.type?.name || 'Transfer';
      const transferFee = transfer.amount ? `€${(transfer.amount / 1000000).toFixed(1)}M` : 'Free';
      
      // Skip transfers where both teams are unknown
      if (fromTeam === 'Unknown' && toTeam === 'Unknown') {
        return;
      }
      
      html += `
        <div class="transfer-item">
          <div class="transfer-date">${transferDate}</div>
          <div class="transfer-details">
            <div class="transfer-teams">
              <span class="transfer-from">${escapeHtml(fromTeam === 'Unknown' ? '—' : fromTeam)}</span>
              <i class="fa-solid fa-arrow-right transfer-arrow"></i>
              <span class="transfer-to">${escapeHtml(toTeam === 'Unknown' ? '—' : toTeam)}</span>
            </div>
            <div class="transfer-meta">
              <span class="transfer-type">${escapeHtml(transferType)}</span>
              <span class="transfer-fee">${transferFee}</span>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    transfersContent.innerHTML = html;
    
  } catch (err) {
    console.error('Error loading transfers:', err);
    const transfersContent = document.getElementById('player-transfers-content');
    if (transfersContent) {
      transfersContent.innerHTML = '<div class="error-message"><i class="fa-solid fa-exclamation-triangle"></i> Failed to load transfer history</div>';
    }
  }
}

function closePlayerModal() {
  const modal = document.querySelector('.player-modal-overlay');
  if (modal) {
    modal.remove();
    document.body.style.overflow = '';
  }
}
