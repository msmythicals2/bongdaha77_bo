package handlers

import (
	"admin-go/models"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetImageStats(c *gin.Context) {
	var totalImages, usedImages, unusedImages int
	var totalSize int64

	models.DB.QueryRow("SELECT COUNT(*) FROM uploaded_images").Scan(&totalImages)
	models.DB.QueryRow("SELECT COUNT(*) FROM uploaded_images WHERE is_used = 1").Scan(&usedImages)
	models.DB.QueryRow("SELECT COUNT(*) FROM uploaded_images WHERE is_used = 0").Scan(&unusedImages)
	models.DB.QueryRow("SELECT COALESCE(SUM(file_size), 0) FROM uploaded_images").Scan(&totalSize)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"total_images":  totalImages,
			"used_images":   usedImages,
			"unused_images": unusedImages,
			"total_size":    totalSize,
			"total_size_mb": float64(totalSize) / (1024 * 1024),
		},
	})
}

func GetImageList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	isUsedFilter := c.Query("is_used")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	whereClause := "1=1"
	args := []interface{}{}

	if isUsedFilter == "true" {
		whereClause += " AND is_used = 1"
	} else if isUsedFilter == "false" {
		whereClause += " AND is_used = 0"
	}

	var total int
	models.DB.QueryRow("SELECT COUNT(*) FROM uploaded_images WHERE "+whereClause, args...).Scan(&total)

	query := `
		SELECT id, file_name, file_path, file_url, file_size, width, height, is_used, uploaded_at
		FROM uploaded_images
		WHERE ` + whereClause + `
		ORDER BY uploaded_at DESC
		LIMIT ? OFFSET ?`

	args = append(args, pageSize, offset)
	rows, err := models.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	images := []map[string]interface{}{}
	for rows.Next() {
		var id int64
		var fileName, filePath, fileUrl string
		var fileSize int64
		var width, height *int
		var isUsed bool
		var uploadedAt time.Time

		rows.Scan(&id, &fileName, &filePath, &fileUrl, &fileSize, &width, &height, &isUsed, &uploadedAt)

		images = append(images, map[string]interface{}{
			"id":          id,
			"file_name":   fileName,
			"file_path":   filePath,
			"file_url":    fileUrl,
			"file_size":   fileSize,
			"width":       width,
			"height":      height,
			"is_used":     isUsed,
			"uploaded_at": uploadedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      images,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func UploadImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "No file uploaded"})
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".bmp": true}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid file type"})
		return
	}

	// Validate file size (max 10MB)
	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "File too large (max 10MB)"})
		return
	}

	// Save to frontend public directory (relative path from admin-go)
	// Frontend path: ../bongdaha2/public/uploads/images/YYYY-MM/
	now := time.Now()
	relativeDir := filepath.Join("..", "bongdaha2", "public", "uploads", "images", now.Format("2006-01"))
	if err := os.MkdirAll(relativeDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create directory"})
		return
	}

	// Generate unique filename
	newFileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	filePath := filepath.Join(relativeDir, newFileName)
	// Public URL path for frontend access (no admin path exposed)
	fileUrl := "/uploads/images/" + now.Format("2006-01") + "/" + newFileName

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save file"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save file"})
		return
	}

	// Save to database
	result, err := models.DB.Exec(`
		INSERT INTO uploaded_images (file_name, file_path, file_url, file_size, is_used, uploaded_at)
		VALUES (?, ?, ?, ?, 0, ?)`,
		header.Filename, filePath, fileUrl, header.Size, now)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database error"})
		return
	}

	id, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":        id,
			"file_name": header.Filename,
			"file_path": filePath,
			"file_url":  fileUrl,
			"file_size": header.Size,
		},
	})
}

func MarkImageUsed(c *gin.Context) {
	id := c.Param("id")

	_, err := models.DB.Exec("UPDATE uploaded_images SET is_used = 1, used_at = ? WHERE id = ?", time.Now(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MarkImageUnused(c *gin.Context) {
	id := c.Param("id")

	_, err := models.DB.Exec("UPDATE uploaded_images SET is_used = 0, used_at = NULL WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteImage(c *gin.Context) {
	id := c.Param("id")

	var filePath string
	err := models.DB.QueryRow("SELECT file_path FROM uploaded_images WHERE id = ?", id).Scan(&filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Image not found"})
		return
	}

	// Delete physical file
	if filePath != "" {
		os.Remove(filePath)
	}

	// Delete from database
	_, err = models.DB.Exec("DELETE FROM uploaded_images WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// UploadArticleImage uploads images for articles to a separate directory
func UploadArticleImage(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "No file uploaded"})
		return
	}
	defer file.Close()

	// Validate file type
	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".bmp": true}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid file type"})
		return
	}

	// Validate file size (max 10MB)
	if header.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "File too large (max 10MB)"})
		return
	}

	// Save to article uploads directory with month/day structure
	// Path: ../bongdaha2/public/uploads/article/YYYY-MM/DD/
	now := time.Now()
	monthDir := now.Format("2006-01")
	dayDir := now.Format("02")

	// Use relative path from admin-go directory
	relativeDir := filepath.Join("..", "bongdaha2", "public", "uploads", "article", monthDir, dayDir)
	if err := os.MkdirAll(relativeDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to create directory"})
		return
	}

	// Generate unique filename
	newFileName := fmt.Sprintf("%s%s", uuid.New().String(), ext)
	filePath := filepath.Join(relativeDir, newFileName)

	// Public URL path for frontend access (no admin path exposed)
	fileUrl := "/uploads/article/" + monthDir + "/" + dayDir + "/" + newFileName

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save file"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Failed to save file"})
		return
	}

	// Save to database with article type marker
	result, err := models.DB.Exec(`
		INSERT INTO uploaded_images (file_name, file_path, file_url, file_size, is_used, uploaded_at)
		VALUES (?, ?, ?, ?, 1, ?)`,
		header.Filename, fileUrl, fileUrl, header.Size, now)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "Database error"})
		return
	}

	id, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"id":        id,
			"file_name": header.Filename,
			"file_path": fileUrl,
			"file_url":  fileUrl,
			"file_size": header.Size,
		},
	})
}
