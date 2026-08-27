#!/bin/bash
# =============================================================
# Situla Auth — One-click deploy script for VPS & updates
# Usage: bash deploy.sh
# Requires: Ubuntu/Debian with sudo access
# =============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Situla Auth Deploy & Health Script ===${NC}"

# Detect docker command (with or without sudo)
if docker ps &>/dev/null; then
    DK="docker"
else
    DK="sudo docker"
fi

# ── 1. Check Docker installation ─────────────────────────────
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[1/6] Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}Docker installed.${NC}"
else
    echo -e "${GREEN}[1/6] Docker installed: $($DK --version)${NC}"
fi

# ── 2. Create external network if missing ────────────────────
echo -e "${YELLOW}[2/6] Checking Docker network 'npm_default'...${NC}"
if ! $DK network ls | grep -q "npm_default"; then
    $DK network create npm_default
    echo -e "${GREEN}Created network: npm_default${NC}"
else
    echo -e "${GREEN}Network npm_default already exists.${NC}"
fi

# ── 3. Setup .env & Backup Database ──────────────────────────
echo -e "${YELLOW}[3/6] Checking environment & backing up database...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}"
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │  Please fill in the following fields in .env:       │"
    echo "  │    ADMIN_USER   — your login username               │"
    echo "  │    ADMIN_PASS   — your login password               │"
    echo "  │    COOKIE_DOMAIN — e.g. .yourdomain.com            │"
    echo "  │    RP_ID        — e.g. auth.yourdomain.com         │"
    echo "  │                                                     │"
    echo "  │  JWT_SECRET will be auto-generated on first start.  │"
    echo "  └─────────────────────────────────────────────────────┘"
    echo -e "${NC}"
    read -r -p "  Press ENTER to open nano, or Ctrl+C to edit manually: "
    nano .env
else
    echo -e "${GREEN}.env file present.${NC}"
fi

mkdir -p data
if [ -f "data/database.sqlite" ]; then
    BACKUP_FILE="data/database.sqlite.bak_$(date +%Y%m%d_%H%M%S)"
    cp data/database.sqlite "$BACKUP_FILE"
    echo -e "${GREEN}Database backed up to ${BACKUP_FILE}${NC}"
fi

# ── 4. Build and start containers ────────────────────────────
echo -e "${YELLOW}[4/6] Building and starting containers...${NC}"
$DK compose up -d --build

# ── 5. Healthcheck Waiting Loop ──────────────────────────────
echo -e "${YELLOW}[5/6] Waiting for container to report healthy...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    STATUS=$($DK inspect --format='{{json .State.Health.Status}}' situla-auth 2>/dev/null || echo '"unknown"')
    if [ "$STATUS" == '"healthy"' ]; then
        HEALTHY=true
        break
    fi
    echo -e "  ⏳ Health status: ${STATUS}... (${RETRY_COUNT}/${MAX_RETRIES}s)"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 2))
done

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}✅ Container is HEALTHY!${NC}"
else
    echo -e "${RED}⚠️  Container healthcheck status: ${STATUS}${NC}"
fi

# ── 6. Automated Smoke Test ──────────────────────────────────
echo -e "${YELLOW}[6/6] Running automated container smoke tests...${NC}"
if $DK compose exec -T situla-auth node tests/smoke-test.js; then
    echo -e "${GREEN}✅ All automated smoke tests passed!${NC}"
else
    echo -e "${RED}❌ Smoke tests failed.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}       🎉 Deploy & Verification Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "  Container Status:"
$DK compose ps
echo ""
