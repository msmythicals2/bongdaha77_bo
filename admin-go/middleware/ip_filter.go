package middleware

import (
	"admin-go/models"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// IPFilterMiddleware checks if the client IP is allowed to access admin functions
func IPFilterMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := getClientIP(c)

		// Check if IP is blacklisted
		if isBlacklisted(clientIP) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Access denied: Your IP address is blacklisted",
			})
			c.Abort()
			return
		}

		// Check if whitelist exists and if IP is whitelisted
		if hasWhitelist() && !isWhitelisted(clientIP) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "Access denied: Your IP address is not whitelisted",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// getClientIP extracts the real client IP from various headers
func getClientIP(c *gin.Context) string {
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

// isBlacklisted checks if an IP is in the blacklist and not expired
func isBlacklisted(ip string) bool {
	var count int
	now := time.Now()

	// Check if IP is blacklisted and not expired
	err := models.DB.QueryRow(`
		SELECT COUNT(*) FROM ip_blacklist 
		WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > ?)
	`, ip, now).Scan(&count)

	if err != nil {
		return false
	}

	return count > 0
}

// hasWhitelist checks if there are any entries in the whitelist
func hasWhitelist() bool {
	var count int
	err := models.DB.QueryRow("SELECT COUNT(*) FROM ip_whitelist").Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

// isWhitelisted checks if an IP is in the whitelist
func isWhitelisted(ip string) bool {
	var count int
	err := models.DB.QueryRow("SELECT COUNT(*) FROM ip_whitelist WHERE ip_address = ?", ip).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}
