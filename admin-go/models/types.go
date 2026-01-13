package models

import "time"

type Admin struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type VisitorLog struct {
	ID               int64     `json:"id"`
	IpAddress        string    `json:"ip_address"`
	VisitorId        string    `json:"visitor_id"`
	SessionId        string    `json:"session_id"`
	PagePath         string    `json:"page_path"`
	PageType         string    `json:"page_type"`
	ReferenceId      string    `json:"reference_id"`
	Referrer         string    `json:"referrer"`
	UserAgent        string    `json:"user_agent"`
	DeviceType       string    `json:"device_type"`
	OS               string    `json:"os"`
	Browser          string    `json:"browser"`
	ScreenResolution string    `json:"screen_resolution"`
	CountryCode      string    `json:"country_code"`
	CountryName      string    `json:"country_name"`
	City             string    `json:"city"`
	VisitTime        time.Time `json:"visit_time"`
	Duration         int       `json:"duration"`
	IsNewVisitor     bool      `json:"is_new_visitor"`
	PageViewCount    int       `json:"page_view_count"`
	VisitedPages     string    `json:"visited_pages"`
	LastVisitTime    time.Time `json:"last_visit_time"`
}

type DailyStats struct {
	ID                int64     `json:"id"`
	StatsDate         string    `json:"stats_date"`
	PageViews         int       `json:"page_views"`
	UniqueVisitors    int       `json:"unique_visitors"`
	UniqueIps         int       `json:"unique_ips"`
	NewVisitors       int       `json:"new_visitors"`
	ReturningVisitors int       `json:"returning_visitors"`
	Sessions          int       `json:"sessions"`
	AvgDuration       int       `json:"avg_duration"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type RealtimeStats struct {
	ID          int64     `json:"id"`
	RoomKey     string    `json:"room_key"`
	OnlineCount int       `json:"online_count"`
	LastUpdated time.Time `json:"last_updated"`
}

type Article struct {
	ID            int64     `json:"id"`
	Title         string    `json:"title"`
	Slug          string    `json:"slug"`
	Content       string    `json:"content"`
	ContentJson   string    `json:"content_json"`
	Summary       string    `json:"summary"`
	CoverImage    string    `json:"cover_image"`
	CategoryId    *int64    `json:"category_id"`
	CategoryName  string    `json:"category_name,omitempty"`
	IsPublished   bool      `json:"is_published"`
	IsRecommended bool      `json:"is_recommended"`
	ViewCount     int       `json:"view_count"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Category struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	SortOrder    int       `json:"sort_order"`
	IsEnabled    bool      `json:"is_enabled"`
	ArticleCount int       `json:"article_count,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type IpBlacklist struct {
	ID        int64      `json:"id"`
	IpAddress string     `json:"ip_address"`
	Reason    string     `json:"reason"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
}

type IpWhitelist struct {
	ID          int64     `json:"id"`
	IpAddress   string    `json:"ip_address"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type TrackingRequest struct {
	Action       string `json:"action"`
	VisitorId    string `json:"visitor_id"`
	SessionId    string `json:"session_id"`
	Timestamp    string `json:"timestamp"`
	PagePath     string `json:"page_path"`
	PageType     string `json:"page_type"`
	ReferenceId  string `json:"reference_id"`
	Referrer     string `json:"referrer"`
	DeviceType   string `json:"device_type"`
	OS           string `json:"os"`
	Browser      string `json:"browser"`
	ScreenWidth  int    `json:"screen_width"`
	ScreenHeight int    `json:"screen_height"`
	Language     string `json:"language"`
	Duration     int    `json:"duration"`
	Status       string `json:"status"`
	Event        string `json:"event"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}
