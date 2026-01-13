package handlers

import (
	"admin-go/models"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func GetVisitorStats(c *gin.Context) {
	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	last7Days := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	last30Days := time.Now().AddDate(0, 0, -30).Format("2006-01-02")

	// Today stats - PV is sum of page_view_count, UV is unique IPs
	var todayPV int
	models.DB.QueryRow(`SELECT COALESCE(SUM(page_view_count), 0) FROM visitor_logs WHERE DATE(visit_time) = ?`, today).Scan(&todayPV)

	var todayUV int
	models.DB.QueryRow(`SELECT COUNT(DISTINCT ip_address) FROM visitor_logs WHERE DATE(visit_time) = ?`, today).Scan(&todayUV)

	var todayNew int
	models.DB.QueryRow(`SELECT COUNT(*) FROM visitor_logs WHERE DATE(visit_time) = ? AND is_new_visitor = 1`, today).Scan(&todayNew)

	// Yesterday stats
	var yesterdayPV int
	models.DB.QueryRow(`SELECT COALESCE(SUM(page_view_count), 0) FROM visitor_logs WHERE DATE(visit_time) = ?`, yesterday).Scan(&yesterdayPV)
	var yesterdayUV int
	models.DB.QueryRow(`SELECT COUNT(DISTINCT ip_address) FROM visitor_logs WHERE DATE(visit_time) = ?`, yesterday).Scan(&yesterdayUV)

	// Last 7 days total
	var last7PV int
	models.DB.QueryRow(`SELECT COALESCE(SUM(page_view_count), 0) FROM visitor_logs WHERE DATE(visit_time) >= ?`, last7Days).Scan(&last7PV)
	var last7UV int
	models.DB.QueryRow(`SELECT COUNT(DISTINCT ip_address) FROM visitor_logs WHERE DATE(visit_time) >= ?`, last7Days).Scan(&last7UV)

	// Last 30 days total
	var last30PV int
	models.DB.QueryRow(`SELECT COALESCE(SUM(page_view_count), 0) FROM visitor_logs WHERE DATE(visit_time) >= ?`, last30Days).Scan(&last30PV)
	var last30UV int
	models.DB.QueryRow(`SELECT COUNT(DISTINCT ip_address) FROM visitor_logs WHERE DATE(visit_time) >= ?`, last30Days).Scan(&last30UV)

	// Real-time online
	var realtimeOnline int
	fiveMinutesAgo := time.Now().Add(-5 * time.Minute).Format("2006-01-02 15:04:05")
	models.DB.QueryRow(`
		SELECT COUNT(DISTINCT visitor_id) FROM visitor_logs 
		WHERE last_visit_time >= ?`, fiveMinutesAgo).Scan(&realtimeOnline)

	// Device distribution
	deviceStats := []map[string]interface{}{}
	deviceRows, err := models.DB.Query(`
		SELECT COALESCE(device_type, 'Unknown') as device, 
		       SUM(page_view_count) as count 
		FROM visitor_logs 
		WHERE DATE(visit_time) = ? 
		GROUP BY device_type 
		ORDER BY count DESC`, today)
	if err == nil && deviceRows != nil {
		defer deviceRows.Close()
		for deviceRows.Next() {
			var device string
			var count int
			deviceRows.Scan(&device, &count)
			deviceStats = append(deviceStats, map[string]interface{}{
				"device": device,
				"count":  count,
			})
		}
	}

	// Browser distribution
	browserStats := []map[string]interface{}{}
	browserRows, err := models.DB.Query(`
		SELECT COALESCE(browser, 'Unknown') as browser, 
		       SUM(page_view_count) as count 
		FROM visitor_logs 
		WHERE DATE(visit_time) = ? 
		GROUP BY browser 
		ORDER BY count DESC 
		LIMIT 10`, today)
	if err == nil && browserRows != nil {
		defer browserRows.Close()
		for browserRows.Next() {
			var browser string
			var count int
			browserRows.Scan(&browser, &count)
			browserStats = append(browserStats, map[string]interface{}{
				"browser": browser,
				"count":   count,
			})
		}
	}

	// Top pages
	topPages := []map[string]interface{}{}
	pageRows, err := models.DB.Query(`
		SELECT page_path, 
		       SUM(page_view_count) as pv, 
		       COUNT(DISTINCT ip_address) as uv 
		FROM visitor_logs 
		WHERE DATE(visit_time) = ? 
		GROUP BY page_path 
		ORDER BY pv DESC 
		LIMIT 10`, today)
	if err == nil && pageRows != nil {
		defer pageRows.Close()
		for pageRows.Next() {
			var path string
			var pv, uv int
			pageRows.Scan(&path, &pv, &uv)
			topPages = append(topPages, map[string]interface{}{
				"page": path,
				"pv":   pv,
				"uv":   uv,
			})
		}
	}

	// Hourly distribution - UV is unique IPs per hour
	hourlyStats := []map[string]interface{}{}
	hourlyRows, err := models.DB.Query(`
		SELECT HOUR(visit_time) as hour, 
		       COUNT(*) as pv,
		       COUNT(DISTINCT ip_address) as uv
		FROM visitor_logs 
		WHERE DATE(visit_time) = ? 
		GROUP BY HOUR(visit_time)
		ORDER BY hour`, today)
	if err == nil && hourlyRows != nil {
		defer hourlyRows.Close()
		for hourlyRows.Next() {
			var hour int
			var pv, uv int
			hourlyRows.Scan(&hour, &pv, &uv)
			hourlyStats = append(hourlyStats, map[string]interface{}{
				"hour": fmt.Sprintf("%02d", hour),
				"pv":   pv,
				"uv":   uv,
			})
		}
	}

	// Country distribution - ensure we get data even if country_name is NULL
	countryStats := []map[string]interface{}{}
	countryRows, err := models.DB.Query(`
		SELECT COALESCE(NULLIF(country_name, ''), 'Unknown') as country, 
		       COUNT(DISTINCT ip_address) as uv,
		       SUM(page_view_count) as pv
		FROM visitor_logs 
		WHERE DATE(visit_time) = ? 
		GROUP BY COALESCE(NULLIF(country_name, ''), 'Unknown')
		ORDER BY uv DESC 
		LIMIT 10`, today)
	if err == nil && countryRows != nil {
		defer countryRows.Close()
		for countryRows.Next() {
			var country string
			var uv, pv int
			countryRows.Scan(&country, &uv, &pv)
			countryStats = append(countryStats, map[string]interface{}{
				"country": country,
				"uv":      uv,
				"pv":      pv,
			})
		}
	}

	// Referrer sources
	referrerStats := []map[string]interface{}{}
	referrerRows, err := models.DB.Query(`
		SELECT CASE 
		         WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
		         WHEN referrer LIKE '%google%' THEN 'Google'
		         WHEN referrer LIKE '%facebook%' THEN 'Facebook'
		         WHEN referrer LIKE '%twitter%' OR referrer LIKE '%x.com%' THEN 'Twitter/X'
		         WHEN referrer LIKE '%bing%' THEN 'Bing'
		         ELSE 'Other'
		       END as source,
		       COUNT(DISTINCT ip_address) as uv,
		       SUM(page_view_count) as pv
		FROM visitor_logs 
		WHERE DATE(visit_time) = ? 
		GROUP BY source 
		ORDER BY uv DESC`, today)
	if err == nil && referrerRows != nil {
		defer referrerRows.Close()
		for referrerRows.Next() {
			var source string
			var uv, pv int
			referrerRows.Scan(&source, &uv, &pv)
			referrerStats = append(referrerStats, map[string]interface{}{
				"source": source,
				"uv":     uv,
				"pv":     pv,
			})
		}
	}

	// 7-day trend data
	trendStats := []map[string]interface{}{}
	trendRows, err := models.DB.Query(`
		SELECT DATE(visit_time) as date,
		       SUM(page_view_count) as pv,
		       COUNT(DISTINCT ip_address) as uv
		FROM visitor_logs 
		WHERE DATE(visit_time) >= ? 
		GROUP BY DATE(visit_time)
		ORDER BY date`, last7Days)
	if err == nil && trendRows != nil {
		defer trendRows.Close()
		for trendRows.Next() {
			var date string
			var pv, uv int
			trendRows.Scan(&date, &pv, &uv)
			trendStats = append(trendStats, map[string]interface{}{
				"date": date,
				"pv":   pv,
				"uv":   uv,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"today": gin.H{
				"pv":           todayPV,
				"uv":           todayUV,
				"new_visitors": todayNew,
			},
			"yesterday": gin.H{
				"pv": yesterdayPV,
				"uv": yesterdayUV,
			},
			"last7days": gin.H{
				"pv": last7PV,
				"uv": last7UV,
			},
			"last30days": gin.H{
				"pv": last30PV,
				"uv": last30UV,
			},
			"realtime_online": realtimeOnline,
			"device_stats":    deviceStats,
			"browser_stats":   browserStats,
			"top_pages":       topPages,
			"hourly_stats":    hourlyStats,
			"country_stats":   countryStats,
			"referrer_stats":  referrerStats,
			"trend_stats":     trendStats,
		},
	})
}

func GetVisitorList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	dateFilter := c.Query("date")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	whereClause := "1=1"
	args := []interface{}{}

	if dateFilter != "" {
		whereClause += " AND DATE(visit_time) = ?"
		args = append(args, dateFilter)
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM visitor_logs WHERE " + whereClause
	models.DB.QueryRow(countQuery, args...).Scan(&total)

	// Get visitors
	query := `
		SELECT id, ip_address, COALESCE(visitor_id, ''), COALESCE(page_path, '/'), 
		       COALESCE(device_type, ''), COALESCE(os, ''), COALESCE(browser, ''),
		       COALESCE(country_name, ''), COALESCE(city, ''), visit_time, 
		       COALESCE(duration, 0), page_view_count
		FROM visitor_logs 
		WHERE ` + whereClause + `
		ORDER BY visit_time DESC 
		LIMIT ? OFFSET ?`

	args = append(args, pageSize, offset)
	rows, err := models.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	visitors := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var ip, visitorId, path, device, os, browser, country, city string
		var visitTime time.Time
		var duration, pvCount int

		rows.Scan(&id, &ip, &visitorId, &path, &device, &os, &browser, &country, &city, &visitTime, &duration, &pvCount)

		visitors = append(visitors, map[string]interface{}{
			"id":              id,
			"ip":              ip,
			"visitor_id":      visitorId,
			"page":            path,
			"device":          device,
			"os":              os,
			"browser":         browser,
			"country":         country,
			"city":            city,
			"visit_time":      visitTime,
			"duration":        duration,
			"page_view_count": pvCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"visitors": visitors,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func GetVisitorTrend(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	if days < 1 || days > 90 {
		days = 7
	}

	startDate := time.Now().AddDate(0, 0, -days).Format("2006-01-02")

	rows, err := models.DB.Query(`
		SELECT stats_date, page_views, unique_visitors, unique_ips 
		FROM daily_stats 
		WHERE stats_date >= ? 
		ORDER BY stats_date`, startDate)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	trends := []map[string]interface{}{}
	for rows.Next() {
		var date string
		var pv, uv, ips int
		rows.Scan(&date, &pv, &uv, &ips)
		trends = append(trends, map[string]interface{}{
			"date": date,
			"pv":   pv,
			"uv":   uv,
			"ips":  ips,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    trends,
	})
}
