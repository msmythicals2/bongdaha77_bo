package models

import (
	"admin-go/config"
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

func InitDB() {
	cfg := config.GetDBConfig()
	if cfg == nil {
		log.Fatal("Database configuration not loaded. Please ensure config.Load() is called before InitDB()")
	}

	// MySQL DSN format: user:password@tcp(host:port)/dbname?charset=utf8mb4&parseTime=True&loc=Local
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=%s&parseTime=True&loc=Local",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBCharset)

	log.Printf("Attempting to connect to MySQL database: %s@%s:%s/%s", cfg.DBUser, cfg.DBHost, cfg.DBPort, cfg.DBName)

	var err error
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		log.Println("Running in demo mode without database connection")
		return
	}

	// Test the connection
	if err = DB.Ping(); err != nil {
		log.Printf("Warning: Failed to ping database: %v", err)
		log.Println("Running in demo mode without database connection")
		DB = nil
		return
	}

	log.Println("Connected to MySQL database successfully")

	createTables()
	seedData()
}

func createTables() {
	tables := []string{
		`CREATE TABLE IF NOT EXISTS admins (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			username VARCHAR(255) UNIQUE NOT NULL,
			password TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS visitor_logs (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			ip_address VARCHAR(45) NOT NULL,
			visitor_id VARCHAR(255),
			session_id VARCHAR(255),
			page_path TEXT NOT NULL,
			page_type VARCHAR(100),
			reference_id VARCHAR(255),
			referrer TEXT,
			user_agent TEXT,
			device_type VARCHAR(100),
			os VARCHAR(100),
			browser VARCHAR(100),
			screen_resolution VARCHAR(50),
			country_code VARCHAR(10),
			country_name VARCHAR(100),
			city VARCHAR(100),
			visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			duration INT DEFAULT 0,
			is_new_visitor TINYINT(1) DEFAULT 1,
			page_view_count INT DEFAULT 1,
			visited_pages TEXT,
			last_visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_visit_time (visit_time),
			INDEX idx_ip_address (ip_address),
			INDEX idx_visitor_id (visitor_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS daily_stats (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			stats_date DATE UNIQUE NOT NULL,
			page_views INT DEFAULT 0,
			unique_visitors INT DEFAULT 0,
			unique_ips INT DEFAULT 0,
			new_visitors INT DEFAULT 0,
			returning_visitors INT DEFAULT 0,
			sessions INT DEFAULT 0,
			avg_duration INT DEFAULT 0,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_stats_date (stats_date)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS realtime_stats (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			room_key VARCHAR(255) UNIQUE NOT NULL,
			online_count INT DEFAULT 0,
			last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS articles (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			title TEXT NOT NULL,
			slug VARCHAR(255) UNIQUE NOT NULL,
			content LONGTEXT,
			content_json LONGTEXT,
			summary TEXT,
			cover_image TEXT,
			category_id BIGINT,
			is_published TINYINT(1) DEFAULT 0,
			is_recommended TINYINT(1) DEFAULT 0,
			view_count INT DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_published (is_published, created_at),
			INDEX idx_category (category_id),
			INDEX idx_slug (slug)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS uploaded_images (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			file_name VARCHAR(255) NOT NULL,
			file_path TEXT NOT NULL,
			file_url TEXT NOT NULL,
			file_size BIGINT DEFAULT 0,
			width INT,
			height INT,
			is_used TINYINT(1) DEFAULT 0,
			uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			used_at TIMESTAMP NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS categories (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			name VARCHAR(255) UNIQUE NOT NULL,
			slug VARCHAR(255) UNIQUE NOT NULL,
			description TEXT,
			sort_order INT DEFAULT 0,
			is_enabled TINYINT(1) DEFAULT 1,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS ip_blacklist (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			ip_address VARCHAR(45) UNIQUE NOT NULL,
			reason TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

		`CREATE TABLE IF NOT EXISTS ip_whitelist (
			id BIGINT AUTO_INCREMENT PRIMARY KEY,
			ip_address VARCHAR(45) UNIQUE NOT NULL,
			description TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}

	for _, table := range tables {
		_, err := DB.Exec(table)
		if err != nil {
			log.Printf("Failed to create table: %v", err)
		}
	}

	// Run migrations for existing data
	runMigrations()
}

func runMigrations() {
	// MySQL migrations - check if columns exist before adding

	// Check if slug column exists in articles table
	var slugExists bool
	err := DB.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM INFORMATION_SCHEMA.COLUMNS 
		WHERE TABLE_SCHEMA = DATABASE() 
		AND TABLE_NAME = 'articles' 
		AND COLUMN_NAME = 'slug'
	`).Scan(&slugExists)

	if err == nil && !slugExists {
		_, err = DB.Exec(`ALTER TABLE articles ADD COLUMN slug VARCHAR(255) UNIQUE`)
		if err != nil {
			log.Printf("Migration warning (slug): %v", err)
		}
	}

	// Check if content_json column exists in articles table
	var contentJsonExists bool
	err = DB.QueryRow(`
		SELECT COUNT(*) > 0 
		FROM INFORMATION_SCHEMA.COLUMNS 
		WHERE TABLE_SCHEMA = DATABASE() 
		AND TABLE_NAME = 'articles' 
		AND COLUMN_NAME = 'content_json'
	`).Scan(&contentJsonExists)

	if err == nil && !contentJsonExists {
		_, err = DB.Exec(`ALTER TABLE articles ADD COLUMN content_json LONGTEXT`)
		if err != nil {
			log.Printf("Migration warning (content_json): %v", err)
		}
	}

	// Generate slugs for existing articles that don't have them
	rows, err := DB.Query("SELECT id, title FROM articles WHERE slug IS NULL OR slug = ''")
	if err != nil {
		log.Printf("Migration query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id int64
		var title string
		if err := rows.Scan(&id, &title); err != nil {
			continue
		}

		// Generate slug from title
		slug := generateSlugFromTitle(title)

		// Ensure uniqueness
		originalSlug := slug
		counter := 1
		for {
			var existingId int64
			err := DB.QueryRow("SELECT id FROM articles WHERE slug = ? AND id != ?", slug, id).Scan(&existingId)
			if err != nil {
				// Slug is unique
				break
			}
			slug = fmt.Sprintf("%s-%d", originalSlug, counter)
			counter++
		}

		// Update the article with the generated slug
		_, err = DB.Exec("UPDATE articles SET slug = ? WHERE id = ?", slug, id)
		if err != nil {
			log.Printf("Failed to update slug for article %d: %v", id, err)
		}
	}
}

func generateSlugFromTitle(title string) string {
	// Convert to lowercase
	slug := strings.ToLower(title)

	// Replace spaces and special characters with hyphens
	reg := regexp.MustCompile(`[^a-z0-9]+`)
	slug = reg.ReplaceAllString(slug, "-")

	// Remove leading/trailing hyphens
	slug = strings.Trim(slug, "-")

	// If empty, generate a random slug
	if slug == "" {
		slug = fmt.Sprintf("article-%d", time.Now().Unix())
	}

	return slug
}

func seedData() {
	// Check if admin exists
	var count int
	DB.QueryRow("SELECT COUNT(*) FROM admins").Scan(&count)
	if count == 0 {
		// Create default admin (password: admin123)
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		DB.Exec("INSERT INTO admins (username, password) VALUES (?, ?)", "admin", string(hashedPassword))
		log.Println("Default admin created: admin / admin123")
	}

	// Seed default categories
	DB.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if count == 0 {
		categories := []struct {
			name, slug, desc string
			order            int
		}{
			{"Football News", "football-news", "Latest football news and updates", 1},
			{"Match Analysis", "match-analysis", "In-depth match analysis and predictions", 2},
			{"Transfer News", "transfer-news", "Player transfers and rumors", 3},
			{"League Updates", "league-updates", "League standings and updates", 4},
		}
		for _, c := range categories {
			DB.Exec("INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)",
				c.name, c.slug, c.desc, c.order)
		}
		log.Println("Default categories created")
	}
}
