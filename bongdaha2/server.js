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

// ============================================
// TEAM ID MAPPING
// ============================================
// Maps incorrect/old Team IDs to correct ones
// This fixes issues where frontend uses wrong IDs
const TEAM_ID_MAPPING = {
  9568: 239235,   // Inter Miami CF (old -> correct)
  // Removed Al-Nassr mapping - let it use SportMonks ID directly
  // 2939: 2506,     // Al-Nassr FC (old -> correct)
  2931: 7011,     // Al-Hilal (old -> correct)
  // Add more mappings as needed
};

function getCorrectTeamId(id) {
  const numId = parseInt(id);
  const mappedId = TEAM_ID_MAPPING[numId];
  if (mappedId && mappedId !== numId) {
    console.log(`🔄 Team ID mapping: ${numId} -> ${mappedId}`);
  }
  return mappedId || numId;
}

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
    console.log(`SportMonks request: ${url}`);
    const response = await axios.get(url, {
      params: {
        api_token: SPORTMONKS_KEY,
        ...params
      },
      timeout: 10000
    });
    return response.data;
  } catch (err) {
    console.error(`SportMonks API error (${endpoint}):`, err.response?.status, err.response?.statusText || err.message);
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
// SPORTMONKS TEST ENDPOINT
// ============================================
app.get("/api/sportmonks/test", async (req, res) => {
  try {
    // Test basic connectivity
    const tests = [];
    
    // Test 1: Get all teams (should work)
    try {
      const teamsData = await sportmonksRequest('/teams', { per_page: 5 });
      tests.push({
        endpoint: '/teams',
        status: teamsData ? 'success' : 'failed',
        data: teamsData ? `Found ${teamsData.data?.length || 0} teams` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/teams',
        status: 'error',
        error: e.message
      });
    }
    
    // Test 2: Search teams
    try {
      const searchData = await sportmonksRequest('/teams/search/Manchester');
      tests.push({
        endpoint: '/teams/search/Manchester',
        status: searchData ? 'success' : 'failed',
        data: searchData ? `Found ${searchData.data?.length || 0} teams` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/teams/search/Manchester',
        status: 'error',
        error: e.message
      });
    }
    
    // Test 3: Get specific team
    try {
      const teamData = await sportmonksRequest('/teams/14');
      tests.push({
        endpoint: '/teams/14',
        status: teamData ? 'success' : 'failed',
        data: teamData ? `Team: ${teamData.data?.name || 'Unknown'}` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/teams/14',
        status: 'error',
        error: e.message
      });
    }
    
    // Test 4: Get team with statistics includes
    try {
      const teamStatsData = await sportmonksRequest('/teams/14', {
        include: 'statistics'
      });
      tests.push({
        endpoint: '/teams/14?include=statistics',
        status: teamStatsData ? 'success' : 'failed',
        data: teamStatsData ? `Has statistics: ${!!teamStatsData.data?.statistics}` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/teams/14?include=statistics',
        status: 'error',
        error: e.message
      });
    }
    
    // Test 5: Get players
    try {
      const playersData = await sportmonksRequest('/players', { per_page: 5 });
      tests.push({
        endpoint: '/players',
        status: playersData ? 'success' : 'failed',
        data: playersData ? `Found ${playersData.data?.length || 0} players` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/players',
        status: 'error',
        error: e.message
      });
    }
    
    // Test 6: Get fixtures
    try {
      const fixturesData = await sportmonksRequest('/fixtures', { per_page: 5 });
      tests.push({
        endpoint: '/fixtures',
        status: fixturesData ? 'success' : 'failed',
        data: fixturesData ? `Found ${fixturesData.data?.length || 0} fixtures` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/fixtures',
        status: 'error',
        error: e.message
      });
    }
    
    // Test 7: Get leagues
    try {
      const leaguesData = await sportmonksRequest('/leagues', { per_page: 5 });
      tests.push({
        endpoint: '/leagues',
        status: leaguesData ? 'success' : 'failed',
        data: leaguesData ? `Found ${leaguesData.data?.length || 0} leagues` : 'No data'
      });
    } catch (e) {
      tests.push({
        endpoint: '/leagues',
        status: 'error',
        error: e.message
      });
    }
    
    res.json({
      message: 'SportMonks API Test Results',
      api_key_configured: !!SPORTMONKS_KEY,
      base_url: SPORTMONKS_BASE,
      tests
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test SportMonks statistics details
app.get("/api/sportmonks/test-stats-details", async (req, res) => {
  try {
    const results = {};
    
    // Test 1: Get team statistics with different includes
    const teamId = 14; // Manchester United
    
    // Try different include combinations
    const includeOptions = [
      'statistics',
      'statistics.details',
      'statistics.type',
      'statistics.details;statistics.type'
    ];
    
    for (const include of includeOptions) {
      try {
        const data = await sportmonksRequest(`/teams/${teamId}`, { include });
        results[include] = {
          has_statistics: !!data?.data?.statistics,
          statistics_count: data?.data?.statistics?.length || 0,
          first_stat: data?.data?.statistics?.[0] || null
        };
      } catch (e) {
        results[include] = { error: e.message };
      }
    }
    
    // Test 2: Try to get statistics directly
    try {
      const statsData = await sportmonksRequest(`/statistics/teams/${teamId}`);
      results['direct_statistics'] = {
        success: !!statsData,
        data: statsData
      };
    } catch (e) {
      results['direct_statistics'] = { error: e.message };
    }
    
    res.json({
      message: 'SportMonks Statistics Details Test',
      team_id: teamId,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test available statistics types
app.get("/api/sportmonks/test-statistics", async (req, res) => {
  try {
    const results = {
      team_statistics: null,
      player_statistics: null,
      fixture_statistics: null,
      season_statistics: null
    };
    
    // Test team statistics (Manchester United - ID 14)
    try {
      const teamData = await sportmonksRequest('/teams/14', {
        include: 'statistics'
      });
      results.team_statistics = {
        available: !!teamData?.data?.statistics,
        count: teamData?.data?.statistics ? teamData.data.statistics.length : 0,
        sample: teamData?.data?.statistics ? teamData.data.statistics.slice(0, 5) : []
      };
    } catch (e) {
      results.team_statistics = { error: e.message };
    }
    
    // Test player statistics
    try {
      const playersData = await sportmonksRequest('/players', {
        per_page: 1,
        include: 'statistics'
      });
      results.player_statistics = {
        available: !!playersData?.data?.[0]?.statistics,
        count: playersData?.data?.[0]?.statistics ? playersData.data[0].statistics.length : 0,
        sample: playersData?.data?.[0]?.statistics ? playersData.data[0].statistics.slice(0, 5) : []
      };
    } catch (e) {
      results.player_statistics = { error: e.message };
    }
    
    // Test fixture statistics
    try {
      const fixturesData = await sportmonksRequest('/fixtures', {
        per_page: 1,
        include: 'statistics'
      });
      results.fixture_statistics = {
        available: !!fixturesData?.data?.[0]?.statistics,
        count: fixturesData?.data?.[0]?.statistics ? fixturesData.data[0].statistics.length : 0,
        sample: fixturesData?.data?.[0]?.statistics ? fixturesData.data[0].statistics.slice(0, 5) : []
      };
    } catch (e) {
      results.fixture_statistics = { error: e.message };
    }
    
    // Test season statistics
    try {
      const seasonsData = await sportmonksRequest('/seasons', {
        per_page: 1,
        include: 'statistics'
      });
      results.season_statistics = {
        available: !!seasonsData?.data?.[0]?.statistics,
        count: seasonsData?.data?.[0]?.statistics ? seasonsData.data[0].statistics.length : 0,
        sample: seasonsData?.data?.[0]?.statistics ? seasonsData.data[0].statistics.slice(0, 5) : []
      };
    } catch (e) {
      results.season_statistics = { error: e.message };
    }
    
    res.json({
      message: 'SportMonks Statistics Availability Test',
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
      // Filter out teams without country information (usually youth/reserve teams)
      const teams = sportmonksData.data
        .filter(team => team.country && team.country.name) // Only include teams with country
        .map(team => ({
          team: {
            id: team.id,
            name: team.name,
            code: team.short_code,
            country: team.country.name,
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
      console.log(`Found ${teams.length} teams from SportMonks (filtered by country)`);
      return res.json(teams);
    }
    
    // Fallback to API-Football
    console.log('SportMonks returned no results, trying API-Football...');
    const data = await apiFootballRequest('/teams', { search: name });
    // Also filter API-Football results
    const teams = (data?.response || []).filter(item => item.team && item.team.country);
    
    setCache(cacheKey, teams, CACHE_TTL.TEAMS);
    res.json(teams);
  } catch (err) {
    console.error("teams search error:", err.message);
    res.json([]);
  }
});

// ============================================
// SPORTMONKS TEAM SEARCH (Direct SportMonks search)
// ============================================
app.get("/api/sportmonks/teams/search", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.length < 1) return res.json({ data: [] });
    
    console.log(`SportMonks direct search for: ${name}`);
    
    const sportmonksData = await sportmonksRequest('/teams/search/' + encodeURIComponent(name));
    
    if (sportmonksData && sportmonksData.data) {
      console.log(`SportMonks found ${sportmonksData.data.length} teams`);
      return res.json(sportmonksData);
    }
    
    res.json({ data: [] });
  } catch (err) {
    console.error("SportMonks search error:", err.message);
    res.json({ data: [] });
  }
});

// ============================================
// TEAM STATISTICS (SportMonks)
// ============================================
app.get("/api/teams/:id/statistics", async (req, res) => {
  try {
    const originalId = req.params.id;
    const id = getCorrectTeamId(originalId);
    const season = req.query.season || 2025; // 2025-2026 season (use start year)
    
    const cacheKey = getCacheKey('team-statistics', { id, season });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // Get team name from API-Football first
    const apiFootballData = await apiFootballRequest('/teams', { id });
    const teamData = apiFootballData?.response?.[0];
    
    if (!teamData) {
      return res.json({ statistics: null, source: 'none' });
    }
    
    const teamName = teamData.team.name;
    
    // Search for team in SportMonks
    const searchData = await sportmonksRequest('/teams/search/' + teamName);
    
    if (!searchData || !searchData.data || searchData.data.length === 0) {
      return res.json({ statistics: null, source: 'not-found' });
    }
    
    const exactMatch = searchData.data.find(t => 
      t.name.toLowerCase() === teamName.toLowerCase()
    );
    const sportmonksTeam = exactMatch || searchData.data[0];
    const sportmonksId = sportmonksTeam.id;
    
    console.log(`Getting statistics for SportMonks team ${sportmonksId}`);
    
    // Get team statistics with details
    const teamStatsData = await sportmonksRequest(`/teams/${sportmonksId}`, {
      include: 'statistics.details'
    });
    
    if (!teamStatsData || !teamStatsData.data || !teamStatsData.data.statistics) {
      return res.json({ statistics: null, source: 'no-stats' });
    }
    
    // Find the most recent season statistics
    const stats = teamStatsData.data.statistics;
    const latestStat = stats.find(s => s.has_values && s.details && s.details.length > 0) || stats[0];
    
    console.log(`Found statistics with ${latestStat?.details?.length || 0} detail records`);
    
    const result = {
      statistics: latestStat,
      all_seasons: stats.map(s => ({ id: s.id, season_id: s.season_id, has_values: s.has_values })),
      team_name: teamData.team.name,
      sportmonks_id: sportmonksId,
      source: 'sportmonks'
    };
    
    setCache(cacheKey, result, CACHE_TTL.TEAMS);
    res.json(result);
  } catch (err) {
    console.error("team statistics error:", err.message);
    res.json({ statistics: null, source: 'error', error: err.message });
  }
});

// ============================================
// TEAM INFO (API-Football basic info)
// ============================================
app.get("/api/teams/:id/info", async (req, res) => {
  try {
    const originalId = req.params.id;
    const id = getCorrectTeamId(originalId);
    
    const cacheKey = getCacheKey('team-info', { id });
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // Get team info from API-Football
    const apiFootballData = await apiFootballRequest('/teams', { id });
    const teamData = apiFootballData?.response?.[0];
    
    if (!teamData) {
      return res.json({ team: {}, venue: {}, source: 'none' });
    }
    
    const result = {
      team: {
        id: teamData.team.id,
        name: teamData.team.name,
        code: teamData.team.code,
        country: teamData.team.country,
        founded: teamData.team.founded,
        logo: teamData.team.logo,
        national: teamData.team.national || false,
        type: teamData.team.national ? 'national' : 'domestic'
      },
      venue: {
        id: teamData.venue?.id,
        name: teamData.venue?.name || '',
        address: teamData.venue?.address || '',
        city: teamData.venue?.city || '',
        capacity: teamData.venue?.capacity || null,
        surface: teamData.venue?.surface || '',
        image: teamData.venue?.image || ''
      },
      source: 'api-football'
    };
    
    setCache(cacheKey, result, CACHE_TTL.TEAMS);
    res.json(result);
  } catch (err) {
    console.error("team info error:", err.message);
    res.json({ team: {}, venue: {}, source: 'error' });
  }
});

// ============================================
// TEAM FIXTURES (API-Football priority, SportMonks fallback)
// ============================================
app.get("/api/teams/:id/fixtures", async (req, res) => {
  console.log("Fixtures endpoint hit with id:", req.params.id);
  try {
    const originalId = req.params.id;
    const id = getCorrectTeamId(originalId);
    const season = 2025; // 2025-2026 season (use start year)
    
    console.log(`\n=== FIXTURES REQUEST ===`);
    console.log(`Original ID: ${originalId}, Mapped ID: ${id}`);
    console.log(`Fetching fixtures for team ${id}, season ${season}`);
    
    // Try API-Football first
    let data = await apiFootballRequest('/fixtures', { team: id, season });
    
    console.log(`API-Football: ${data?.response?.length || 0} fixtures for season ${season}`);
    
    // If no data for season 2025, try getting last 50 matches (any season)
    if (!data?.response || data.response.length === 0) {
      console.log(`No fixtures found for season ${season}, trying last 50 matches...`);
      data = await apiFootballRequest('/fixtures', { team: id, last: 50 });
      console.log(`API-Football: ${data?.response?.length || 0} fixtures from last 50`);
    }
    
    // If still no data, try SportMonks using correct schedules endpoint
    if (!data?.response || data.response.length === 0) {
      console.log(`API-Football returned no data, trying SportMonks schedules endpoint...`);
      const sportmonksData = await sportmonksRequest(`/schedules/teams/${id}`);
      
      if (sportmonksData?.data && sportmonksData.data.length > 0) {
        console.log(`SportMonks: ${sportmonksData.data.length} stages found`);
        
        // Extract all fixtures from stages and rounds
        const fixtures = [];
        for (const stage of sportmonksData.data) {
          if (stage.rounds) {
            for (const round of stage.rounds) {
              if (round.fixtures) {
                for (const f of round.fixtures) {
                  const homeTeam = f.participants?.find(p => p.meta?.location === 'home');
                  const awayTeam = f.participants?.find(p => p.meta?.location === 'away');
                  
                  // Find current/final scores (type_id: 1525 for CURRENT)
                  const homeScore = f.scores?.find(s => s.participant_id === homeTeam?.id && s.type_id === 1525);
                  const awayScore = f.scores?.find(s => s.participant_id === awayTeam?.id && s.type_id === 1525);
                  
                  fixtures.push({
                    fixture: {
                      id: f.id,
                      date: f.starting_at,
                      timestamp: f.starting_at_timestamp || (new Date(f.starting_at).getTime() / 1000),
                      status: {
                        short: f.state_id === 5 ? 'FT' : (f.state_id === 1 ? 'NS' : 'LIVE'),
                        long: f.result_info || 'Not Started'
                      }
                    },
                    league: {
                      id: f.league_id || stage.league_id || 0,
                      name: stage.name || '',
                      logo: ''
                    },
                    teams: {
                      home: {
                        id: homeTeam?.id || 0,
                        name: homeTeam?.name || '',
                        logo: homeTeam?.image_path || ''
                      },
                      away: {
                        id: awayTeam?.id || 0,
                        name: awayTeam?.name || '',
                        logo: awayTeam?.image_path || ''
                      }
                    },
                    goals: {
                      home: homeScore?.score?.goals || 0,
                      away: awayScore?.score?.goals || 0
                    }
                  });
                }
              }
            }
          }
        }
        
        console.log(`SportMonks: Extracted ${fixtures.length} fixtures from stages`);
        data = { response: fixtures };
      }
    }
    
    if (data?.response && data.response.length > 0) {
      console.log(`Total fixtures: ${data.response.length}`);
      console.log(`Date range: ${data.response[0].fixture.date} to ${data.response[data.response.length - 1].fixture.date}`);
    } else {
      console.log(`⚠️ NO FIXTURES FOUND for team ${id} from any source`);
    }
    console.log(`=== END FIXTURES ===\n`);
    
    res.json({ fixtures: data?.response || [] });
  } catch (err) {
    console.error("team fixtures error:", err.message);
    res.json({ fixtures: [] });
  }
});

console.log("Team API routes registered");

// ============================================
// TEAM STANDINGS (API-Football priority, SportMonks fallback)
// ============================================
app.get("/api/teams/:id/standings", async (req, res) => {
  try {
    const originalId = req.params.id;
    const id = getCorrectTeamId(originalId);
    const season = 2025; // 2025-2026 season (use start year)
    
    console.log(`\n=== STANDINGS REQUEST ===`);
    console.log(`Fetching standings for team ${id}, season ${season}`);
    
    let teamStandings = await apiFootballRequest('/standings', { team: id, season });
    
    // If no data for season 2025, try current season (no season parameter)
    if (!teamStandings?.response || teamStandings.response.length === 0) {
      console.log(`No standings found for season ${season}, trying current season...`);
      teamStandings = await apiFootballRequest('/standings', { team: id });
    }
    
    const teamData = teamStandings?.response || [];
    console.log(`API-Football: Team is in ${teamData.length} leagues`);
    
    const fullStandings = [];
    for (const standing of teamData) {
      const leagueId = standing.league.id;
      const leagueSeason = standing.league.season; // Use the season from the response
      console.log(`Fetching full standings for league ${leagueId}, season ${leagueSeason}`);
      
      const leagueStandings = await apiFootballRequest('/standings', { league: leagueId, season: leagueSeason });
      
      if (leagueStandings?.response && leagueStandings.response.length > 0) {
        fullStandings.push(leagueStandings.response[0]);
      }
    }
    
    // If no standings from API-Football, try SportMonks
    if (fullStandings.length === 0) {
      console.log(`API-Football returned no standings, trying SportMonks...`);
      
      // First, get team info to find which leagues they're in
      const teamInfo = await sportmonksRequest(`/teams/${id}`, {
        include: 'activeSeasons.league'
      });
      
      if (teamInfo?.data?.active_seasons) {
        console.log(`Team is in ${teamInfo.data.active_seasons.length} active seasons`);
        
        for (const activeSeason of teamInfo.data.active_seasons) {
          const leagueId = activeSeason.league_id;
          const seasonId = activeSeason.id;
          
          console.log(`Fetching standings for league ${leagueId}, season ${seasonId}`);
          
          // Use the correct SportMonks standings endpoint with filters
          const standingsData = await sportmonksRequest(`/standings`, {
            filter: `standingLeagues:${leagueId};standingSeasons:${seasonId}`,
            include: 'participant;league'
          });
          
          if (standingsData?.data && standingsData.data.length > 0) {
            // Group standings by league
            const standingsByLeague = {};
            
            for (const standing of standingsData.data) {
              const leagueKey = standing.league_id;
              if (!standingsByLeague[leagueKey]) {
                standingsByLeague[leagueKey] = {
                  league: standing.league || activeSeason.league,
                  standings: []
                };
              }
              
              standingsByLeague[leagueKey].standings.push({
                rank: standing.position || 0,
                team: {
                  id: standing.participant?.id || 0,
                  name: standing.participant?.name || '',
                  logo: standing.participant?.image_path || ''
                },
                points: standing.points || 0,
                goalsDiff: (standing.result?.overall?.goals_scored || 0) - (standing.result?.overall?.goals_against || 0),
                all: {
                  played: standing.result?.overall?.games_played || 0,
                  win: standing.result?.overall?.won || 0,
                  draw: standing.result?.overall?.draw || 0,
                  lose: standing.result?.overall?.lost || 0,
                  goals: {
                    for: standing.result?.overall?.goals_scored || 0,
                    against: standing.result?.overall?.goals_against || 0
                  }
                }
              });
            }
            
            // Convert to API-Football format
            for (const [leagueKey, data] of Object.entries(standingsByLeague)) {
              fullStandings.push({
                league: {
                  id: data.league?.id || 0,
                  name: data.league?.name || '',
                  logo: data.league?.image_path || '',
                  season: seasonId
                },
                standings: [data.standings.sort((a, b) => a.rank - b.rank)]
              });
            }
          }
        }
      }
    }
    
    console.log(`Returning ${fullStandings.length} league standings`);
    console.log(`=== END STANDINGS ===\n`);
    res.json({ standings: fullStandings });
  } catch (err) {
    console.error("team standings error:", err.message);
    res.json({ standings: [] });
  }
});

// ============================================
// TEAM PLAYERS/SQUAD (SportMonks priority, fallback API-Football)
// ============================================
// TEAM PLAYERS/SQUAD (SportMonks priority, fallback API-Football)
// ============================================
app.get("/api/teams/:id/players", async (req, res) => {
  try {
    const originalId = req.params.id;
    const id = getCorrectTeamId(originalId);
    let season = req.query.season || 2025; // 2025-2026 season (use start year)
    
    console.log(`\n=== PLAYERS REQUEST ===`);
    console.log(`Original ID: ${originalId}, Mapped ID: ${id}, Season: ${season}`);
    
    const cacheKey = getCacheKey('team-players', { id, season });
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('Returning cached players');
      return res.json(cached);
    }

    // Try SportMonks first - use extended squad endpoint (gets current season automatically)
    console.log(`Trying SportMonks extended squad for team ${id}...`);
    const sportmonksData = await sportmonksRequest(`/squads/teams/${id}`, {
      include: 'player;player.position;player.nationality;player.detailedPosition;player.statistics.details'
    });
    
    if (sportmonksData && sportmonksData.data && sportmonksData.data.length > 0) {
      console.log(`SportMonks returned ${sportmonksData.data.length} players`);
      
      // Debug: Check first player structure
      if (sportmonksData.data[0]) {
        const firstSquad = sportmonksData.data[0];
        console.log('First squad team_id:', firstSquad.team_id);
        console.log('First squad player name:', firstSquad.player?.display_name || firstSquad.player?.common_name);
        console.log('First squad jersey:', firstSquad.jersey_number);
      }
      
      // Convert SportMonks format to enhanced format
      const players = sportmonksData.data.map(squad => {
        const player = squad.player;
        const stats = player.statistics && player.statistics.length > 0 ? player.statistics[0] : null;
        const details = stats?.details || [];
        
        // Extract detailed statistics using correct type IDs
        const findStat = (typeId) => details.find(d => d.type_id === typeId);
        
        // Helper to get value from stat
        const getStatValue = (typeId, path = 'total') => {
          const stat = findStat(typeId);
          if (!stat || !stat.value) return null;
          if (path === 'total') return stat.value.total || stat.value;
          const keys = path.split('.');
          let value = stat.value;
          for (const key of keys) {
            value = value?.[key];
          }
          return value;
        };
        
        return {
          player: {
            id: player.player_id || player.id || 0,
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
            photo: player.image_path || '',
            number: squad.jersey_number || null,
            position: player.detailedPosition?.name || player.position?.name || 'Unknown'
          },
          statistics: [{
            team: {
              id: id,
              name: '',
              logo: ''
            },
            games: {
              appearences: getStatValue(321) || 0,  // Type 321: Appearances
              lineups: getStatValue(322) || 0,      // Type 322: Lineups
              minutes: getStatValue(119) || 0,      // Type 119: Minutes Played
              number: squad.jersey_number || null,
              position: player.detailedPosition?.name || player.position?.name || squad.position || 'Unknown',
              rating: getStatValue(118) || null,    // Type 118: Rating
              captain: squad.captain || false
            },
            goals: {
              total: getStatValue(52) || 0,         // Type 52: Goals
              conceded: getStatValue(88) || null,   // Type 88: Goals Conceded
              assists: getStatValue(79) || 0,       // Type 79: Assists
              saves: getStatValue(57) || null       // Type 57: Saves
            },
            shots: {
              total: getStatValue(42) || null,      // Type 42: Shots Total
              on: getStatValue(86) || null,         // Type 86: Shots On Target
              accuracy: null  // Will calculate if both values exist
            },
            passes: {
              total: getStatValue(80) || null,      // Type 80: Passes
              accuracy: getStatValue(1584) || null, // Type 1584: Accurate Passes Percentage
              key: getStatValue(117) || null        // Type 117: Key Passes
            },
            tackles: {
              total: getStatValue(78) || null,      // Type 78: Tackles
              blocks: getStatValue(97) || null,     // Type 97: Blocked Shots
              interceptions: getStatValue(100) || null  // Type 100: Interceptions
            },
            cards: {
              yellow: getStatValue(84) || 0,        // Type 84: Yellow Cards
              yellowred: getStatValue(85) || 0,     // Type 85: Yellow-Red Cards
              red: getStatValue(83) || 0            // Type 83: Red Cards
            },
            penalty: {
              scored: getStatValue(47, 'scored') || null,   // Type 47: Penalties
              missed: getStatValue(47, 'missed') || null,
              saved: null
            }
          }]
        };
      });
      
      // Calculate shot accuracy where possible
      players.forEach(p => {
        const stats = p.statistics[0];
        if (stats.shots.total && stats.shots.on) {
          stats.shots.accuracy = (stats.shots.on / stats.shots.total * 100).toFixed(1);
        }
      });
      
      const result = { players, coach: null, season: 'current', source: 'sportmonks' };
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
// PLAYER TRANSFERS (SportMonks)
// ============================================
app.get("/api/players/:id/transfers", async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Fetching transfers for player ${id}`);
    
    const cacheKey = getCacheKey('player-transfers', { id });
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('Returning cached transfers');
      return res.json(cached);
    }

    // Get player transfers from SportMonks
    const transfersData = await sportmonksRequest(`/players/${id}`, {
      include: 'transfers'
    });
    
    if (transfersData && transfersData.data && transfersData.data.transfers) {
      const transfers = transfersData.data.transfers;
      console.log(`Found ${transfers.length} transfers for player ${id}`);
      
      const result = { transfers, source: 'sportmonks' };
      setCache(cacheKey, result, CACHE_TTL.PLAYERS);
      return res.json(result);
    }
    
    // No transfers found
    res.json({ transfers: [], source: 'none' });
  } catch (err) {
    console.error("player transfers error:", err.message);
    res.json({ transfers: [], source: 'error' });
  }
});

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
