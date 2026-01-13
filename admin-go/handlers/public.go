package handlers

import (
	"admin-go/models"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GetPublicCategories returns categories with article counts (only those with articles)
func GetPublicCategories(c *gin.Context) {
	if models.DB == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": []map[string]interface{}{}})
		return
	}

	rows, err := models.DB.Query(`
		SELECT c.id, c.name, c.slug, COUNT(a.id) as article_count
		FROM categories c
		LEFT JOIN articles a ON a.category_id = c.id AND a.is_published = 1
		WHERE c.is_enabled = 1
		GROUP BY c.id
		HAVING article_count > 0
		ORDER BY c.sort_order, c.name`)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	categories := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var name, slug string
		var articleCount int
		rows.Scan(&id, &name, &slug, &articleCount)
		categories = append(categories, map[string]interface{}{
			"id":            id,
			"name":          name,
			"slug":          slug,
			"article_count": articleCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": categories})
}

// GetPublicArticles returns published articles with pagination
func GetPublicArticles(c *gin.Context) {
	if models.DB == nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   true,
			"data":      []map[string]interface{}{},
			"total":     0,
			"page":      1,
			"page_size": 10,
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	categorySlug := c.Query("category")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	whereClause := "a.is_published = 1"
	args := []interface{}{}

	if categorySlug != "" {
		whereClause += " AND c.slug = ?"
		args = append(args, categorySlug)
	}

	// Get total count
	var total int
	countQuery := `SELECT COUNT(*) FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE ` + whereClause
	models.DB.QueryRow(countQuery, args...).Scan(&total)

	// Get articles
	query := `
		SELECT a.id, a.title, a.slug, a.summary, a.cover_image, 
		       COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       a.view_count, a.created_at
		FROM articles a
		LEFT JOIN categories c ON a.category_id = c.id
		WHERE ` + whereClause + `
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?`

	args = append(args, pageSize, offset)
	rows, err := models.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	articles := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var title, slug, summary, coverImage, categoryName, categorySlug string
		var viewCount int
		var createdAt time.Time

		rows.Scan(&id, &title, &slug, &summary, &coverImage, &categoryName, &categorySlug, &viewCount, &createdAt)

		articles = append(articles, map[string]interface{}{
			"id":            id,
			"title":         title,
			"slug":          slug,
			"summary":       summary,
			"cover_image":   coverImage,
			"category_name": categoryName,
			"category_slug": categorySlug,
			"view_count":    viewCount,
			"created_at":    createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      articles,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetPublicArticleBySlug returns a single article by slug with related articles
func GetPublicArticleBySlug(c *gin.Context) {
	if models.DB == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Article not found"})
		return
	}

	slug := c.Param("slug")

	var id int64
	var title, articleSlug, content, summary, coverImage string
	var categoryId *int64
	var categoryName, categorySlug string
	var viewCount int
	var createdAt, updatedAt time.Time

	err := models.DB.QueryRow(`
		SELECT a.id, a.title, a.slug, a.content, a.summary, a.cover_image,
		       a.category_id, COALESCE(c.name, '') as category_name, COALESCE(c.slug, '') as category_slug,
		       a.view_count, a.created_at, a.updated_at
		FROM articles a
		LEFT JOIN categories c ON a.category_id = c.id
		WHERE a.slug = ? AND a.is_published = 1`, slug).
		Scan(&id, &title, &articleSlug, &content, &summary, &coverImage,
			&categoryId, &categoryName, &categorySlug, &viewCount, &createdAt, &updatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Article not found"})
		return
	}

	// Increment view count
	models.DB.Exec("UPDATE articles SET view_count = view_count + 1 WHERE id = ?", id)

	// Get related articles (same category, exclude current)
	related := []map[string]interface{}{}
	if categoryId != nil {
		relatedRows, _ := models.DB.Query(`
			SELECT id, title, slug, summary, cover_image, created_at
			FROM articles 
			WHERE category_id = ? AND id != ? AND is_published = 1
			ORDER BY created_at DESC
			LIMIT 4`, *categoryId, id)
		defer relatedRows.Close()

		for relatedRows.Next() {
			var rId int64
			var rTitle, rSlug, rSummary, rCover string
			var rCreatedAt time.Time
			relatedRows.Scan(&rId, &rTitle, &rSlug, &rSummary, &rCover, &rCreatedAt)
			related = append(related, map[string]interface{}{
				"id":          rId,
				"title":       rTitle,
				"slug":        rSlug,
				"summary":     rSummary,
				"cover_image": rCover,
				"created_at":  rCreatedAt,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": map[string]interface{}{
			"id":            id,
			"title":         title,
			"slug":          articleSlug,
			"content":       content,
			"summary":       summary,
			"cover_image":   coverImage,
			"category_name": categoryName,
			"category_slug": categorySlug,
			"view_count":    viewCount + 1,
			"created_at":    createdAt,
			"updated_at":    updatedAt,
			"related":       related,
		},
	})
}
