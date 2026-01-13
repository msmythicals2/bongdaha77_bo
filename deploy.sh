#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_DIR="$ROOT_DIR/admin-go"
NODE_DIR="$ROOT_DIR/bongdaha2"

ADMIN_ENV="$ADMIN_DIR/.env"
NODE_ENV_FILE="$NODE_DIR/.env"

ADMIN_BIN_DIR="$ADMIN_DIR/bin"
ADMIN_BIN="$ADMIN_BIN_DIR/admin-go"

SERVICE_DIR="/etc/systemd/system"
ADMIN_SERVICE_NAME="bongdaha2-admin-go.service"
NODE_SERVICE_NAME="bongdaha2-node.service"

INSTALL_DEPS=0
FORCE_NPM_INSTALL=0

usage() {
  cat <<EOF
Usage: bash ./deploy.sh [--install-deps] [--force-npm-install]

  --install-deps       Install missing dependencies (Ubuntu/Debian via apt)
  --force-npm-install  Always run npm install even if node_modules exists
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

is_debian_like() {
  [[ -f /etc/debian_version ]]
}

install_deps_apt() {
  if ! is_debian_like; then
    echo "--install-deps is only supported on Debian/Ubuntu (apt)." >&2
    exit 1
  fi

  local pkgs=(openssl ca-certificates)

  if ! has_cmd go; then
    pkgs+=(golang-go)
  fi
  if ! has_cmd node; then
    pkgs+=(nodejs)
  fi
  if ! has_cmd npm; then
    pkgs+=(npm)
  fi

  if [[ ${#pkgs[@]} -eq 0 ]]; then
    return 0
  fi

  echo "Installing dependencies via apt: ${pkgs[*]}" >&2
  run_sudo apt-get update
  run_sudo apt-get install -y "${pkgs[@]}"
}

run_sudo() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

require_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "Missing file: $f" >&2
    echo "Create it first (copy from .env.example) and fill required values." >&2
    exit 1
  fi
}

ensure_jwt_secret() {
  if ! grep -qE '^JWT_SECRET=' "$ADMIN_ENV"; then
    echo "JWT_SECRET not found in $ADMIN_ENV; generating one..." >&2
    local secret
    secret="$(openssl rand -hex 32)"
    printf '\nJWT_SECRET=%s\n' "$secret" >> "$ADMIN_ENV"
  fi
}

validate_env_minimum() {
  if ! grep -qE '^FOOTBALL_API_KEY=' "$NODE_ENV_FILE"; then
    echo "FOOTBALL_API_KEY missing in $NODE_ENV_FILE" >&2
    exit 1
  fi
}

write_systemd_units() {
  local node_bin
  node_bin="$(command -v node)"

  local admin_unit_path="$SERVICE_DIR/$ADMIN_SERVICE_NAME"
  local node_unit_path="$SERVICE_DIR/$NODE_SERVICE_NAME"

  run_sudo bash -c "cat > '$admin_unit_path'" <<EOF
[Unit]
Description=Bongdaha2 Admin Go API
After=network.target

[Service]
Type=simple
WorkingDirectory=$ADMIN_DIR
EnvironmentFile=$ADMIN_ENV
ExecStart=$ADMIN_BIN
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  run_sudo bash -c "cat > '$node_unit_path'" <<EOF
[Unit]
Description=Bongdaha2 Node Frontend Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$NODE_DIR
EnvironmentFile=$NODE_ENV_FILE
ExecStart=$node_bin $NODE_DIR/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  run_sudo systemctl daemon-reload
}

build_admin_go() {
  need_cmd go
  mkdir -p "$ADMIN_BIN_DIR"
  (cd "$ADMIN_DIR" && go build -o "$ADMIN_BIN" ./)
}

install_node_deps() {
  need_cmd npm
  if [[ "$FORCE_NPM_INSTALL" -eq 1 ]]; then
    (cd "$NODE_DIR" && npm install)
    return
  fi
  if [[ ! -d "$NODE_DIR/node_modules" ]]; then
    (cd "$NODE_DIR" && npm install)
  fi
}

start_services() {
  run_sudo systemctl enable --now "$ADMIN_SERVICE_NAME"
  run_sudo systemctl enable --now "$NODE_SERVICE_NAME"
}

print_next_steps() {
  echo ""
  echo "Services status:"
  echo "  sudo systemctl status $ADMIN_SERVICE_NAME --no-pager"
  echo "  sudo systemctl status $NODE_SERVICE_NAME --no-pager"
  echo ""
  echo "Logs:"
  echo "  sudo journalctl -u $ADMIN_SERVICE_NAME -f"
  echo "  sudo journalctl -u $NODE_SERVICE_NAME -f"
  echo ""
  echo "Important env vars:"
  echo "  - admin-go/.env: DB_*, PORT, JWT_SECRET, CORS_ALLOWED_ORIGINS"
  echo "  - bongdaha2/.env: PORT, FOOTBALL_API_KEY, ADMIN_API_URL, FRONTEND_DOMAIN, CORS_ALLOWED_ORIGINS"
}

main() {
  while [[ ${#@} -gt 0 ]]; do
    case "$1" in
      --install-deps)
        INSTALL_DEPS=1
        shift
        ;;
      --force-npm-install)
        FORCE_NPM_INSTALL=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown argument: $1" >&2
        usage
        exit 1
        ;;
    esac
  done

  if [[ "$INSTALL_DEPS" -eq 1 ]]; then
    install_deps_apt
  fi

  need_cmd openssl

  require_file "$ADMIN_ENV"
  require_file "$NODE_ENV_FILE"

  ensure_jwt_secret
  validate_env_minimum

  need_cmd go
  (cd "$ADMIN_DIR" && go mod download)
  build_admin_go
  install_node_deps
  write_systemd_units
  start_services
  print_next_steps
}

main "$@"
