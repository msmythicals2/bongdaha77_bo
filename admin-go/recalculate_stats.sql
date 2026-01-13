-- Recalculate Daily Statistics from Visitor Logs
-- This script will rebuild the daily_stats table based on existing visitor_logs data

-- Backup existing daily_stats (optional)
-- CREATE TABLE daily_stats_backup AS SELECT * FROM daily_stats;

-- Clear existing daily_stats
TRUNCATE TABLE daily_stats;

-- Recalculate daily statistics from visitor_logs
INSERT INTO daily_stats (
    stats_date,
    page_views,
    unique_visitors,
    unique_ips,
    new_visitors,
    returning_visitors,
    sessions,
    avg_duration,
    updated_at
)
SELECT 
    DATE(visit_time) as stats_date,
    -- PV: Total page view count (sum of all page_view_count)
    SUM(page_view_count) as page_views,
    -- UV: Count of unique IPs per day
    COUNT(DISTINCT ip_address) as unique_visitors,
    -- Unique IPs: Same as UV
    COUNT(DISTINCT ip_address) as unique_ips,
    -- New visitors: Count of records where is_new_visitor = 1
    SUM(CASE WHEN is_new_visitor = 1 THEN 1 ELSE 0 END) as new_visitors,
    -- Returning visitors: Count of records where is_new_visitor = 0
    SUM(CASE WHEN is_new_visitor = 0 THEN 1 ELSE 0 END) as returning_visitors,
    -- Sessions: Count of unique visitor_id per day
    COUNT(DISTINCT visitor_id) as sessions,
    -- Average duration
    AVG(COALESCE(duration, 0)) as avg_duration,
    NOW() as updated_at
FROM visitor_logs
GROUP BY DATE(visit_time)
ORDER BY stats_date;

-- Verify the results
SELECT 
    stats_date,
    page_views as PV,
    unique_visitors as UV,
    unique_ips as IPs,
    new_visitors as New,
    returning_visitors as Returning,
    sessions as Sessions
FROM daily_stats
ORDER BY stats_date DESC
LIMIT 30;

-- Check today's statistics
SELECT 
    'Today' as period,
    COUNT(*) as total_records,
    SUM(page_view_count) as PV,
    COUNT(DISTINCT ip_address) as UV,
    SUM(CASE WHEN is_new_visitor = 1 THEN 1 ELSE 0 END) as new_visitors
FROM visitor_logs
WHERE DATE(visit_time) = CURDATE();

-- Check country distribution
SELECT 
    COALESCE(NULLIF(country_name, ''), 'Unknown') as country,
    COUNT(DISTINCT ip_address) as unique_visitors,
    SUM(page_view_count) as page_views
FROM visitor_logs
WHERE DATE(visit_time) = CURDATE()
GROUP BY COALESCE(NULLIF(country_name, ''), 'Unknown')
ORDER BY unique_visitors DESC
LIMIT 10;

-- Update is_new_visitor flag based on historical data
-- This ensures the flag is correct for existing records
UPDATE visitor_logs vl1
SET is_new_visitor = (
    SELECT CASE 
        WHEN COUNT(*) = 0 THEN 1 
        ELSE 0 
    END
    FROM visitor_logs vl2
    WHERE vl2.ip_address = vl1.ip_address
    AND DATE(vl2.visit_time) < DATE(vl1.visit_time)
)
WHERE DATE(visit_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);

-- Verify PV != UV (they should be different)
SELECT 
    stats_date,
    page_views as PV,
    unique_visitors as UV,
    CASE 
        WHEN page_views = unique_visitors THEN 'WARNING: PV = UV'
        WHEN page_views > unique_visitors THEN 'OK: PV > UV'
        ELSE 'ERROR: PV < UV'
    END as status
FROM daily_stats
WHERE stats_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY stats_date DESC;
