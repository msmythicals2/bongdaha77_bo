package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// GeoLocationInfo represents geographical location data
type GeoLocationInfo struct {
	CountryCode string `json:"country_code"`
	CountryName string `json:"country_name"`
	City        string `json:"city"`
}

// getGeoLocation retrieves geographical location information for an IP address
// Returns countryCode, countryName, city
func getGeoLocation(ip string) (string, string, string) {
	// Handle localhost and private IPs
	if isLocalOrPrivateIP(ip) {
		return "LOCAL", "Local Network", "Local"
	}

	// Try to get geo info from cache or API
	info := getGeoFromAPI(ip)
	if info != nil {
		return info.CountryCode, info.CountryName, info.City
	}

	// Return unknown if all methods fail
	return "", "Unknown", ""
}

// isLocalOrPrivateIP checks if an IP is localhost or in a private range
func isLocalOrPrivateIP(ip string) bool {
	if ip == "127.0.0.1" || ip == "::1" || ip == "localhost" {
		return true
	}

	// Check for private IP ranges
	if strings.HasPrefix(ip, "192.168.") ||
		strings.HasPrefix(ip, "10.") ||
		strings.HasPrefix(ip, "172.16.") ||
		strings.HasPrefix(ip, "172.17.") ||
		strings.HasPrefix(ip, "172.18.") ||
		strings.HasPrefix(ip, "172.19.") ||
		strings.HasPrefix(ip, "172.20.") ||
		strings.HasPrefix(ip, "172.21.") ||
		strings.HasPrefix(ip, "172.22.") ||
		strings.HasPrefix(ip, "172.23.") ||
		strings.HasPrefix(ip, "172.24.") ||
		strings.HasPrefix(ip, "172.25.") ||
		strings.HasPrefix(ip, "172.26.") ||
		strings.HasPrefix(ip, "172.27.") ||
		strings.HasPrefix(ip, "172.28.") ||
		strings.HasPrefix(ip, "172.29.") ||
		strings.HasPrefix(ip, "172.30.") ||
		strings.HasPrefix(ip, "172.31.") {
		return true
	}

	// Parse and check using net package
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return true
	}

	return parsedIP.IsLoopback() || parsedIP.IsPrivate()
}

// getGeoFromAPI fetches geo-location data from a free API service
// Using ip-api.com (free, no API key required, 45 requests/minute limit)
func getGeoFromAPI(ip string) *GeoLocationInfo {
	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	// Use ip-api.com free service
	url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,country,countryCode,city", ip)

	resp, err := client.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var result struct {
		Status      string `json:"status"`
		Country     string `json:"country"`
		CountryCode string `json:"countryCode"`
		City        string `json:"city"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	if result.Status != "success" {
		return nil
	}

	return &GeoLocationInfo{
		CountryCode: result.CountryCode,
		CountryName: result.Country,
		City:        result.City,
	}
}

// Alternative: getGeoFromIPAPI uses ipapi.co (requires API key for production)
func getGeoFromIPAPI(ip string) *GeoLocationInfo {
	client := &http.Client{
		Timeout: 3 * time.Second,
	}

	// Free tier: 1000 requests/day, no API key required
	// For production, get API key from https://ipapi.co/
	url := fmt.Sprintf("https://ipapi.co/%s/json/", ip)

	resp, err := client.Get(url)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var result struct {
		CountryCode string `json:"country_code"`
		CountryName string `json:"country_name"`
		City        string `json:"city"`
		Error       bool   `json:"error"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	if result.Error {
		return nil
	}

	return &GeoLocationInfo{
		CountryCode: result.CountryCode,
		CountryName: result.CountryName,
		City:        result.City,
	}
}

/*
PRODUCTION RECOMMENDATIONS:

1. Use MaxMind GeoIP2 Database (Recommended for production):
   - Download GeoLite2-City.mmdb from https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
   - Install: go get github.com/oschwald/geoip2-golang
   - Example:

     import "github.com/oschwald/geoip2-golang"

     db, _ := geoip2.Open("GeoLite2-City.mmdb")
     defer db.Close()
     record, _ := db.City(net.ParseIP(ip))
     countryCode := record.Country.IsoCode
     countryName := record.Country.Names["en"]
     city := record.City.Names["en"]

2. Use IP2Location Database:
   - Download from https://lite.ip2location.com/
   - Install: go get github.com/ip2location/ip2location-go
   - Provides offline lookup with regular updates

3. Use Redis Cache:
   - Cache geo-location results to reduce API calls
   - Set TTL to 24 hours or longer
   - Example:

     key := "geo:" + ip
     if cached, err := redis.Get(key); err == nil {
         return parseCachedGeo(cached)
     }
     info := getGeoFromAPI(ip)
     redis.Set(key, serializeGeo(info), 24*time.Hour)

4. Rate Limiting:
   - Implement rate limiting for API calls
   - Use token bucket or leaky bucket algorithm
   - Fallback to "Unknown" when rate limit exceeded

5. Batch Processing:
   - Process geo-location in background job
   - Update visitor_logs asynchronously
   - Reduces impact on tracking performance
*/
