package handlers

import (
	"admin-go/models"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type CategoryRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	SortOrder   int    `json:"sort_order"`
	IsEnabled   bool   `json:"is_enabled"`
}

func GetCategories(c *gin.Context) {
	rows, err := models.DB.Query(`
		SELECT c.id, c.name, c.slug, COALESCE(c.description, ''), c.sort_order, 
		       c.is_enabled, c.created_at,
		       (SELECT COUNT(*) FROM articles WHERE category_id = c.id) as article_count
		FROM categories c
		ORDER BY c.sort_order, c.name`)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	categories := []models.Category{}
	for rows.Next() {
		var cat models.Category
		rows.Scan(&cat.ID, &cat.Name, &cat.Slug, &cat.Description, &cat.SortOrder,
			&cat.IsEnabled, &cat.CreatedAt, &cat.ArticleCount)
		categories = append(categories, cat)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": categories})
}

func CreateCategory(c *gin.Context) {
	var req CategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	slug := generateCategorySlug(req.Name)

	result, err := models.DB.Exec(`
		INSERT INTO categories (name, slug, description, sort_order, is_enabled, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		req.Name, slug, req.Description, req.SortOrder, req.IsEnabled, time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "message": "Category created successfully"})
}

func UpdateCategory(c *gin.Context) {
	id := c.Param("id")

	var req CategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := models.DB.Exec(`
		UPDATE categories 
		SET name = ?, description = ?, sort_order = ?, is_enabled = ?
		WHERE id = ?`,
		req.Name, req.Description, req.SortOrder, req.IsEnabled, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Category updated successfully"})
}

func DeleteCategory(c *gin.Context) {
	id := c.Param("id")

	// Check if category has articles
	var count int
	models.DB.QueryRow("SELECT COUNT(*) FROM articles WHERE category_id = ?", id).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete category with articles"})
		return
	}

	_, err := models.DB.Exec("DELETE FROM categories WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Category deleted successfully"})
}

func generateCategorySlug(name string) string {
	slug := strings.ToLower(name)
	reg := regexp.MustCompile("[^a-z0-9]+")
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return slug
}
