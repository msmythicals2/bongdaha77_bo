package main

import (
	"admin-go/config"
	"admin-go/handlers"
	"admin-go/middleware"
	"admin-go/models"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load config first
	config.Load()

	// Initialize database
	models.InitDB()

	// Create Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		rawAllowedOrigins := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
		allowedOrigins := []string{}
		if rawAllowedOrigins != "" {
			for _, s := range strings.Split(rawAllowedOrigins, ",") {
				v := strings.TrimSpace(s)
				if v != "" {
					allowedOrigins = append(allowedOrigins, v)
				}
			}
		}

		if origin == "" {
			c.Header("Access-Control-Allow-Origin", "*")
		} else {
			if len(allowedOrigins) == 0 {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
			} else {
				isAllowed := false
				for _, allowed := range allowedOrigins {
					if origin == allowed {
						isAllowed = true
						break
					}
				}
				if isAllowed {
					c.Header("Access-Control-Allow-Origin", origin)
					c.Header("Access-Control-Allow-Credentials", "true")
				}
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
		c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Type")
		c.Header("Access-Control-Max-Age", "86400") // 24 hours

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Serve uploaded files
	r.Static("/uploads", "./uploads")

	// Admin routes with IP filtering
	adminRoutes := r.Group("/api")
	adminRoutes.Use(middleware.IPFilterMiddleware()) // Apply IP filter to all admin routes
	{
		// Login (also protected by IP filter)
		adminRoutes.POST("/login", handlers.Login)
	}

	// Protected routes (require both IP filter and authentication)
	api := r.Group("/api")
	api.Use(middleware.IPFilterMiddleware()) // IP filter
	api.Use(middleware.AuthMiddleware())     // Authentication
	{
		// Dashboard
		api.GET("/dashboard", handlers.GetDashboard)

		// Visitor Statistics
		api.GET("/visitors/stats", handlers.GetVisitorStats)
		api.GET("/visitors/list", handlers.GetVisitorList)
		api.GET("/visitors/trend", handlers.GetVisitorTrend)

		// Article Management
		api.GET("/articles", handlers.GetArticles)
		api.GET("/articles/:id", handlers.GetArticle)
		api.POST("/articles", handlers.CreateArticle)
		api.PUT("/articles/:id", handlers.UpdateArticle)
		api.DELETE("/articles/:id", handlers.DeleteArticle)
		api.POST("/articles/batch-delete", handlers.BatchDeleteArticles)
		api.POST("/articles/batch-status", handlers.BatchUpdateArticleStatus)
		api.POST("/articles/import", handlers.ImportArticles)
		api.GET("/articles/export-template", handlers.ExportArticleTemplate)

		// Category Management
		api.GET("/categories", handlers.GetCategories)
		api.POST("/categories", handlers.CreateCategory)
		api.PUT("/categories/:id", handlers.UpdateCategory)
		api.DELETE("/categories/:id", handlers.DeleteCategory)

		// System Management - Blacklist/Whitelist
		api.GET("/blacklist", handlers.GetBlacklist)
		api.POST("/blacklist", handlers.AddToBlacklist)
		api.DELETE("/blacklist/:id", handlers.RemoveFromBlacklist)

		api.GET("/whitelist", handlers.GetWhitelist)
		api.POST("/whitelist", handlers.AddToWhitelist)
		api.DELETE("/whitelist/:id", handlers.RemoveFromWhitelist)

		// Change Password
		api.POST("/change-password", handlers.ChangePassword)

		// Image Management
		api.GET("/images/stats", handlers.GetImageStats)
		api.GET("/images/list", handlers.GetImageList)
		api.POST("/images/upload", handlers.UploadImage)
		api.POST("/images/upload-article", handlers.UploadArticleImage)
		api.POST("/images/mark-used/:id", handlers.MarkImageUsed)
		api.POST("/images/mark-unused/:id", handlers.MarkImageUnused)
		api.DELETE("/images/:id", handlers.DeleteImage)

		// System Management
		api.GET("/system/info", handlers.GetSystemInfo)
		api.GET("/system/client-ip", handlers.GetClientIP)
		api.POST("/system/clear-visitors", handlers.ClearAllVisitors)
		api.POST("/system/clear-stats", handlers.ClearDailyStats)
	}

	// Public routes (not protected by IP filter)
	r.POST("/api/track", handlers.Track)
	r.GET("/api/track/online", handlers.GetOnlineCount)
	r.GET("/api/public/categories", handlers.GetPublicCategories)
	r.GET("/api/public/articles", handlers.GetPublicArticles)
	r.GET("/api/public/article/:slug", handlers.GetPublicArticleBySlug)
	r.GET("/sitemap.xml", handlers.GetSitemap)

	port := config.GetPort()
	log.Printf("Admin API Server running on port %s", port)
	r.Run(":" + port)
}
