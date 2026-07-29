#!/bin/bash
# =============================================================
# Situla Auth — One-click deploy script for a fresh VPS
# Usage: bash deploy.sh
# Requires: Ubuntu/Debian with sudo access
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Situla Auth Deploy Script ===${NC}"

# ── 1. Install Docker if missing ─────────────────────────────
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[1/5] Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}Docker installed.${NC}"
else
    echo -e "${GREEN}[1/5] Docker already installed: $(docker --version)${NC}"
fi

# ── 2. Create external network if missing ────────────────────
echo -e "${YELLOW}[2/5] Checking Docker network 'npm_default'...${NC}"
if ! docker network ls | grep -q "npm_default"; then
    docker network create npm_default
    echo -e "${GREEN}Created network: npm_default${NC}"
else
    echo -e "${GREEN}Network npm_default already exists.${NC}"
fi

# ── 3. Setup .env ─────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Setting up environment variables...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${RED}"
    echo "  ┌──────────────────────────────────────────────────┐"
    echo "  │  IMPORTANT: Please edit .env before continuing!  │"
    echo "  │  Fill in: ADMIN_USER, ADMIN_PASS, JWT_SECRET,    │"
    echo "  │           COOKIE_DOMAIN, RP_ID                   │"
    echo "  └──────────────────────────────────────────────────┘"
    echo -e "${NC}"
    read -r -p "  Press ENTER to open nano, or Ctrl+C to exit and edit manually: "
    nano .env
else
    echo -e "${GREEN}.env already exists, skipping.${NC}"
fi

# ── 4. Build and start containers ────────────────────────────
echo -e "${YELLOW}[4/5] Building and starting containers...${NC}"
docker compose up -d --build

# ── 5. Status check ───────────────────────────────────────────
echo -e "${YELLOW}[5/5] Checking container status...${NC}"
sleep 3
docker compose ps

echo ""
echo -e "${GREEN}✅ Deploy complete!${NC}"
echo ""
echo "  Next steps:"
echo "  - Point your reverse proxy (e.g. Nginx Proxy Manager) to port 3000"
echo "    of the situla-auth container"
echo "  - Set Forward Auth URL to: http://situla-auth:3000/verify"
echo ""
