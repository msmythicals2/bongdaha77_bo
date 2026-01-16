require("dotenv").config();

const express = require("express");
const axios = require("axios");
const RSSParser = require("rss-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const parser = new RSSParser();

const PORT = process.env.PORT || 3000;
const API_FOOTBALL_KEY = process.env.FOOTBALL_API_KEY;
const SPORTMONKS_KEY = process.env.SPORTMONKS_API_KEY;
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const SPORTMONKS_BASE = "https://api.sportmonks.com/v3/football";
const ADMIN_API_URL = process.env.ADMIN_API_URL || "http://localhost:8080";
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || "https://localhost:3000";

// ============================================
// CACHE SYSTEM
// ============================================
const cache = new Map();

function getCacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`;
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlSeconds) {
  cache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  LIVE: 15,              // 15 seconds for live matches
  FIXTURES: 300,         // 5 minutes for fixtures by date
  TEAMS: 43200,          // 12 hours for teams database
  PLAYERS: 43200,        // 12 hours for players database
  SQUADS: 43200,         // 12 hours for squads
  STANDINGS: 1800,       // 30 minutes for standings
  LEAGUES: 86400         // 24 hours for leagues
};

function parseAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

if (!API_FOOTBALL_KEY) {
  console.error("FOOTBALL_API_KEY missing in .env");
  process.exit(1);
}

if (!SPORTMONKS_KEY) {
  console.error("SPORTMONKS_API_KEY missing in .env");
  process.exit(1);
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = parseAllowedOrigins();
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.use(express.json());

// ============================================
// API HELPERS
// ============================================

// API-Football headers
const apiFootballHeaders = {
  "x-apisports-key": API_FOOTBALL_KEY
};

// SportMonks request helper
async function sportmonksRequest(endpoint, params = {}) {
  try {
    const url = `${SPORTMONKS_BASE}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        api_token: SPORTMONKS_KEY,
        ...params
      }
    });
    return response.data;
  } catch (err) {
    console.error(`SportMonks API error (${endpoint}):`, err.message);
    return null;
  }
}

// API-Football request helper
async function apiFootballRequest(endpoint, params = {}) {
  try {
    const url = `${API_FOOTBALL_BASE}${endpoint}`;
    const response = await axios.get(url, {
      headers: apiFootballHeaders,
      params
    });
    return response.data;
  } catch (err) {
    console.error(`API-Football error (${endpoint}):`, err.message);
    return null;
  }
}

// ============================================
// CONFIG & STATIC
// ============================================

app.get("/api/config", (req, res) => {
  res.json({
    adminApiUrl: ADMIN_API_URL,
    frontendDomain: FRONTEND_DOMAIN
  });
});

app.use("/admin-HHrg9404nflfja22f", express.static(path.join(__dirname, "admin-HHrg9404nflfja22f")));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================
// LIVE MATCHES (API-Football only)
// ============================================
app.get("/api/live", async (req, res) => {
  try {
    const cacheKey = getCacheKey('live', {});
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('Returning cached live matches');
      return res.json(cached);
    }

    const data = await apiFootballRequest('/fixtures', { live: 'all' });
    const matches = data?.response || [];
    
    const realLiveMatches = matches.filter(match => {
      const matchDate = new Date(match.fixture.date);
      const now = new Date();
      const timeDiff = Math.abs(now - matchDate);
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      return hoursDiff <= 3 && 
             (match.fixture.status.elapsed !== null || 
              ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(match.fixture.status.short));
    });
    
    console.log(`Live API: ${matches.length} total, ${realLiveMatches.length} real live`);
    
    setCache(cacheKey, realLiveMatches, CACHE_TTL.LIVE);
    res.json(realLiveMatches);
  } catch (err) {
    console.error("live error:", err.message);
    res.json([]);
  }
});

// ============================================
// FIXTURES BY DATE (API-Football only)
// ============================================
app.get("/api/fixtures", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json([]);
    
    const cacheKey = getCacheKey('fixtures', { date });
    const cached = getCache(cacheKey);
    if (cached) {
      console.log(`Returning cached fixtures for ${date}`);
      return res.json(cached);
    }

    const data = await apiFootballRequest('/fixtures', { date });
    const fixtures = data?.response || [];
    
    setCache(cacheKey, fixtures, CACHE_TTL.FIXTURES);
    res.json(fixtures);
  } catch (err) {
    console.error("fixtures error:", err.message);
    res.json([]);
  }
});

// ============================================
// FIXTURE DETAIL (API-Football only)
// ============================================
app.get("/api/fixture-detail", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({});
    
    const data = await apiFootballRequest('/fixtures', { id });
    res.json(data || {});
  } catch (err) {
    console.error("fixture-detail error:", err.message);
    res.json({});
  }
});

// ============================================
// FIXTURE EVENTS (API-Football only)
// ============================================
app.get("/api/fixture-events", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json([]);
    
    const data = await apiFootballRequest('/fixtures/events', { fixture: id });
    res.json(data?.response || []);
  } catch (err) {
    console.error("fixture-events error:", err.message);
    res.json([]);
  }
});

// ============================================
// HEAD TO HEAD (API-Football only)
// ============================================
app.get("/api/h2h", async (req, res) => {
  try {
    const { h2h } = req.query;
    if (!h2h) return res.json([]);
    
    const data = await apiFootballRequest('/fixtures/headtohead', { h2h, last: 10 });
    res.json(data?.response || []);
  } catch (err) {
    console.error("h2h error:", err.message);
    res.json([]);
  }
});

// ============================================
// LEAGUES (API-Football)
// ============================================
app.get("/api/leagues", async (req, res) => {
  try {
    const cacheKey = getCacheKey('leagues', {});
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await apiFootballRequest('/leagues');
    const leagues = data?.response || [];
    
    setCache(cacheKey, leagues, CACHE_TTL.LEAGUES);
    res.json(leagues);
  } catch (err) {
    console.error("leagues error:", err.message);
    res.json([]);
  }
});

// ============================================
// STANDINGS (API-Football)
// ============================================
app.get("/api/standings", async (req, res) => {
  try {
    const { league, season } = req.query;
    if (!league || !season) return res.json([]);
    
    const cacheKey = getCacheKey('standings', { league, season });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await apiFootballRequest('/standings', { league, season });
    const standings = data?.response || [];
    
    setCache(cacheKey, standings, CACHE_TTL.STANDINGS);
    res.json(standings);
  } catch (err) {
    console.error("standings error:", err.message);
    res.json([]);
  }
});

// ============================================
// TOP SCORERS (API-Football)
// ============================================
app.get("/api/top-scorers", async (req, res) => {
  try {
    const { league, season } = req.query;
    if (!league || !season) return res.json([]);
    
    const data = await apiFootballRequest('/players/topscorers', { league, season });
    res.json(data?.response || []);
  } catch (err) {
    console.error("top-scorers error:", err.message);
    res.json([]);
  }
});

// ============================================
// TEAM SEARCH (SportMonks priority, fallback API-Football)
// ============================================
app.get("/api/teams/search", async (req, res) => {
  console.log("Search endpoint hit with name:", req.query.name);
  try {
    const { name } = req.query;
    if (!name || name.length < 1) return res.json([]);
    
    const cacheKey = getCacheKey('team-search', { name });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // Try SportMonks first
    const sportmonksData = await sportmonksRequest('/teams/search/' + encodeURIComponent(name));
    
    if (sportmonksData && sportmonksData.data && sportmonksData.data.length > 0) {
      // Convert SportMonks format to API-Football format
      const teams = sportmonksData.data.map(team => ({
        team: {
          id: team.id,
          name: team.name,
          code: team.short_code,
          country: team.country?.name || '',
          founded: team.founded || null,
          logo: team.image_path || ''
        },
        venue: {
          id: team.venue_id,
          name: team.venue?.name || '',
          city: team.venue?.city_name || ''
        }
      }));
      
      setCache(cacheKey, teams, CACHE_TTL.TEAMS);
      console.log(`Found ${teams.length} teams from SportMonks`);
      return res.json(teams);
    }
    
    // Fallback to API-Football
    console.log('SportMonks returned no results, trying API-Football...');
    const data = await apiFootballRequest('/teams', { search: name });
    const teams = data?.response || [];
    
    setCache(cacheKey, teams, CACHE_TTL.TEAMS);
    res.json(teams);
  } catch (err) {
    console.error("teams search error:", err.message);
    res.json([]);
  }
});

// ============================================
// TEAM INFO (SportMonks priority, fallback API-Football)
// ============================================
app.get("/api/teams/:id/info", async (req, res) => {
  try {
    const { id } = req.params;
    
    const cacheKey = getCacheKey('team-info', { id });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // Try SportMonks first
    const sportmonksData = await sportmonksRequest(`/teams/${id}`, {
      include: 'venue;country'
    });
    
    if (sportmonksData && sportmonksData.data) {
      const team = sportmonksData.data;
      const result = {
        team: {
          id: team.id,
          name: team.name,
          code: team.short_code,
          country: team.country?.name || '',
          founded: team.founded || null,
          logo: team.image_path || ''
        },
        venue: {
          id: team.venue_id,
          name: team.venue?.name || '',
          address: team.venue?.address || '',
          city: team.venue?.city_name || '',
          capacity: team.venue?.capacity || null,
          surface: team.venue?.surface || '',
          image: team.venue?.image_path || ''
        }
      };
      
      setCache(cacheKey, result, CACHE_TTL.TEAMS);
      return res.json(result);
    }
    
    // Fallback to API-Football
    console.log(`SportMonks failed for team ${id}, using API-Football...`);
    const data = await apiFootballRequest('/teams', { id });
    const teamData = data?.response?.[0];
    const result = { team: teamData?.team || {}, venue: teamData?.venue || {} };
    
    setCache(cacheKey, result, CACHE_TTL.TEAMS);
    res.json(result);
  } catch (err) {
    console.error("team info error:", err.message);
    res.json({ team: {}, venue: {} });
  }
});

// ============================================
// TEAM FIXTURES (API-Football only)
// ============================================
app.get("/api/teams/:id/fixtures", async (req, res) => {
  console.log("Fixtures endpoint hit with id:", req.params.id);
  try {
    const { id } = req.params;
    const season = 2025;
    
    console.log(`Fetching fixtures for team ${id}, season ${season}`);
    
    const data = await apiFootballRequest('/fixtures', { team: id, season });
    
    console.log(`Received ${data?.response?.length || 0} fixtures for team ${id}`);
    
    res.json({ fixtures: data?.response || [] });
  } catch (err) {
    console.error("team fixtures error:", err.message);
    res.json({ fixtures: [] });
  }
});

console.log("Team API routes registered");

// ============================================
// TEAM STANDINGS (API-Football only)
// ============================================
app.get("/api/teams/:id/standings", async (req, res) => {
  try {
    const { id } = req.params;
    const season = 2025;
    
    console.log(`Fetching standings for team ${id}, season ${season}`);
    
    const teamStandings = await apiFootballRequest('/standings', { team: id, season });
    
    const teamData = teamStandings?.response || [];
    console.log(`Team is in ${teamData.length} leagues`);
    
    const fullStandings = [];
    for (const standing of teamData) {
      const leagueId = standing.league.id;
      console.log(`Fetching full standings for league ${leagueId}`);
      
      const leagueStandings = await apiFootballRequest('/standings', { league: leagueId, season });
      
      if (leagueStandings?.response && leagueStandings.response.length > 0) {
        fullStandings.push(leagueStandings.response[0]);
      }
    }
    
    console.log(`Returning ${fullStandings.length} league standings`);
    res.json({ standings: fullStandings });
  } catch (err) {
    console.error("team standings error:", err.message);
    res.json({ standings: [] });
  }
});

// ============================================
// TEAM PLAYERS/SQUAD (SportMonks priority, fallback API-Football)
// ============================================
app.get("/api/teams/:id/players", async (req, res) => {
  try {
    const { id } = req.params;
    let season = req.query.season || 2025;
    
    console.log(`Fetching players for team ${id}, season ${season}`);
    
    const cacheKey = getCacheKey('team-players', { id, season });
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('Returning cached players');
      return res.json(cached);
    }

    // Try SportMonks first for squad data
    const sportmonksData = await sportmonksRequest(`/squads/seasons/${season}/teams/${id}`, {
      include: 'player;player.position;player.nationality'
    });
    
    if (sportmonksData && sportmonksData.data && sportmonksData.data.length > 0) {
      console.log(`SportMonks returned ${sportmonksData.data.length} players`);
      
      // Convert SportMonks format to API-Football format
      const players = sportmonksData.data.map(squad => {
        const player = squad.player;
        return {
          player: {
            id: player.player_id,
            name: player.display_name || player.common_name,
            firstname: player.firstname,
            lastname: player.lastname,
            age: calculateAge(player.date_of_birth),
            birth: {
              date: player.date_of_birth,
              place: player.city_of_birth,
              country: player.nationality?.name || player.country_of_birth
            },
            nationality: player.nationality?.name || player.country_of_birth,
            height: player.height ? `${player.height} cm` : null,
            weight: player.weight ? `${player.weight} kg` : null,
            photo: player.image_path || ''
          },
          statistics: [{
            team: {
              id: id,
              name: '',
              logo: ''
            },
            games: {
              appearences: squad.appearences || 0,
              lineups: squad.lineups || 0,
              minutes: squad.minutes || 0,
              number: squad.jersey_number || null,
              position: player.position?.name || squad.position || 'Unknown',
              rating: null,
              captain: squad.captain || false
            },
            goals: {
              total: squad.goals || 0,
              conceded: null,
              assists: squad.assists || 0,
              saves: null
            },
            cards: {
              yellow: squad.yellowcards || 0,
              yellowred: squad.yellowred || 0,
              red: squad.redcards || 0
            }
          }]
        };
      });
      
      const result = { players, coach: null, season, source: 'sportmonks' };
      setCache(cacheKey, result, CACHE_TTL.SQUADS);
      return res.json(result);
    }
    
    // Fallback to API-Football
    console.log(`SportMonks failed, trying API-Football for team ${id}, season ${season}...`);
    
    let data = await apiFootballRequest('/players', { team: id, season });
    let players = data?.response || [];
    console.log(`API-Football returned ${players.length} players for season ${season}`);
    
    // If no players found or very few, try previous season
    if (players.length < 5 && season === 2025) {
      console.log(`Few players found for season 2025, trying season 2024 as fallback...`);
      const fallbackData = await apiFootballRequest('/players', { team: id, season: 2024 });
      
      const fallbackPlayers = fallbackData?.response || [];
      console.log(`API-Football returned ${fallbackPlayers.length} players for season 2024`);
      
      if (fallbackPlayers.length > players.length) {
        players = fallbackPlayers;
        season = 2024;
        console.log(`Using season 2024 data (${players.length} players)`);
      }
    }
    
    if (players.length > 0) {
      const playerNames = players.slice(0, 5).map(p => p.player?.name);
      console.log(`First 5 players: ${playerNames.join(', ')}`);
    }
    
    const result = { players, coach: null, season, source: 'api-football' };
    setCache(cacheKey, result, CACHE_TTL.SQUADS);
    res.json(result);
  } catch (err) {
    console.error("team players error:", err.message);
    res.json({ players: [], coach: null });
  }
});

// Helper function to calculate age
function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ============================================
// PLAYER SEARCH (SportMonks priority, fallback API-Football)
// ============================================
app.get("/api/players/search", async (req, res) => {
  try {
    const { name, id } = req.query;
    
    if (id) {
      // Search by ID - try SportMonks first
      const sportmonksData = await sportmonksRequest(`/players/${id}`, {
        include: 'position;nationality;team'
      });
      
      if (sportmonksData && sportmonksData.data) {
        const player = sportmonksData.data;
        const result = {
          players: [{
            player: {
              id: player.player_id,
              name: player.display_name || player.common_name,
              firstname: player.firstname,
              lastname: player.lastname,
              age: calculateAge(player.date_of_birth),
              nationality: player.nationality?.name || player.country_of_birth,
              photo: player.image_path || ''
            }
          }],
          source: 'sportmonks'
        };
        return res.json(result);
      }
    }
    
    if (name) {
      // Search by name - try SportMonks first
      const sportmonksData = await sportmonksRequest('/players/search/' + encodeURIComponent(name));
      
      if (sportmonksData && sportmonksData.data && sportmonksData.data.length > 0) {
        const players = sportmonksData.data.map(player => ({
          player: {
            id: player.player_id,
            name: player.display_name || player.common_name,
            firstname: player.firstname,
            lastname: player.lastname,
            age: calculateAge(player.date_of_birth),
            nationality: player.nationality?.name || player.country_of_birth,
            photo: player.image_path || ''
          }
        }));
        
        return res.json({ players, source: 'sportmonks' });
      }
    }
    
    // Fallback to API-Football
    console.log('SportMonks failed, using API-Football for player search...');
    const params = {};
    if (id) params.id = id;
    if (name) params.search = name;
    
    const data = await apiFootballRequest('/players', params);
    res.json({ players: data?.response || [], source: 'api-football' });
  } catch (err) {
    console.error("player search error:", err.message);
    res.json({ players: [] });
  }
});

// ============================================
// TEAMS BY LEAGUE (API-Football)
// ============================================
app.get("/api/teams", async (req, res) => {
  try {
    const { league, season } = req.query;
    if (!league || !season) return res.json([]);
    
    const cacheKey = getCacheKey('teams-by-league', { league, season });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await apiFootballRequest('/teams', { league, season });
    const teams = data?.response || [];
    
    setCache(cacheKey, teams, CACHE_TTL.TEAMS);
    res.json(teams);
  } catch (err) {
    console.error("teams error:", err.message);
    res.json([]);
  }
});

// ============================================
// VERIFY TEAM IDS (API-Football)
// ============================================
app.get("/api/teams/verify-ids", async (req, res) => {
  try {
    const teamIds = req.query.ids ? req.query.ids.split(',') : [];
    if (teamIds.length === 0) {
      return res.json({ error: "No team IDs provided. Use ?ids=33,40,529" });
    }

    const results = [];
    for (const id of teamIds) {
      try {
        const data = await apiFootballRequest('/teams', { id: id.trim() });
        
        if (data?.response && data.response.length > 0) {
          const teamData = data.response[0];
          results.push({
            id: id.trim(),
            name: teamData.team?.name || 'Unknown',
            country: teamData.team?.country || 'Unknown',
            logo: teamData.team?.logo || '',
            founded: teamData.team?.founded || 'N/A',
            venue: teamData.venue?.name || 'N/A',
            city: teamData.venue?.city || 'N/A'
          });
        } else {
          results.push({
            id: id.trim(),
            error: 'Team not found'
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        results.push({
          id: id.trim(),
          error: err.message
        });
      }
    }
    
    res.json({ results, total: results.length });
  } catch (err) {
    console.error("verify-ids error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// NEWS RSS
// ============================================
app.get("/api/news", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 15;
    const feed = await parser.parseURL("https://vnexpress.net/rss/the-thao.rss");
    res.json(
      (feed.items || []).slice(0, limit).map(i => ({
        title: i.title,
        link: i.link,
        pubDate: i.pubDate
      }))
    );
  } catch (err) {
    console.error("news error:", err.message);
    res.json([]);
  }
});

// ============================================
// CACHE STATS (for debugging)
// ============================================
app.get("/api/cache/stats", (req, res) => {
  res.json({
    size: cache.size,
    keys: Array.from(cache.keys())
  });
});

app.get("/api/cache/clear", (req, res) => {
  cache.clear();
  res.json({ message: "Cache cleared", size: cache.size });
});

// ============================================
// DYNAMIC ROUTES
// ============================================
app.get("/:slug", async (req, res, next) => {
  const slug = req.params.slug;
  
  console.log("Dynamic route hit with slug:", slug);
  
  const skip = ['api', 'admin-HHrg9404nflfja22f', 'logo.svg', 'style.css', 'main.js', 'tracker.js', 'config.js', 'article.html', 'articles.html'];
  if (skip.includes(slug)) {
    console.log("Skipping slug:", slug);
    return next();
  }
  
  try {
    const categoriesRes = await axios.get(`${ADMIN_API_URL}/api/public/categories`);
    if (categoriesRes.data && categoriesRes.data.success) {
      const isCategory = categoriesRes.data.data.some(c => c.slug === slug);
      
      if (isCategory) {
        return res.sendFile(path.join(__dirname, "public", "articles.html"));
      }
    }
    
    res.sendFile(path.join(__dirname, "public", "article.html"));
  } catch (err) {
    console.error("Error checking slug type:", err.message);
    res.sendFile(path.join(__dirname, "public", "article.html"));
  }
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  console.log("404 - Not found:", req.method, req.url);
  res.status(404).json({ error: "Not found" });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log("===========================================");
  console.log("Bongdaha Server Running (Dual API System)");
  console.log(`http://localhost:${PORT}`);
  console.log("===========================================");
  console.log("API Strategy:");
  console.log("- Live/Fixtures/Scores: API-Football");
  console.log("- Teams/Players/Squads: SportMonks → API-Football");
  console.log("- Cache: Live 15s, Fixtures 5m, Teams/Players 12h");
  console.log("===========================================");
});
