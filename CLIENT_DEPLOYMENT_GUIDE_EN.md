# Customer Deployment Guide (Bongdaha2)

This document is for customers / ops engineers to deploy and run Bongdaha2 on a fresh Linux server (Go backend + Node service serving the static frontend). The services are managed by systemd (auto-restart + enable on boot).

---

## 1. System Requirements

- OS: Ubuntu / Debian (Ubuntu 22.04/24.04 recommended)
- Privileges: sudo access (required to write systemd unit files)
- Network: outbound Internet access (to install dependencies and call Football API)
- Database: MySQL (provided by customer; server must be able to connect)

---

## 2. Directory Layout

Example deployment directory:

- Project root: `/home/ubuntu/bongdaha2-main/`
- Go backend: `admin-go/`
- Node service (serves static frontend + some API endpoints): `bongdaha2/`
- One-click deployment script: `deploy.sh`

---

## 3. One-click Deployment (Recommended)

### 3.1 Prepare Environment Files (Required)

From the project root, create and fill **two** environment files:

```bash
cp admin-go/.env.example admin-go/.env
cp bongdaha2/.env.example bongdaha2/.env
```

Open both files and fill in the values.

---

### 3.2 Configuration Details

#### A) `admin-go/.env` (Go backend)

- `DB_HOST`: MySQL host
- `DB_PORT`: MySQL port (default 3306)
- `DB_NAME`: database name
- `DB_USER`: username
- `DB_PASSWORD`: password
- `PORT`: Go backend port (recommend 8080)
- `GIN_MODE`: set to `release` for production
- `JWT_SECRET`: JWT signing secret (can be empty; deploy script will generate and append if missing)
- `CORS_ALLOWED_ORIGINS`: allowed CORS origins (comma-separated)

Example:

```env
PORT=8080
GIN_MODE=release
CORS_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000
```

#### B) `bongdaha2/.env` (Node service)

- `PORT`: Node service port (recommend 3000)
- `FOOTBALL_API_KEY`: Football API key (**required**, service exits if missing)
- `ADMIN_API_URL`: Go backend URL, e.g. `http://127.0.0.1:8080`
- `FRONTEND_DOMAIN`: site domain, e.g. `https://your-domain.com`
- `CORS_ALLOWED_ORIGINS`: allowed CORS origins (comma-separated)

Notes:

- `ADMIN_API_URL` is only the Go backend address; it is **not** a CORS setting.
- Whether the browser allows cross-origin requests depends on the **target service** returning proper CORS headers:
  - If your page is served from `https://b.xxx.com` and `ADMIN_API_URL=https://api.xxx.com`, the cross-origin request is to the **Go backend**, so `admin-go/.env` must set `CORS_ALLOWED_ORIGINS` to include `https://b.xxx.com`.
  - `CORS_ALLOWED_ORIGINS` in `bongdaha2/.env` only affects the Node service's own endpoints (e.g. `/api/config`). If everything is served from the same domain (same-origin), you may leave it empty, but it is recommended to set it in production for consistency.

Example:

```env
PORT=3000
FOOTBALL_API_KEY=xxxxxxxxxxxxxxxx
ADMIN_API_URL=http://127.0.0.1:8080
FRONTEND_DOMAIN=https://your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000
```

---

### 3.3 Run the Deployment Script

From the project root:

```bash
bash ./deploy.sh --install-deps
```

Notes:

- `--install-deps` installs missing dependencies on Ubuntu/Debian using apt: Go, Node/npm, openssl, etc.
- The script will:
  - download Go modules
  - build the Go backend
  - install Node dependencies (if `node_modules` does not exist)
  - create/update and start systemd services (and enable on boot)

If you want to force reinstall Node dependencies:

```bash
bash ./deploy.sh --install-deps --force-npm-install
```

---

## 4. Service Management (systemd)

After deployment, two systemd services will exist:

- `bongdaha2-admin-go.service` (Go backend)
- `bongdaha2-node.service` (Node service / frontend)

### 4.1 Check service status

```bash
sudo systemctl status bongdaha2-admin-go.service --no-pager
sudo systemctl status bongdaha2-node.service --no-pager
```

### 4.2 Start/Stop/Restart

```bash
sudo systemctl restart bongdaha2-admin-go.service
sudo systemctl restart bongdaha2-node.service

sudo systemctl stop bongdaha2-admin-go.service
sudo systemctl stop bongdaha2-node.service

sudo systemctl start bongdaha2-admin-go.service
sudo systemctl start bongdaha2-node.service
```

### 4.3 View logs

```bash
sudo journalctl -u bongdaha2-admin-go.service -f
sudo journalctl -u bongdaha2-node.service -f
```

---

## 5. Access URLs

- Node frontend (default):
  - Home: `http://<SERVER_IP>:3000/`
  - Admin panel: `http://<SERVER_IP>:3000/admin-HHrg9404nflfja22f`
- Go backend (default):
  - API: `http://<SERVER_IP>:8080/api/...`

For production, it is recommended to use Nginx as a reverse proxy and enable HTTPS.

---

## 6. Troubleshooting

### 6.1 Node service fails with `FOOTBALL_API_KEY missing in .env`

Cause: `FOOTBALL_API_KEY` is not set in `bongdaha2/.env`.

Fix:

- Add the API key
- Restart service:

```bash
sudo systemctl restart bongdaha2-node.service
```

### 6.2 Browser shows CORS errors

Cause: `CORS_ALLOWED_ORIGINS` does not include your domain.

Fix:

- Add your domain to `CORS_ALLOWED_ORIGINS` in both:
  - `admin-go/.env`
  - `bongdaha2/.env`
- Restart both services:

```bash
sudo systemctl restart bongdaha2-admin-go.service
sudo systemctl restart bongdaha2-node.service
```

### 6.3 Go service fails to connect to MySQL

Cause: wrong DB credentials, network/firewall issues, or MySQL does not allow remote connections.

Fix:

- Verify `DB_*` values in `admin-go/.env`
- Ensure the MySQL server allows connections from this host
- Check logs:

```bash
sudo journalctl -u bongdaha2-admin-go.service -n 200 --no-pager
```

---

## 7. Production Security Recommendations

- Use Nginx + HTTPS (Let’s Encrypt recommended)
- Restrict admin panel access (IP allowlist / basic auth / VPN)
- Keep `JWT_SECRET` private; rotate it immediately if leaked
- Use least-privilege DB accounts
