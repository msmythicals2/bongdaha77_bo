package handlers

import (
	"admin-go/models"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type BlacklistRequest struct {
	IpAddress string `json:"ip_address" binding:"required"`
	Reason    string `json:"reason"`
	ExpiresAt string `json:"expires_at"`
}

type WhitelistRequest struct {
	IpAddress   string `json:"ip_address" binding:"required"`
	Description string `json:"description"`
}

func GetBlacklist(c *gin.Context) {
	rows, err := models.DB.Query(`
		SELECT id, ip_address, COALESCE(reason, ''), created_at, expires_at
		FROM ip_blacklist
		ORDER BY created_at DESC`)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	list := []models.IpBlacklist{}
	for rows.Next() {
		var item models.IpBlacklist
		rows.Scan(&item.ID, &item.IpAddress, &item.Reason, &item.CreatedAt, &item.ExpiresAt)
		list = append(list, item)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func AddToBlacklist(c *gin.Context) {
	var req BlacklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != "" {
		t, err := time.Parse("2006-01-02 15:04:05", req.ExpiresAt)
		if err == nil {
			expiresAt = &t
		}
	}

	result, err := models.DB.Exec(`
		INSERT INTO ip_blacklist (ip_address, reason, created_at, expires_at)
		VALUES (?, ?, ?, ?)`,
		req.IpAddress, req.Reason, time.Now(), expiresAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to blacklist"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "message": "Added to blacklist"})
}

func RemoveFromBlacklist(c *gin.Context) {
	id := c.Param("id")

	_, err := models.DB.Exec("DELETE FROM ip_blacklist WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from blacklist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Removed from blacklist"})
}

func GetWhitelist(c *gin.Context) {
	rows, err := models.DB.Query(`
		SELECT id, ip_address, COALESCE(description, ''), created_at
		FROM ip_whitelist
		ORDER BY created_at DESC`)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	list := []models.IpWhitelist{}
	for rows.Next() {
		var item models.IpWhitelist
		rows.Scan(&item.ID, &item.IpAddress, &item.Description, &item.CreatedAt)
		list = append(list, item)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": list})
}

func AddToWhitelist(c *gin.Context) {
	var req WhitelistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	result, err := models.DB.Exec(`
		INSERT INTO ip_whitelist (ip_address, description, created_at)
		VALUES (?, ?, ?)`,
		req.IpAddress, req.Description, time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add to whitelist"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "message": "Added to whitelist"})
}

func RemoveFromWhitelist(c *gin.Context) {
	id := c.Param("id")

	_, err := models.DB.Exec("DELETE FROM ip_whitelist WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from whitelist"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Removed from whitelist"})
}

// GetSystemInfo returns system statistics
func GetSystemInfo(c *gin.Context) {
	var totalVisitors, totalArticles, totalImages int

	models.DB.QueryRow("SELECT COUNT(*) FROM visitor_logs").Scan(&totalVisitors)
	models.DB.QueryRow("SELECT COUNT(*) FROM articles").Scan(&totalArticles)
	models.DB.QueryRow("SELECT COUNT(*) FROM uploaded_images").Scan(&totalImages)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total_visitors": totalVisitors,
			"total_articles": totalArticles,
			"total_images":   totalImages,
			"db_size":        "-",
		},
	})
}

// ClearAllVisitors deletes all visitor logs and daily stats
func ClearAllVisitors(c *gin.Context) {
	// Delete all visitor logs
	_, err := models.DB.Exec("DELETE FROM visitor_logs")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to clear visitor logs"})
		return
	}

	// Delete all daily stats
	_, err = models.DB.Exec("DELETE FROM daily_stats")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to clear daily stats"})
		return
	}

	// Delete realtime stats
	_, err = models.DB.Exec("DELETE FROM realtime_stats")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to clear realtime stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "All visitor records cleared"})
}

// ClearDailyStats deletes only daily statistics
func ClearDailyStats(c *gin.Context) {
	_, err := models.DB.Exec("DELETE FROM daily_stats")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to clear daily stats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Daily statistics cleared"})
}

// GetClientIP returns the current client's IP address
func GetClientIP(c *gin.Context) {
	clientIP := getClientIPAddress(c)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"client_ip": clientIP,
	})
}

// getClientIPAddress extracts the real client IP from various headers
func getClientIPAddress(c *gin.Context) string {
	// Check X-Forwarded-For header (most common for proxies)
	xForwardedFor := c.GetHeader("X-Forwarded-For")
	if xForwardedFor != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(xForwardedFor, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header (used by nginx)
	xRealIP := c.GetHeader("X-Real-IP")
	if xRealIP != "" {
		return xRealIP
	}

	// Check CF-Connecting-IP header (Cloudflare)
	cfConnectingIP := c.GetHeader("CF-Connecting-IP")
	if cfConnectingIP != "" {
		return cfConnectingIP
	}

	// Fallback to RemoteAddr
	ip, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return ip
}
