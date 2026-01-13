# Bongdaha Admin API

Go backend for Bongdaha admin panel using Gin framework.

## Features

- **Authentication**: JWT-based login
- **Visitor Statistics**: PV/UV tracking, trends, device/browser stats
- **Content Management**: Articles CRUD, batch operations
- **Category Management**: Article categories
- **System Management**: IP Blacklist/Whitelist, Change Password

## Setup

### Prerequisites

- Go 1.21+
- GCC (for SQLite) - On Windows, install via MinGW or use TDM-GCC

### Installation

```bash
cd admin-go

# Download dependencies
go mod tidy

# Run the server
go run main.go
```

### Default Admin Account

- **Username**: admin
- **Password**: admin123

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Admin login |
| POST | `/api/track` | Visitor tracking |
| GET | `/api/track/online` | Get online count |

### Protected (Requires JWT)

#### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Dashboard stats |

#### Visitors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/visitors/stats` | Visitor statistics |
| GET | `/api/visitors/list` | Visitor list |
| GET | `/api/visitors/trend` | Traffic trend |

#### Articles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/articles` | List articles |
| GET | `/api/articles/:id` | Get article |
| POST | `/api/articles` | Create article |
| PUT | `/api/articles/:id` | Update article |
| DELETE | `/api/articles/:id` | Delete article |
| POST | `/api/articles/batch-delete` | Batch delete |
| POST | `/api/articles/batch-status` | Batch update status |

#### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

#### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blacklist` | Get blacklist |
| POST | `/api/blacklist` | Add to blacklist |
| DELETE | `/api/blacklist/:id` | Remove from blacklist |
| GET | `/api/whitelist` | Get whitelist |
| POST | `/api/whitelist` | Add to whitelist |
| DELETE | `/api/whitelist/:id` | Remove from whitelist |
| POST | `/api/change-password` | Change password |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | API server port |
| JWT_SECRET | bongdaha-admin-secret-key-2024 | JWT signing key |

## Database

Uses SQLite (`admin.db`) with the following tables:

- `admins` - Admin users
- `visitor_logs` - Visitor tracking data
- `daily_stats` - Daily aggregated statistics
- `realtime_stats` - Real-time online stats
- `articles` - Article content
- `categories` - Article categories
- `ip_blacklist` - Blocked IPs
- `ip_whitelist` - Allowed IPs
