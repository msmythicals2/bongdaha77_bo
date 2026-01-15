require("dotenv").config();

const express = require("express");
const axios = require("axios");
const RSSParser = require("rss-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const parser = new RSSParser();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FOOTBALL_API_KEY;
const BASE_URL = "https://v3.football.api-sports.io";
const ADMIN_API_URL = process.env.ADMIN_API_URL || "http://localhost:8080";
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN || "https://localhost:3000";

function parseAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

if (!API_KEY) {
  console.error("FOOTBALL_API_KEY missing in .env");
  process.exit(1);
}

// CORS configuration for cross-domain requests
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

// Config endpoint for frontend
app.get("/api/config", (req, res) => {
  res.json({
    adminApiUrl: ADMIN_API_URL,
    frontendDomain: FRONTEND_DOMAIN
  });
});

// Admin panel - MUST be before static middleware
app.use("/admin-HHrg9404nflfja22f", express.static(path.join(__dirname, "admin-HHrg9404nflfja22f")));

// static
app.use(express.static(path.join(__dirname, "public")));

// home
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API headers
const headers = {
  "x-apisports-key": API_KEY
};

// leagues
app.get("/api/leagues", async (req, res) => {
  try {
    const r = await axios.get(`${BASE_URL}/leagues`, { headers });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("leagues error:", err.message);
    res.json([]);
  }
});

// teams by league
app.get("/api/teams", async (req, res) => {
  try {
    const { league, season } = req.query;
    if (!league || !season) return res.json([]);
    const r = await axios.get(`${BASE_URL}/teams`, { headers, params: { league, season } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("teams error:", err.message);
    res.json([]);
  }
});

// standings
app.get("/api/standings", async (req, res) => {
  try {
    const { league, season } = req.query;
    if (!league || !season) return res.json([]);
    const r = await axios.get(`${BASE_URL}/standings`, { headers, params: { league, season } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("standings error:", err.message);
    res.json([]);
  }
});

// top scorers
app.get("/api/top-scorers", async (req, res) => {
  try {
    const { league, season } = req.query;
    if (!league || !season) return res.json([]);
    const r = await axios.get(`${BASE_URL}/players/topscorers`, { headers, params: { league, season } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("top-scorers error:", err.message);
    res.json([]);
  }
});

// fixtures by date
app.get("/api/fixtures", async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json([]);
    const r = await axios.get(`${BASE_URL}/fixtures`, { headers, params: { date } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("fixtures error:", err.message);
    res.json([]);
  }
});

// live fixtures
app.get("/api/live", async (req, res) => {
  try {
    const r = await axios.get(`${BASE_URL}/fixtures`, { headers, params: { live: "all" } });
    const matches = r.data?.response || [];
    
    // 只返回真实的Live数据，过滤掉测试数据
    const realLiveMatches = matches.filter(match => {
      const matchDate = new Date(match.fixture.date);
      const now = new Date();
      const timeDiff = Math.abs(now - matchDate);
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // 只保留当前时间前后3小时内的比赛（真实的Live比赛应该在这个范围内）
      // 并且必须有有效的elapsed时间或者是真实的Live状态
      return hoursDiff <= 3 && 
             (match.fixture.status.elapsed !== null || 
              ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(match.fixture.status.short));
    });
    
    console.log(`Live API: ${matches.length} total matches, ${realLiveMatches.length} real live matches`);
    res.json(realLiveMatches);
  } catch (err) {
    console.error("live error:", err.message);
    res.json([]);
  }
});

// news rss
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

// Fixture Detail
app.get("/api/fixture-detail", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json({});
    const r = await axios.get(`${BASE_URL}/fixtures`, { headers, params: { id } });
    res.json(r.data || {});
  } catch (err) {
    console.error("fixture-detail error:", err.message);
    res.json({});
  }
});

// Fixture Events
app.get("/api/fixture-events", async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.json([]);
    const r = await axios.get(`${BASE_URL}/fixtures/events`, { headers, params: { fixture: id } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("fixture-events error:", err.message);
    res.json([]);
  }
});

// Head to Head
app.get("/api/h2h", async (req, res) => {
  try {
    const { h2h } = req.query;
    if (!h2h) return res.json([]);
    const r = await axios.get(`${BASE_URL}/fixtures/headtohead`, { headers, params: { h2h, last: 10 } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("h2h error:", err.message);
    res.json([]);
  }
});

// Search teams by name
app.get("/api/teams/search", async (req, res) => {
  console.log("Search endpoint hit with name:", req.query.name);
  try {
    const { name } = req.query;
    if (!name || name.length < 1) return res.json([]);
    const r = await axios.get(`${BASE_URL}/teams`, { headers, params: { search: name } });
    res.json(r.data?.response || []);
  } catch (err) {
    console.error("teams search error:", err.message);
    res.json([]);
  }
});

console.log("Team search route registered");

// Verify team IDs endpoint - checks if team IDs match expected teams
app.get("/api/teams/verify-ids", async (req, res) => {
  try {
    const teamIds = req.query.ids ? req.query.ids.split(',') : [];
    if (teamIds.length === 0) {
      return res.json({ error: "No team IDs provided. Use ?ids=33,40,529" });
    }

    const results = [];
    for (const id of teamIds) {
      try {
        const r = await axios.get(`${BASE_URL}/teams`, { 
          headers, 
          params: { id: id.trim() } 
        });
        
        if (r.data?.response && r.data.response.length > 0) {
          const teamData = r.data.response[0];
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
        
        // Add small delay to avoid rate limiting
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

// Test endpoint
app.get("/api/teams/:id/test", (req, res) => {
  console.log("Test endpoint hit with id:", req.params.id);
  res.json({ message: "Test successful", id: req.params.id });
});

// Team Fixtures
app.get("/api/teams/:id/fixtures", async (req, res) => {
  console.log("Fixtures endpoint hit with id:", req.params.id);
  try {
    const { id } = req.params;
    // Current season: 2025-2026 season is represented as 2025 in the API
    const season = 2025;
    
    console.log(`Fetching fixtures for team ${id}, season ${season}`);
    
    const r = await axios.get(`${BASE_URL}/fixtures`, { 
      headers, 
      params: { team: id, season } 
    });
    
    console.log(`Received ${r.data?.response?.length || 0} fixtures for team ${id}`);
    
    res.json({ fixtures: r.data?.response || [] });
  } catch (err) {
    console.error("team fixtures error:", err.message);
    if (err.response) {
      console.error("API response:", err.response.status, err.response.data);
    }
    res.json({ fixtures: [] });
  }
});

console.log("Team API routes registered");

// Team Standings
app.get("/api/teams/:id/standings", async (req, res) => {
  try {
    const { id } = req.params;
    const season = 2025;
    
    console.log(`Fetching standings for team ${id}, season ${season}`);
    
    // First, get team's current standings to find their leagues
    const teamStandings = await axios.get(`${BASE_URL}/standings`, { 
      headers, 
      params: { team: id, season } 
    });
    
    const teamData = teamStandings.data?.response || [];
    console.log(`Team is in ${teamData.length} leagues`);
    
    // Get full standings for each league the team is in
    const fullStandings = [];
    for (const standing of teamData) {
      const leagueId = standing.league.id;
      console.log(`Fetching full standings for league ${leagueId}`);
      
      const leagueStandings = await axios.get(`${BASE_URL}/standings`, { 
        headers, 
        params: { league: leagueId, season } 
      });
      
      if (leagueStandings.data?.response && leagueStandings.data.response.length > 0) {
        fullStandings.push(leagueStandings.data.response[0]);
      }
    }
    
    console.log(`Returning ${fullStandings.length} league standings`);
    res.json({ standings: fullStandings });
  } catch (err) {
    console.error("team standings error:", err.message);
    if (err.response) {
      console.error("API response:", err.response.status, err.response.data);
    }
    res.json({ standings: [] });
  }
});

// Team Players
app.get("/api/teams/:id/players", async (req, res) => {
  try {
    const { id } = req.params;
    let season = req.query.season || 2025; // Allow season override from query
    
    console.log(`Fetching players for team ${id}, season ${season}`);
    
    // Try current season first
    let r = await axios.get(`${BASE_URL}/players`, { 
      headers, 
      params: { team: id, season } 
    });
    
    let players = r.data?.response || [];
    console.log(`Received ${players.length} players for team ${id}, season ${season}`);
    
    // If no players found or very few players, try previous season as fallback
    if (players.length < 5 && season === 2025) {
      console.log(`Few players found for season 2025, trying season 2024 as fallback...`);
      const fallbackResponse = await axios.get(`${BASE_URL}/players`, { 
        headers, 
        params: { team: id, season: 2024 } 
      });
      
      const fallbackPlayers = fallbackResponse.data?.response || [];
      console.log(`Received ${fallbackPlayers.length} players for team ${id}, season 2024`);
      
      // Use fallback if it has more players
      if (fallbackPlayers.length > players.length) {
        players = fallbackPlayers;
        season = 2024;
        console.log(`Using season 2024 data (${players.length} players)`);
      }
    }
    
    // Log first few player names for debugging
    if (players.length > 0) {
      const playerNames = players.slice(0, 5).map(p => p.player?.name);
      console.log(`First 5 players: ${playerNames.join(', ')}`);
    }
    
    res.json({ players, coach: null, season });
  } catch (err) {
    console.error("team players error:", err.message);
    if (err.response) {
      console.error("API response:", err.response.status, err.response.data);
    }
    res.json({ players: [], coach: null });
  }
});

// Test endpoint to search for a specific player
app.get("/api/players/search", async (req, res) => {
  try {
    const { name, id } = req.query;
    const params = {};
    
    if (id) params.id = id;
    if (name) params.search = name;
    
    console.log(`Searching for player:`, params);
    
    const r = await axios.get(`${BASE_URL}/players`, { 
      headers, 
      params 
    });
    
    console.log(`Found ${r.data?.response?.length || 0} players`);
    
    res.json({ players: r.data?.response || [] });
  } catch (err) {
    console.error("player search error:", err.message);
    res.json({ players: [] });
  }
});

// Team Info
app.get("/api/teams/:id/info", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await axios.get(`${BASE_URL}/teams`, { 
      headers, 
      params: { id } 
    });
    const teamData = r.data?.response?.[0];
    res.json({ team: teamData?.team || {}, venue: teamData?.venue || {} });
  } catch (err) {
    console.error("team info error:", err.message);
    res.json({ team: {}, venue: {} });
  }
});

// Dynamic route handler - checks if slug is category or article
// IMPORTANT: This must be AFTER all API routes
app.get("/:slug", async (req, res, next) => {
  const slug = req.params.slug;
  
  console.log("Dynamic route hit with slug:", slug);
  
  // Skip if it's a known route or file
  const skip = ['api', 'admin-HHrg9404nflfja22f', 'logo.svg', 'style.css', 'main.js', 'tracker.js', 'config.js', 'article.html', 'articles.html'];
  if (skip.includes(slug)) {
    console.log("Skipping slug:", slug);
    return next();
  }
  
  try {
    // Check if it's a category by calling the API
    const categoriesRes = await axios.get(`${ADMIN_API_URL}/api/public/categories`);
    if (categoriesRes.data && categoriesRes.data.success) {
      const isCategory = categoriesRes.data.data.some(c => c.slug === slug);
      
      if (isCategory) {
        // It's a category, serve articles.html
        return res.sendFile(path.join(__dirname, "public", "articles.html"));
      }
    }
    
    // Not a category, assume it's an article
    res.sendFile(path.join(__dirname, "public", "article.html"));
  } catch (err) {
    console.error("Error checking slug type:", err.message);
    // On error, default to article page
    res.sendFile(path.join(__dirname, "public", "article.html"));
  }
});

// 404 handler
app.use((req, res) => {
  console.log("404 - Not found:", req.method, req.url);
  res.status(404).json({ error: "Not found" });
});

// listen
app.listen(PORT, () => {
  console.log("Bongdaha Server Running");
  console.log(`http://localhost:${PORT}`);
});