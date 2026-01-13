package handlers

import (
	"admin-go/models"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetSitemap generates sitemap.xml with all public pages
func GetSitemap(c *gin.Context) {
	baseURL := "http://localhost:3000" // Can be configured

	var urls []string

	// Add homepage
	urls = append(urls, fmt.Sprintf(`<url><loc>%s/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`, baseURL))

	// Get all categories with articles
	categoryRows, err := models.DB.Query(`
		SELECT DISTINCT c.slug 
		FROM categories c 
		INNER JOIN articles a ON a.category_id = c.id 
		WHERE a.is_published = 1
	`)
	if err == nil {
		defer categoryRows.Close()
		for categoryRows.Next() {
			var slug string
			if categoryRows.Scan(&slug) == nil {
				urls = append(urls, fmt.Sprintf(`<url><loc>%s/%s</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`, baseURL, slug))
			}
		}
	}

	// Get all published articles
	articleRows, err := models.DB.Query(`
		SELECT slug, updated_at FROM articles WHERE is_published = 1 ORDER BY created_at DESC
	`)
	if err == nil {
		defer articleRows.Close()
		for articleRows.Next() {
			var slug string
			var updatedAt time.Time
			if articleRows.Scan(&slug, &updatedAt) == nil {
				lastmod := updatedAt.Format("2006-01-02")
				urls = append(urls, fmt.Sprintf(`<url><loc>%s/article/%s</loc><lastmod>%s</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`, baseURL, slug, lastmod))
			}
		}
	}

	// Build sitemap XML
	sitemap := `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`

	for _, url := range urls {
		sitemap += "\n  " + url
	}

	sitemap += "\n</urlset>"

	c.Header("Content-Type", "application/xml")
	c.String(http.StatusOK, sitemap)
}
