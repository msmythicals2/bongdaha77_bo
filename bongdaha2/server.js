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

// Dynamic route handler - checks if slug is category or article
app.get("/:slug", async (req, res, next) => {
  const slug = req.params.slug;
  
  // Skip if it's a known route or file
  const skip = ['api', 'admin-HHrg9404nflfja22f', 'logo.svg', 'style.css', 'main.js', 'tracker.js', 'config.js', 'article.html', 'articles.html'];
  if (skip.includes(slug)) {
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

// listen
app.listen(PORT, () => {
  console.log("Bongdaha Server Running");
  console.log(`http://localhost:${PORT}`);
});
