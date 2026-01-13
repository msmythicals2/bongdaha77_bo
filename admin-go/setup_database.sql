-- MySQL Database Setup Script for Bongdaha Admin
-- Run this script in MySQL to create the database and user

-- Create database
CREATE DATABASE IF NOT EXISTS bong CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user (if not exists)
CREATE USER IF NOT EXISTS 'bongdaha'@'localhost' IDENTIFIED BY 'Ffhghfdf2134546';

-- Grant privileges
GRANT ALL PRIVILEGES ON bong.* TO 'bongdaha'@'localhost';

-- Flush privileges to ensure they take effect
FLUSH PRIVILEGES;

-- Use the database
USE bong;

-- Show confirmation
SELECT 'Database setup completed successfully!' as message;