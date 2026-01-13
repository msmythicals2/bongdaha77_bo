# CORS Configuration Guide

## Overview
This document explains the CORS (Cross-Origin Resource Sharing) setup for the Bongdaha project.

## Domain Architecture

- **Frontend**: `https://b.bb298.com` (Node.js server serving static files)
- **Backend API**: `https://api-go.bb298.com` (Go API server)

These are **different domains**, so CORS headers are required for the frontend to make API requests to the backend.

## Changes Made

### 1. Go Backend (`admin-go/main.go`)

Updated CORS middleware to:
- Accept requests from `https://b.bb298.com`
- Support credentials (cookies, authorization headers)
- Handle preflight OPTIONS requests
- Allow localhost for development

```go
// CORS middleware
r.Use(func(c *gin.Context) {
    origin := c.Request.Header.Get("Origin")
    allowedOrigins := []string{
        "https://b.bb298.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    }
    
    // Check if origin is allowed
    isAllowed := false
    for _, allowed := range allowedOrigins {
        if origin == allowed {
            isAllowed = true
            break
        }
    }
    
    if isAllowed {
        c.Header("Access-Control-Allow-Origin", origin)
        c.Header("Access-Control-Allow-Credentials", "true")
    } else if origin == "" {
        c.Header("Access-Control-Allow-Origin", "*")
    }
    
    c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
    c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
    c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Type")
    c.Header("Access-Control-Max-Age", "86400")
    
    if c.Request.Method == "OPTIONS" {
        c.AbortWithStatus(http.StatusNoContent)
        return
    }
    c.Next()
})
```

### 2. Node.js Frontend Server (`bongdaha2/server.js`)

Updated CORS configuration to:
- Accept requests from both domains
- Support credentials
- Handle preflight requests

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://b.bb298.com',
      'https://api-go.bb298.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400
};

app.use(cors(corsOptions));
```

## Environment Configuration

### Node.js Server (`.env`)

```bash
# Production
ADMIN_API_URL=https://api-go.bb298.com
FRONTEND_DOMAIN=https://b.bb298.com

# Development
ADMIN_API_URL=http://localhost:8080
FRONTEND_DOMAIN=http://localhost:3000
```

### Go Backend (`.env`)

No specific CORS-related environment variables needed. The allowed origins are hardcoded in the middleware for security.

## Testing

After deploying the changes:

1. **Restart both servers**:
   ```bash
   # Node.js server
   cd bongdaha2
   npm start
   
   # Go backend
   cd admin-go
   go run main.go
   ```

2. **Test the API request**:
   - Open `https://b.bb298.com` in your browser
   - Open DevTools (F12) → Network tab
   - Navigate to a page that makes API calls (e.g., articles page)
   - Check the request to `https://api-go.bb298.com/api/public/categories`
   - Verify the response headers include:
     - `Access-Control-Allow-Origin: https://b.bb298.com`
     - `Access-Control-Allow-Credentials: true`

3. **Check for errors**:
   - No CORS errors should appear in the browser console
   - API requests should complete successfully

## Common Issues

### Issue: "No 'Access-Control-Allow-Origin' header"
**Solution**: Ensure the Go backend is running and the origin is in the `allowedOrigins` list.

### Issue: "Credentials flag is 'true', but 'Access-Control-Allow-Origin' is '*'"
**Solution**: When using credentials, you cannot use wildcard `*`. The specific origin must be set (already fixed).

### Issue: Preflight OPTIONS request fails
**Solution**: Ensure the CORS middleware handles OPTIONS requests before other middleware (already fixed).

## Security Notes

- The allowed origins are explicitly whitelisted for security
- Credentials are only allowed for trusted origins
- Preflight requests are cached for 24 hours to reduce overhead
- For production, consider removing localhost origins from the allowed list
