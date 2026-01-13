# 客户部署文档（Bongdaha2）

本文档面向客户/运维人员，用于在一台全新 Linux 服务器上部署并启动 Bongdaha2（Go 后端 + Node 服务静态前端），并使用 systemd 进行进程守护与开机自启。

---

## 1. 系统要求

- 操作系统：Ubuntu / Debian（推荐 Ubuntu 22.04/24.04）
- 权限：具备 sudo 权限（部署脚本需要写入 systemd 服务）
- 网络：服务器可访问外网（用于安装依赖、访问 Football API）
- 数据库：MySQL（客户自行准备，确保服务器能连通）

---

## 2. 目录说明

部署目录（示例）：

- 项目根目录：`/home/ubuntu/bongdaha2-main/`
- Go 后端：`admin-go/`
- Node 服务（提供静态前端与部分接口代理）：`bongdaha2/`
- 一键部署脚本：`deploy.sh`

---

## 3. 一键部署（推荐）

### 3.1 准备环境文件（必须）

进入项目根目录后，创建并填写 2 个环境文件：

```bash
cp admin-go/.env.example admin-go/.env
cp bongdaha2/.env.example bongdaha2/.env
```

然后用编辑器打开并填写。

---

### 3.2 配置说明

#### A) `admin-go/.env`（Go 后端）

- `DB_HOST`：MySQL 地址
- `DB_PORT`：MySQL 端口（默认 3306）
- `DB_NAME`：数据库名
- `DB_USER`：用户名
- `DB_PASSWORD`：密码
- `PORT`：Go 后端端口（建议 8080）
- `GIN_MODE`：建议生产环境填 `release`
- `JWT_SECRET`：JWT 秘钥（可留空，脚本会自动生成并写入）

示例：

```env
PORT=8080
GIN_MODE=release
CORS_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000
```

#### B) `bongdaha2/.env`（Node 服务）

- `PORT`：Node 服务端口（建议 3000）
- `FOOTBALL_API_KEY`：Football API Key（必填，不填会无法启动）
- `ADMIN_API_URL`：Go 后端地址，例如 `http://127.0.0.1:8080`
- `FRONTEND_DOMAIN`：站点域名，例如 `https://your-domain.com`
- `CORS_ALLOWED_ORIGINS`：允许跨域的来源（逗号分隔）

说明：

- `ADMIN_API_URL` 只是“Go 后端地址”，不是跨域配置。
- 浏览器是否跨域，取决于**被请求的服务**是否返回允许的 CORS 响应头：
  - 如果前端页面在 `https://b.xxx.com`，而 `ADMIN_API_URL=https://api.xxx.com`，那么跨域发生在 **Go 后端**，需要在 `admin-go/.env` 配置 `CORS_ALLOWED_ORIGINS` 包含 `https://b.xxx.com`。
  - `bongdaha2/.env` 的 `CORS_ALLOWED_ORIGINS` 只影响 Node 服务自己的接口（例如 `/api/config` 等）是否允许被其它域名跨域访问；如果你的站点全部从同一域名访问 Node（同源），这项可不填，但建议生产环境也填上以保持一致。

示例：

```env
PORT=3000
FOOTBALL_API_KEY=xxxxxxxxxxxxxxxx
ADMIN_API_URL=http://127.0.0.1:8080
FRONTEND_DOMAIN=https://your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,http://localhost:3000
```

---

### 3.3 执行一键部署脚本

在项目根目录执行：

```bash
bash ./deploy.sh --install-deps
```

说明：

- `--install-deps` 会自动安装缺失依赖（Ubuntu/Debian apt）：Go、Node/npm、openssl 等。
- 脚本会：
  - 编译 Go 后端
  - 安装 Node 依赖（如果 node_modules 不存在）
  - 写入并启动 systemd 服务（并设置开机自启）

如果需要强制重新安装 Node 依赖（排查依赖问题时使用）：

```bash
bash ./deploy.sh --install-deps --force-npm-install
```

---

## 4. 服务管理（systemd）

部署完成后会有两个 systemd 服务：

- `bongdaha2-admin-go.service`（Go 后端）
- `bongdaha2-node.service`（Node 服务/前端）

常用命令：

### 4.1 查看状态

```bash
sudo systemctl status bongdaha2-admin-go.service --no-pager
sudo systemctl status bongdaha2-node.service --no-pager
```

### 4.2 启停/重启

```bash
sudo systemctl restart bongdaha2-admin-go.service
sudo systemctl restart bongdaha2-node.service

sudo systemctl stop bongdaha2-admin-go.service
sudo systemctl stop bongdaha2-node.service

sudo systemctl start bongdaha2-admin-go.service
sudo systemctl start bongdaha2-node.service
```

### 4.3 查看日志

```bash
sudo journalctl -u bongdaha2-admin-go.service -f
sudo journalctl -u bongdaha2-node.service -f
```

---

## 5. 访问地址

- Node 前端入口（默认）：
  - 首页：`http://<服务器IP>:3000/`
  - 管理后台：`http://<服务器IP>:3000/admin-HHrg9404nflfja22f`
- Go 后端（默认）：
  - API：`http://<服务器IP>:8080/api/...`

注意：生产环境建议使用 Nginx 做反向代理并配置 HTTPS。

---

## 6. 常见问题排查

### 6.1 Node 服务启动失败：提示 `FOOTBALL_API_KEY missing in .env`

原因：`bongdaha2/.env` 未填写 `FOOTBALL_API_KEY`。

处理：补上 API Key 后重启服务：

```bash
sudo systemctl restart bongdaha2-node.service
```

### 6.2 前端请求后端提示跨域（CORS）

原因：`CORS_ALLOWED_ORIGINS` 未包含你的站点域名。

处理：

- 同时在 `admin-go/.env` 与 `bongdaha2/.env` 中添加站点域名
- 然后重启两个服务

```bash
sudo systemctl restart bongdaha2-admin-go.service
sudo systemctl restart bongdaha2-node.service
```

### 6.3 Go 服务启动失败：数据库连接失败

原因：数据库地址/用户名/密码/库名不正确，或防火墙/安全组未放行。

处理：

- 检查 `admin-go/.env` 的 `DB_*` 配置
- 确保 MySQL 允许来自该服务器的连接
- 查看日志定位：

```bash
sudo journalctl -u bongdaha2-admin-go.service -n 200 --no-pager
```

---

## 7. 安全建议（生产环境）

- 建议使用 Nginx 配置 HTTPS（证书可用 Let’s Encrypt）
- 建议将管理后台路径做额外限制（IP 白名单/基础认证等）
- `JWT_SECRET` 请勿泄露，泄露需要立即更换并让所有登录失效
- 数据库账号建议最小权限原则
