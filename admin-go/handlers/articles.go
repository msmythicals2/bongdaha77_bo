package handlers

import (
	"admin-go/models"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

type ArticleRequest struct {
	Title         string `json:"title" binding:"required"`
	Slug          string `json:"slug" binding:"required"`
	Content       string `json:"content"`
	ContentJson   string `json:"content_json"`
	Summary       string `json:"summary"`
	CoverImage    string `json:"cover_image"`
	CategoryId    *int64 `json:"category_id"`
	IsPublished   bool   `json:"is_published"`
	IsRecommended bool   `json:"is_recommended"`
}

// ImportArticleItem supports both old format (ContentHtml, CoverImageUrl) and new format
type ImportArticleItem struct {
	Title         string `json:"title"`
	Slug          string `json:"slug"`
	Content       string `json:"content"`
	ContentHtml   string `json:"contentHtml"` // Old format from C# project
	ContentJson   string `json:"content_json"`
	Summary       string `json:"summary"`
	CoverImage    string `json:"cover_image"`
	CoverImageUrl string `json:"coverImageUrl"` // Old format from C# project
	CategoryId    *int64 `json:"category_id"`
	IsPublished   bool   `json:"isPublished"`
	IsRecommended bool   `json:"isRecommended"`
}

func GetArticles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	categoryId := c.Query("category_id")
	status := c.Query("status")
	keyword := c.Query("keyword")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	whereClause := "1=1"
	args := []interface{}{}

	if categoryId != "" {
		whereClause += " AND a.category_id = ?"
		args = append(args, categoryId)
	}

	if status == "published" {
		whereClause += " AND a.is_published = 1"
	} else if status == "draft" {
		whereClause += " AND a.is_published = 0"
	}

	if keyword != "" {
		whereClause += " AND (a.title LIKE ? OR a.summary LIKE ?)"
		args = append(args, "%"+keyword+"%", "%"+keyword+"%")
	}

	// Get total count
	var total int
	countQuery := "SELECT COUNT(*) FROM articles a WHERE " + whereClause
	models.DB.QueryRow(countQuery, args...).Scan(&total)

	// Get articles
	query := `
		SELECT a.id, a.title, a.slug, COALESCE(a.summary, ''), COALESCE(a.cover_image, ''),
		       a.category_id, COALESCE(c.name, ''), a.is_published, a.is_recommended, 
		       a.view_count, a.created_at, a.updated_at
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

	articles := []models.Article{}
	for rows.Next() {
		var a models.Article
		var categoryId *int64
		rows.Scan(&a.ID, &a.Title, &a.Slug, &a.Summary, &a.CoverImage,
			&categoryId, &a.CategoryName, &a.IsPublished, &a.IsRecommended,
			&a.ViewCount, &a.CreatedAt, &a.UpdatedAt)
		a.CategoryId = categoryId
		articles = append(articles, a)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"articles": articles,
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		},
	})
}

func GetArticle(c *gin.Context) {
	id := c.Param("id")

	var a models.Article
	var categoryId *int64
	err := models.DB.QueryRow(`
		SELECT a.id, a.title, COALESCE(a.slug, ''), COALESCE(a.content, ''), COALESCE(a.content_json, ''), 
		       COALESCE(a.summary, ''), COALESCE(a.cover_image, ''), a.category_id, COALESCE(c.name, ''), 
		       a.is_published, a.is_recommended, a.view_count, a.created_at, a.updated_at
		FROM articles a
		LEFT JOIN categories c ON a.category_id = c.id
		WHERE a.id = ?`, id).
		Scan(&a.ID, &a.Title, &a.Slug, &a.Content, &a.ContentJson, &a.Summary, &a.CoverImage,
			&categoryId, &a.CategoryName, &a.IsPublished, &a.IsRecommended,
			&a.ViewCount, &a.CreatedAt, &a.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	a.CategoryId = categoryId
	c.JSON(http.StatusOK, gin.H{"success": true, "data": a})
}

func CreateArticle(c *gin.Context) {
	var req ArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: title and slug are required"})
		return
	}

	// Validate slug format
	slugRegex := regexp.MustCompile(`^[a-z0-9-]+$`)
	if !slugRegex.MatchString(req.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug can only contain lowercase letters, numbers, and hyphens"})
		return
	}

	// Check if slug already exists
	var existingId int64
	err := models.DB.QueryRow("SELECT id FROM articles WHERE slug = ?", req.Slug).Scan(&existingId)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug already exists"})
		return
	}

	result, err := models.DB.Exec(`
		INSERT INTO articles (title, slug, content, content_json, summary, cover_image, category_id, 
		                      is_published, is_recommended, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		req.Title, req.Slug, req.Content, req.ContentJson, req.Summary, req.CoverImage, req.CategoryId,
		req.IsPublished, req.IsRecommended, time.Now(), time.Now())

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create article"})
		return
	}

	id, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "message": "Article created successfully"})
}

func UpdateArticle(c *gin.Context) {
	id := c.Param("id")

	var req ArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: title and slug are required"})
		return
	}

	// Validate slug format
	slugRegex := regexp.MustCompile(`^[a-z0-9-]+$`)
	if !slugRegex.MatchString(req.Slug) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug can only contain lowercase letters, numbers, and hyphens"})
		return
	}

	// Check if slug already exists for another article
	var existingId int64
	err := models.DB.QueryRow("SELECT id FROM articles WHERE slug = ? AND id != ?", req.Slug, id).Scan(&existingId)
	if err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug already exists"})
		return
	}

	// First, check if the article exists and get current data
	var currentSlug string
	err = models.DB.QueryRow("SELECT COALESCE(slug, '') FROM articles WHERE id = ?", id).Scan(&currentSlug)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	// Update the article
	_, err = models.DB.Exec(`
		UPDATE articles 
		SET title = ?, slug = ?, content = ?, content_json = ?, summary = ?, cover_image = ?, category_id = ?,
		    is_published = ?, is_recommended = ?, updated_at = ?
		WHERE id = ?`,
		req.Title, req.Slug, req.Content, req.ContentJson, req.Summary, req.CoverImage, req.CategoryId,
		req.IsPublished, req.IsRecommended, time.Now(), id)

	if err != nil {
		// Log the actual error for debugging
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update article", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Article updated successfully"})
}

func DeleteArticle(c *gin.Context) {
	id := c.Param("id")

	_, err := models.DB.Exec("DELETE FROM articles WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete article"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Article deleted successfully"})
}

func BatchDeleteArticles(c *gin.Context) {
	var req struct {
		IDs []int64 `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No articles selected"})
		return
	}

	placeholders := strings.Repeat("?,", len(req.IDs))
	placeholders = placeholders[:len(placeholders)-1]

	args := make([]interface{}, len(req.IDs))
	for i, id := range req.IDs {
		args[i] = id
	}

	_, err := models.DB.Exec("DELETE FROM articles WHERE id IN ("+placeholders+")", args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete articles"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Articles deleted successfully"})
}

func BatchUpdateArticleStatus(c *gin.Context) {
	var req struct {
		IDs         []int64 `json:"ids" binding:"required"`
		IsPublished bool    `json:"is_published"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No articles selected"})
		return
	}

	placeholders := strings.Repeat("?,", len(req.IDs))
	placeholders = placeholders[:len(placeholders)-1]

	args := []interface{}{req.IsPublished}
	for _, id := range req.IDs {
		args = append(args, id)
	}

	_, err := models.DB.Exec("UPDATE articles SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ("+placeholders+")", args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update articles"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Articles updated successfully"})
}

func ImportArticles(c *gin.Context) {
	// Handle file upload
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Check file extension
	fileName := strings.ToLower(file.Filename)
	isExcel := strings.HasSuffix(fileName, ".xlsx") || strings.HasSuffix(fileName, ".xls")

	// Open the uploaded file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to open uploaded file"})
		return
	}
	defer src.Close()

	var articles []ImportArticleItem

	if isExcel {
		// Parse Excel file
		f, err := excelize.OpenReader(src)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse Excel file: " + err.Error()})
			return
		}
		defer f.Close()

		// Get the first sheet
		sheets := f.GetSheetList()
		if len(sheets) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Excel file has no sheets"})
			return
		}

		rows, err := f.GetRows(sheets[0])
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read Excel rows: " + err.Error()})
			return
		}

		// Debug: log row count
		if len(rows) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Excel file is empty"})
			return
		}

		if len(rows) < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Excel file must have at least a header row"})
			return
		}

		// Parse header row to find column indices
		header := rows[0]
		colMap := make(map[string]int)
		for i, col := range header {
			// Normalize column names: lowercase and remove spaces
			normalized := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(col), " ", ""))
			colMap[normalized] = i
		}

		// Parse data rows (start from row 1, skip header)
		hasData := false
		for i := 1; i < len(rows); i++ {
			row := rows[i]

			// Skip completely empty rows
			isEmpty := true
			for _, cell := range row {
				if strings.TrimSpace(cell) != "" {
					isEmpty = false
					break
				}
			}
			if isEmpty {
				continue
			}

			item := ImportArticleItem{}

			// Helper function to get cell value
			getCell := func(colNames ...string) string {
				for _, colName := range colNames {
					if idx, ok := colMap[colName]; ok && idx < len(row) {
						return strings.TrimSpace(row[idx])
					}
				}
				return ""
			}

			item.Title = getCell("title")
			item.Slug = getCell("slug")
			item.Content = getCell("content")
			item.ContentHtml = getCell("contenthtml")
			item.Summary = getCell("summary")
			item.CoverImage = getCell("coverimage", "coverimageurl", "cover_image", "coverimageurl")
			item.CoverImageUrl = getCell("coverimageurl", "coverimage", "cover_image", "coverimageurl")

			// Parse category - support both category name and category_id
			categoryStr := getCell("category", "category_id", "categoryid")
			if categoryStr != "" {
				// Try to parse as number first
				if catId, err := strconv.ParseInt(categoryStr, 10, 64); err == nil {
					item.CategoryId = &catId
				} else {
					// If not a number, look up category by name
					var catId int64
					err := models.DB.QueryRow("SELECT id FROM categories WHERE name = ?", categoryStr).Scan(&catId)
					if err == nil {
						item.CategoryId = &catId
					}
				}
			}

			// Parse boolean fields
			isPubStr := strings.ToLower(getCell("ispublished", "is_published"))
			item.IsPublished = isPubStr == "true" || isPubStr == "1" || isPubStr == "yes"

			isRecStr := strings.ToLower(getCell("isrecommended", "is_recommended"))
			item.IsRecommended = isRecStr == "true" || isRecStr == "1" || isRecStr == "yes"

			// Skip rows without title and slug
			if item.Title == "" && item.Slug == "" {
				continue
			}

			articles = append(articles, item)
			hasData = true
		}

		// If no valid data rows found
		if !hasData {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "No valid data rows found in Excel file. Please ensure you have at least one row with Title and Slug filled in.",
			})
			return
		}
	} else {
		// Parse JSON file
		content := make([]byte, file.Size)
		_, err = src.Read(content)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read file content"})
			return
		}

		// Try to parse as array first (direct array format)
		if err := json.Unmarshal(content, &articles); err != nil {
			// Try wrapped format {"articles": [...]}
			var req struct {
				Articles []ImportArticleItem `json:"articles"`
			}
			if err := json.Unmarshal(content, &req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON format: " + err.Error()})
				return
			}
			articles = req.Articles
		}
	}

	// Convert ImportArticleItem to ArticleRequest
	var req struct {
		Articles []ArticleRequest
	}
	for _, item := range articles {
		articleReq := ArticleRequest{
			Title:         item.Title,
			Slug:          item.Slug,
			Summary:       item.Summary,
			IsPublished:   item.IsPublished,
			IsRecommended: item.IsRecommended,
		}
		// Handle content field - support both ContentHtml and Content
		if item.ContentHtml != "" {
			articleReq.Content = item.ContentHtml
		} else if item.Content != "" {
			articleReq.Content = item.Content
		}
		// Handle cover image - support both CoverImageUrl and CoverImage
		if item.CoverImageUrl != "" {
			articleReq.CoverImage = item.CoverImageUrl
		} else if item.CoverImage != "" {
			articleReq.CoverImage = item.CoverImage
		}
		if item.ContentJson != "" {
			articleReq.ContentJson = item.ContentJson
		}
		if item.CategoryId != nil {
			articleReq.CategoryId = item.CategoryId
		}
		req.Articles = append(req.Articles, articleReq)
	}

	if len(req.Articles) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No articles to import"})
		return
	}

	imported := 0
	skipped := 0
	errors := []string{}

	for i, article := range req.Articles {
		// Validate required fields
		if article.Title == "" || article.Slug == "" {
			errors = append(errors, "Article "+strconv.Itoa(i+1)+": title and slug are required")
			continue
		}

		// Validate slug format
		slugRegex := regexp.MustCompile(`^[a-z0-9-]+$`)
		if !slugRegex.MatchString(article.Slug) {
			errors = append(errors, "Article "+strconv.Itoa(i+1)+": invalid slug format")
			continue
		}

		// Check if slug already exists
		var existingId int64
		err := models.DB.QueryRow("SELECT id FROM articles WHERE slug = ?", article.Slug).Scan(&existingId)
		if err == nil {
			skipped++
			continue
		}

		// Insert article
		_, err = models.DB.Exec(`
			INSERT INTO articles (title, slug, content, content_json, summary, cover_image, category_id, 
			                      is_published, is_recommended, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			article.Title, article.Slug, article.Content, article.ContentJson, article.Summary,
			article.CoverImage, article.CategoryId, article.IsPublished, article.IsRecommended,
			time.Now(), time.Now())

		if err != nil {
			errors = append(errors, "Article "+strconv.Itoa(i+1)+": "+err.Error())
			continue
		}

		imported++
	}

	response := gin.H{
		"success":  true,
		"imported": imported,
		"skipped":  skipped,
		"total":    len(req.Articles),
	}

	if len(errors) > 0 {
		response["errors"] = errors
	}

	c.JSON(http.StatusOK, response)
}

func ExportArticleTemplate(c *gin.Context) {
	f := excelize.NewFile()
	defer f.Close()

	sheetName := "Articles"
	index, _ := f.NewSheet(sheetName)
	f.SetActiveSheet(index)

	// Set headers
	headers := []string{"Title", "Slug", "Summary", "Content", "Cover Image URL", "Category", "Is Published", "Is Recommended"}
	for i, header := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, header)
	}

	// Add example row
	exampleData := []interface{}{
		"Example Article Title",
		"example-article-slug",
		"This is a brief summary of the article",
		"<p>Article content in HTML format. You can use HTML tags like <strong>bold</strong>, <em>italic</em>, etc.</p>",
		"/uploads/images/2026-01/example.png",
		"News",
		"TRUE",
		"FALSE",
	}
	for i, data := range exampleData {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheetName, cell, data)
	}

	// Get all categories for the comment
	rows, err := models.DB.Query("SELECT name FROM categories WHERE is_enabled = 1 ORDER BY sort_order, name")
	categoryList := "Available categories:\n"
	if err == nil {
		defer rows.Close()
		var categories []string
		for rows.Next() {
			var name string
			rows.Scan(&name)
			categories = append(categories, name)
		}
		if len(categories) > 0 {
			categoryList += strings.Join(categories, "\n")
		} else {
			categoryList += "No categories available. Please create categories first."
		}
	} else {
		categoryList += "Error loading categories"
	}

	// Add detailed comments to each column
	comments := map[string]string{
		"A1": "Title (Required)\nThe article title. Must not be empty.",
		"B1": "Slug (Required)\nURL-friendly identifier (e.g., 'my-article-title')\nMust contain only lowercase letters, numbers, and hyphens.\nMust be unique.",
		"C1": "Summary (Optional)\nA brief description of the article.\nDisplayed in article lists and search results.",
		"D1": "Content (Optional)\nThe main article content.\nSupports HTML tags like <p>, <strong>, <em>, <a>, <img>, etc.\nYou can paste HTML content directly.",
		"E1": "Cover Image URL (Optional)\nPath to the cover image (e.g., '/uploads/images/2026-01/image.png')\nYou can upload images first in the Image Management section.",
		"F1": categoryList,
		"G1": "Is Published (Optional)\nSet to TRUE or 1 to publish the article immediately.\nSet to FALSE or 0 to save as draft.\nDefault: FALSE",
		"H1": "Is Recommended (Optional)\nSet to TRUE or 1 to mark as recommended/featured.\nSet to FALSE or 0 for normal articles.\nDefault: FALSE",
	}

	for cell, text := range comments {
		f.AddComment(sheetName, excelize.Comment{
			Cell:   cell,
			Author: "System",
			Paragraph: []excelize.RichTextRun{
				{Text: text},
			},
		})
	}

	// Style the header row
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 11, Color: "#FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "left", Color: "#000000", Style: 1},
			{Type: "top", Color: "#000000", Style: 1},
			{Type: "bottom", Color: "#000000", Style: 1},
			{Type: "right", Color: "#000000", Style: 1},
		},
	})
	f.SetCellStyle(sheetName, "A1", "H1", headerStyle)

	// Style the example row
	exampleStyle, _ := f.NewStyle(&excelize.Style{
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E7E6E6"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "#000000", Style: 1},
			{Type: "top", Color: "#000000", Style: 1},
			{Type: "bottom", Color: "#000000", Style: 1},
			{Type: "right", Color: "#000000", Style: 1},
		},
	})
	f.SetCellStyle(sheetName, "A2", "H2", exampleStyle)

	// Set column widths
	f.SetColWidth(sheetName, "A", "A", 30) // Title
	f.SetColWidth(sheetName, "B", "B", 25) // Slug
	f.SetColWidth(sheetName, "C", "C", 40) // Summary
	f.SetColWidth(sheetName, "D", "D", 60) // Content
	f.SetColWidth(sheetName, "E", "E", 40) // Cover Image URL
	f.SetColWidth(sheetName, "F", "F", 20) // Category
	f.SetColWidth(sheetName, "G", "G", 15) // Is Published
	f.SetColWidth(sheetName, "H", "H", 18) // Is Recommended

	// Set row height for header
	f.SetRowHeight(sheetName, 1, 25)

	// Set response headers
	fileName := "article-template-" + time.Now().Format("2006-01-02") + ".xlsx"
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename="+fileName)

	// Write to response
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate template"})
		return
	}
}

func generateSlug(title string) string {
	slug := strings.ToLower(title)
	reg := regexp.MustCompile("[^a-z0-9]+")
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return slug + "-" + strconv.FormatInt(time.Now().Unix(), 36)
}
