package handlers

import (
	"admin-go/models"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// Common spider/bot user agent patterns
var botPatterns = []string{
	"googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider",
	"yandexbot", "sogou", "exabot", "facebot", "facebookexternalhit",
	"ia_archiver", "alexa", "msnbot", "ahrefsbot", "semrushbot",
	"dotbot", "rogerbot", "gigabot", "voilabot", "adsbot",
	"mediapartners-google", "apis-google", "feedfetcher",
	"spider", "crawler", "bot", "scraper", "curl", "wget",
	"python-requests", "python-urllib", "java", "apache-httpclient",
	"go-http-client", "headlesschrome", "phantomjs", "selenium",
	"puppeteer", "lighthouse", "pagespeed", "gtmetrix",
}

func isBot(userAgent string) bool {
	ua := strings.ToLower(userAgent)
	for _, pattern := range botPatterns {
		if strings.Contains(ua, pattern) {
			return true
		}
	}
	return false
}

func Track(c *gin.Context) {
	// Exclude bots/spiders from tracking
	userAgent := c.GetHeader("User-Agent")
	if isBot(userAgent) {
		c.JSON(http.StatusOK, gin.H{"success": true, "ignored": "bot"})
		return
	}

	var req models.TrackingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid request"})
		return
	}

	ip := getClientIP(c)
	now := time.Now()

	switch strings.ToLower(req.Action) {
	case "pageview":
		recordPageView(req, ip, now)
	case "heartbeat":
		recordHeartbeat(req, ip, now)
	case "leave":
		recordLeave(req, ip, now)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid action"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func recordPageView(req models.TrackingRequest, ip string, now time.Time) {
	today := now.Format("2006-01-02")

	// Check if this IP has visited before today (to determine if new visitor)
	var hasVisitedBefore int
	models.DB.QueryRow(`
		SELECT COUNT(*) FROM visitor_logs 
		WHERE ip_address = ? AND DATE(visit_time) < ?`, ip, today).Scan(&hasVisitedBefore)

	isNewVisitor := hasVisitedBefore == 0

	// Check if visitor exists today (same IP on same day)
	var existingID int64
	var existingPageViewCount int
	var existingVisitedPages string
	err := models.DB.QueryRow(`
		SELECT id, page_view_count, COALESCE(visited_pages, '[]') FROM visitor_logs 
		WHERE ip_address = ? AND DATE(visit_time) = ?`, ip, today).Scan(&existingID, &existingPageViewCount, &existingVisitedPages)

	screenRes := ""
	if req.ScreenWidth > 0 && req.ScreenHeight > 0 {
		screenRes = string(rune(req.ScreenWidth)) + "x" + string(rune(req.ScreenHeight))
	}

	if err == nil {
		// Update existing record - increment PV count
		var visitedPages []string
		json.Unmarshal([]byte(existingVisitedPages), &visitedPages)

		// Add current page if not already in list
		pagePath := req.PagePath
		if pagePath == "" {
			pagePath = "/"
		}
		pageExists := false
		for _, p := range visitedPages {
			if p == pagePath {
				pageExists = true
				break
			}
		}
		if !pageExists {
			visitedPages = append(visitedPages, pagePath)
		}
		visitedPagesJson, _ := json.Marshal(visitedPages)

		models.DB.Exec(`
			UPDATE visitor_logs 
			SET page_view_count = page_view_count + 1, 
			    last_visit_time = ?,
			    visited_pages = ?
			WHERE id = ?`, now, string(visitedPagesJson), existingID)

		// Update daily stats - increment PV only (UV already counted)
		updateDailyStatsPV(today)
	} else {
		// Create new record - first visit today from this IP
		visitedPages, _ := json.Marshal([]string{req.PagePath})

		// Try to get geo-location info (placeholder - you'll need a geo service)
		countryCode, countryName, city := getGeoLocation(ip)

		models.DB.Exec(`
			INSERT INTO visitor_logs (
				ip_address, visitor_id, session_id, page_path, page_type, 
				reference_id, referrer, user_agent, device_type, os, browser,
				screen_resolution, country_code, country_name, city,
				visit_time, is_new_visitor, page_view_count, 
				visited_pages, last_visit_time
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			ip, req.VisitorId, req.SessionId, req.PagePath, req.PageType,
			req.ReferenceId, req.Referrer, "", req.DeviceType, req.OS, req.Browser,
			screenRes, countryCode, countryName, city,
			now, isNewVisitor, 1, string(visitedPages), now)

		// Update daily stats - increment both PV and UV
		updateDailyStatsNew(today, ip, isNewVisitor)
	}
}

func recordHeartbeat(req models.TrackingRequest, ip string, now time.Time) {
	roomKey := "global"
	if req.PageType == "live" && req.ReferenceId != "" {
		roomKey = "match_" + req.ReferenceId
	}

	// Update realtime stats
	var existingRoom int64
	err := models.DB.QueryRow("SELECT id FROM realtime_stats WHERE room_key = ?", roomKey).Scan(&existingRoom)

	if err == nil {
		if req.Status == "leave" || req.Event == "visibility_hidden" {
			models.DB.Exec(`
				UPDATE realtime_stats 
				SET online_count = MAX(0, online_count - 1), last_updated = ? 
				WHERE room_key = ?`, now, roomKey)
		} else {
			models.DB.Exec(`
				UPDATE realtime_stats 
				SET last_updated = ? 
				WHERE room_key = ?`, now, roomKey)
		}
	} else {
		models.DB.Exec(`
			INSERT INTO realtime_stats (room_key, online_count, last_updated) 
			VALUES (?, 1, ?)`, roomKey, now)
	}

	// Update visitor last visit time
	models.DB.Exec(`
		UPDATE visitor_logs 
		SET last_visit_time = ? 
		WHERE visitor_id = ? AND DATE(visit_time) = ?`,
		now, req.VisitorId, now.Format("2006-01-02"))
}

func recordLeave(req models.TrackingRequest, ip string, now time.Time) {
	if req.Duration > 0 {
		models.DB.Exec(`
			UPDATE visitor_logs 
			SET duration = ? 
			WHERE visitor_id = ? AND page_path = ? 
			ORDER BY visit_time DESC 
			LIMIT 1`, req.Duration, req.VisitorId, req.PagePath)
	}

	// Update realtime stats
	req.Status = "leave"
	recordHeartbeat(req, ip, now)
}

func updateDailyStatsNew(date string, ip string, isNewVisitor bool) {
	// First visit today from this IP - increment PV, UV, and unique IPs
	var existingID int64
	err := models.DB.QueryRow("SELECT id FROM daily_stats WHERE stats_date = ?", date).Scan(&existingID)

	if err == nil {
		// Update existing daily_stats record
		if isNewVisitor {
			models.DB.Exec(`
				UPDATE daily_stats 
				SET page_views = page_views + 1,
				    unique_visitors = unique_visitors + 1,
				    unique_ips = unique_ips + 1,
				    new_visitors = new_visitors + 1,
				    updated_at = CURRENT_TIMESTAMP 
				WHERE stats_date = ?`, date)
		} else {
			models.DB.Exec(`
				UPDATE daily_stats 
				SET page_views = page_views + 1,
				    unique_visitors = unique_visitors + 1,
				    unique_ips = unique_ips + 1,
				    returning_visitors = returning_visitors + 1,
				    updated_at = CURRENT_TIMESTAMP 
				WHERE stats_date = ?`, date)
		}
	} else {
		// Create new daily_stats record
		newVisitorCount := 0
		returningVisitorCount := 0
		if isNewVisitor {
			newVisitorCount = 1
		} else {
			returningVisitorCount = 1
		}
		models.DB.Exec(`
			INSERT INTO daily_stats (stats_date, page_views, unique_visitors, unique_ips, new_visitors, returning_visitors) 
			VALUES (?, 1, 1, 1, ?, ?)`, date, newVisitorCount, returningVisitorCount)
	}
}

func updateDailyStatsPV(date string) {
	// Existing visitor today - only increment PV
	var existingID int64
	err := models.DB.QueryRow("SELECT id FROM daily_stats WHERE stats_date = ?", date).Scan(&existingID)

	if err == nil {
		// Update existing daily_stats record - only increment page_views
		models.DB.Exec(`
			UPDATE daily_stats 
			SET page_views = page_views + 1,
			    updated_at = CURRENT_TIMESTAMP 
			WHERE stats_date = ?`, date)
	} else {
		// This shouldn't happen, but create a record just in case
		models.DB.Exec(`
			INSERT INTO daily_stats (stats_date, page_views, unique_visitors, unique_ips, new_visitors) 
			VALUES (?, 1, 0, 0, 0)`, date)
	}
}

func GetOnlineCount(c *gin.Context) {
	room := c.Query("room")

	var total int
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute).Format("2006-01-02 15:04:05")

	if room != "" {
		models.DB.QueryRow(`
			SELECT COALESCE(online_count, 0) FROM realtime_stats 
			WHERE room_key = ? AND last_updated >= ?`, room, fiveMinutesAgo).Scan(&total)
	} else {
		models.DB.QueryRow(`
			SELECT COALESCE(SUM(online_count), 0) FROM realtime_stats 
			WHERE last_updated >= ?`, fiveMinutesAgo).Scan(&total)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"total":   total,
	})
}

func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}

	// Check X-Real-IP header
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip := c.ClientIP()
	if ip == "::1" {
		return "127.0.0.1"
	}
	return ip
}
