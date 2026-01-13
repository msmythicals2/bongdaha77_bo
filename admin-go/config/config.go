package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBCharset  string
	Port       string
	GinMode    string
	JWTSecret  string
}

var AppConfig *Config

func Load() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found or could not be loaded: %v", err)
		log.Printf("Current working directory: %s", getCurrentDir())
	} else {
		log.Println("Successfully loaded .env file")
	}

	AppConfig = &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBName:     getEnv("DB_NAME", "bong"),
		DBUser:     getEnv("DB_USER", "bongdaha"),
		DBPassword: getEnv("DB_PASSWORD", "Ffhghfdf2134546"),
		DBCharset:  getEnv("DB_CHARSET", "utf8mb4"),
		Port:       getEnv("PORT", "3001"),
		GinMode:    getEnv("GIN_MODE", "debug"),
		JWTSecret:  getEnv("JWT_SECRET", "bongdaha-admin-secret-key-2024"),
	}

	log.Printf("Config loaded - DB: %s@%s:%s/%s", AppConfig.DBUser, AppConfig.DBHost, AppConfig.DBPort, AppConfig.DBName)
}

func getCurrentDir() string {
	if dir, err := os.Getwd(); err == nil {
		return dir
	}
	return "unknown"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func GetPort() string {
	if AppConfig == nil {
		return "8080"
	}
	return AppConfig.Port
}

func GetJWTSecret() string {
	if AppConfig == nil {
		return "bongdaha-admin-secret-key-2024"
	}
	return AppConfig.JWTSecret
}

func GetDBConfig() *Config {
	return AppConfig
}
