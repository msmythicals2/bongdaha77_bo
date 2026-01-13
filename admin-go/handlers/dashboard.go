package handlers

import (
	"admin-go/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func GetDashboard(c *gin.Context) {
	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

	// Today's stats - PV is sum of page_view_count, UV is count of unique IPs
	var todayPV int
	models.DB.QueryRow(`SELECT COALESCE(SUM(page_view_count), 0) FROM visitor_logs WHERE DATE(visit_time) = ?`, today).Scan(&todayPV)

	// UV = unique IPs (count of distinct IP addresses)
	var todayUV int
	models.DB.QueryRow(`SELECT COUNT(DISTINCT ip_address) FROM visitor_logs WHERE DATE(visit_time) = ?`, today).Scan(&todayUV)

	// Unique IPs is same as UV for today
	todayIPs := todayUV

	// Yesterday's stats
	var yesterdayPV int
	models.DB.QueryRow(`SELECT COALESCE(SUM(page_view_count), 0) FROM visitor_logs WHERE DATE(visit_time) = ?`, yesterday).Scan(&yesterdayPV)
	var yesterdayUV int
	models.DB.QueryRow(`SELECT COUNT(DISTINCT ip_address) FROM visitor_logs WHERE DATE(visit_time) = ?`, yesterday).Scan(&yesterdayUV)

	// Total articles
	var totalArticles, publishedArticles int
	models.DB.QueryRow("SELECT COUNT(*) FROM articles").Scan(&totalArticles)
	models.DB.QueryRow("SELECT COUNT(*) FROM articles WHERE is_published = 1").Scan(&publishedArticles)

	// Total categories
	var totalCategories int
	models.DB.QueryRow("SELECT COUNT(*) FROM categories WHERE is_enabled = 1").Scan(&totalCategories)

	// Blacklist count
	var blacklistCount int
	models.DB.QueryRow("SELECT COUNT(*) FROM ip_blacklist").Scan(&blacklistCount)

	// Real-time online (visitors in last 5 minutes)
	var realtimeOnline int
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute).Format("2006-01-02 15:04:05")
	models.DB.QueryRow(`
		SELECT COUNT(DISTINCT visitor_id) FROM visitor_logs 
		WHERE last_visit_time >= ?`, fiveMinutesAgo).Scan(&realtimeOnline)

	// Last 7 days trend - Calculate from visitor_logs directly
	var trends []map[string]interface{}
	sevenDaysAgo := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	rows, _ := models.DB.Query(`
		SELECT DATE(visit_time) as date, 
		       SUM(page_view_count) as pv, 
		       COUNT(DISTINCT ip_address) as uv 
		FROM visitor_logs 
		WHERE DATE(visit_time) >= ? 
		GROUP BY DATE(visit_time)
		ORDER BY date`, sevenDaysAgo)
	defer rows.Close()

	for rows.Next() {
		var date string
		var pv, uv int
		rows.Scan(&date, &pv, &uv)
		trends = append(trends, map[string]interface{}{
			"date": date,
			"pv":   pv,
			"uv":   uv,
		})
	}

	// Recent visitors (last 10)
	var recentVisitors []map[string]interface{}
	visitorRows, _ := models.DB.Query(`
		SELECT ip_address, page_path, device_type, browser, visit_time 
		FROM visitor_logs 
		ORDER BY visit_time DESC 
		LIMIT 10`)
	defer visitorRows.Close()

	for visitorRows.Next() {
		var ip, path, device, browser string
		var visitTime time.Time
		visitorRows.Scan(&ip, &path, &device, &browser, &visitTime)
		recentVisitors = append(recentVisitors, map[string]interface{}{
			"ip":         ip,
			"page":       path,
			"device":     device,
			"browser":    browser,
			"visit_time": visitTime,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"today": gin.H{
				"pv":  todayPV,
				"uv":  todayUV,
				"ips": todayIPs,
			},
			"yesterday": gin.H{
				"pv": yesterdayPV,
				"uv": yesterdayUV,
			},
			"realtime_online":    realtimeOnline,
			"total_articles":     totalArticles,
			"published_articles": publishedArticles,
			"total_categories":   totalCategories,
			"blacklist_count":    blacklistCount,
			"trends":             trends,
			"recent_visitors":    recentVisitors,
		},
	})
}
