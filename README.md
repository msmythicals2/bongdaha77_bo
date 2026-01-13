# Bongdaha - Real-Time Football Livescore Platform

A modern, enterprise-level football livescore platform with real-time match data, news management, and comprehensive visitor analytics.

## 🚀 Features

### Frontend (Public)
- **Real-time Football Livescore** - Live match updates, fixtures, and results
- **News & Articles** - Dynamic category-based news system
- **Responsive Design** - Mobile-first, dark theme UI
- **Visitor Tracking** - Automatic page view and session tracking

### Admin Panel
- **Dashboard** - Real-time statistics and analytics
- **Visitor Analytics** - PV/UV tracking, device/browser stats, geographic distribution
- **Content Management** - Rich text editor (Editor.js) for articles
- **Category Management** - Organize content by categories
- **Image Management** - Batch upload, organize, and track image usage
- **Security** - IP blacklist/whitelist, JWT authentication

## 📦 Tech Stack

**Frontend:**
- Node.js + Express
- Vanilla JavaScript (ES6 Modules)
- TailwindCSS
- Chart.js
- Editor.js

**Backend:**
- Go (Gin framework)
- SQLite database
- JWT authentication
- bcrypt password hashing

**APIs:**
- Football API (api-football.com)
- RSS feeds for news

## 🛠️ Installation

### Prerequisites
- Node.js 16+
- Go 1.21+
- Football API key from [api-football.com](https://www.api-football.com/)

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd bongdaha2-main
```

2. **Frontend Setup**
```bash
cd bongdaha2
npm install
cp .env.example .env
# Edit .env and add your FOOTBALL_API_KEY
```

3. **Backend Setup**
```bash
cd ../admin-go
cp .env.example .env
# Edit .env and set JWT_SECRET
go mod tidy
```

4. **Create upload directories**
```bash
mkdir -p bongdaha2/admin-HHrg9404nflfja22f/uploads/images
mkdir -p admin-go/uploads
```

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Frontend:**
```bash
cd bongdaha2
npm start
# Runs on http://localhost:3000
```

**Terminal 2 - Admin Backend:**
```bash
cd admin-go
go run main.go
# Runs on http://localhost:8080
```

### Access Points

- **Main Site:** http://localhost:3000
- **News:** http://localhost:3000/news
- **Admin Panel:** http://localhost:3000/admin-HHrg9404nflfja22f
  - Default credentials: `admin` / `admin123`

## 📁 Project Structure

```
bongdaha2-main/
├── bongdaha2/                    # Frontend application
│   ├── public/                   # Public assets
│   │   ├── index.html           # Main livescore page
│   │   ├── articles.html        # News listing page
│   │   ├── article.html         # Article detail page
│   │   ├── main.js              # Main app logic
│   │   └── tracker.js           # Visitor tracking
│   ├── admin-HHrg9404nflfja22f/ # Admin panel
│   │   ├── index.html           # Admin UI
│   │   ├── js/
│   │   │   ├── main.js          # Entry point
│   │   │   └── modules/         # Modular JS
│   │   │       ├── api.js       # API client
│   │   │       ├── auth.js      # Authentication
│   │   │       ├── dashboard.js # Dashboard
│   │   │       ├── visitors.js  # Analytics
│   │   │       ├── articles.js  # Content management
│   │   │       ├── images.js    # Image management
│   │   │       └── ...
│   │   └── uploads/             # Uploaded images
│   └── server.js                # Express server
│
├── admin-go/                     # Go backend API
│   ├── main.go                  # Entry point
│   ├── config/                  # Configuration
│   ├── models/                  # Database models
│   ├── handlers/                # API handlers
│   │   ├── auth.go             # Authentication
│   │   ├── dashboard.go        # Dashboard stats
│   │   ├── visitors.go         # Visitor analytics
│   │   ├── articles.go         # Article CRUD
│   │   ├── images.go           # Image management
│   │   ├── public.go           # Public API
│   │   └── ...
│   ├── middleware/              # JWT middleware
│   └── uploads/                 # Uploaded files
│
└── .gitignore                   # Git ignore rules
```

## 🔧 Configuration

### Frontend (.env)
```env
FOOTBALL_API_KEY=your_api_key_here
PORT=3000
```

### Backend (.env)
```env
JWT_SECRET=your_secret_key_here
PORT=8080
```

## 📊 Database Schema

SQLite database is automatically created on first run with tables for:
- `admin` - Admin users
- `visitor_logs` - Visitor tracking data
- `daily_stats` - Daily aggregated statistics
- `articles` - News articles
- `categories` - Content categories
- `uploaded_images` - Image metadata
- `ip_blacklist` / `ip_whitelist` - Security

## 🎨 Admin Panel Features

### Modular Architecture
The admin panel uses ES6 modules for maintainability:
- **api.js** - Centralized API requests
- **utils.js** - Common utilities
- **auth.js** - Login/logout
- **dashboard.js** - Dashboard metrics
- **visitors.js** - Analytics & charts
- **articles.js** - Content editor with Editor.js
- **images.js** - Batch image management
- **categories.js** - Category CRUD
- **system.js** - Security settings

### Visitor Analytics
- PV/UV tracking (UV = unique IPs per day)
- 7-day trend charts
- 24-hour UV distribution
- Device/Browser pie charts
- Country distribution
- Traffic sources
- Top pages

### Content Management
- Rich text editor (Editor.js)
- Image upload & management
- Category organization
- SEO-friendly slugs
- View count tracking

## 🔒 Security

- JWT-based authentication
- bcrypt password hashing
- IP blacklist/whitelist
- CORS configuration
- Environment variable protection

## 📝 API Endpoints

### Public API (No Auth)
```
GET  /api/public/categories          # Get categories with articles
GET  /api/public/articles            # Get published articles
GET  /api/public/article/:slug       # Get article by slug
POST /api/track                      # Track visitor
```

### Admin API (JWT Required)
```
POST /api/login                      # Login
GET  /api/dashboard                  # Dashboard stats
GET  /api/visitors/stats             # Visitor analytics
GET  /api/articles                   # List articles
POST /api/articles                   # Create article
PUT  /api/articles/:id               # Update article
POST /api/images/upload              # Upload image
...
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is private and proprietary.

## 🙏 Credits

- Football data powered by [API-Football](https://www.api-football.com/)
- Icons by [Font Awesome](https://fontawesome.com/)
- Editor by [Editor.js](https://editorjs.io/)

---

**Note:** This is an enterprise-level application. Ensure proper security measures are in place before deploying to production.
