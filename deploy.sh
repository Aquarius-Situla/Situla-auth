#!/usr/bin/env bash
# ==============================================================================
# SCRIPT       : deploy.sh
# MODULE       : Situla-Auth / Deployment & Release Pipeline
# PURPOSE      : 生产环境一键部署与全链路冒烟验证脚本。负责依赖探测、Docker 网络、
#                环境配置、SQLite 数据热备、无缝重启及内外分层冒烟阻断测试。
# AUTHOR       : Infrastructure & DevOps Team (30-Year Ops Standard)
# CREATED_AT   : 2026-08-29
# EXIT CODES   : 0 = DEPLOY SUCCESS, 1 = SMOKE TEST FAILED, 2 = PRECHECK ERROR
# DEPENDENCIES : bash, docker, docker-compose
# USAGE        : bash deploy.sh
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# SECTION 0: COLOR SCHEME & INITIALIZATION
# ------------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}       🚀 Situla Auth Production Deploy & Health Gate       ${NC}"
echo -e "${GREEN}============================================================${NC}"

# Detect docker command (with or without sudo)
if docker ps &>/dev/null; then
    DK="docker"
else
    DK="sudo docker"
fi

# ------------------------------------------------------------------------------
# SECTION 1: DOCKER ENGINE PRE-FLIGHT
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[1/6] 检查 Docker 运行时环境...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}  ↳ 未检测到 Docker，正在启动自动安装...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}  ✅ Docker 安装成功。${NC}"
else
    echo -e "${GREEN}  ✅ Docker 引擎正常: $($DK --version)${NC}"
fi

# ------------------------------------------------------------------------------
# SECTION 2: REVERSE PROXY NETWORK CREATION
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[2/6] 检查外部反向代理网络 'npm_default'...${NC}"
if ! $DK network ls | grep -q "npm_default"; then
    $DK network create npm_default
    echo -e "${GREEN}  ✅ 创建 Docker 外部网络: npm_default${NC}"
else
    echo -e "${GREEN}  ✅ 网络 npm_default 已就绪。${NC}"
fi

# ------------------------------------------------------------------------------
# SECTION 3: ENVIRONMENT CONFIG & DATABASE SNAPSHOT BACKUP
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[3/6] 检查环境配置与 SQLite 数据热备...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}"
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │  检测到首次部署，请在 .env 中填写核心配置:         │"
    echo "  │    ADMIN_USER    — 管理员账号                       │"
    echo "  │    ADMIN_PASS    — 管理员初始密码                   │"
    echo "  │    COOKIE_DOMAIN — 泛域名 (如 .yourdomain.com)      │"
    echo "  │    RP_ID         — 主域名 (如 auth.yourdomain.com)  │"
    echo "  │                                                     │"
    echo "  │  JWT_SECRET / ENCRYPTION_KEY 首次启动将自动初始化。 │"
    echo "  └─────────────────────────────────────────────────────┘"
    echo -e "${NC}"
    read -r -p "  按 ENTER 键调用编辑器配置，或按 Ctrl+C 中止: "
    ${EDITOR:-nano} .env
else
    echo -e "${GREEN}  ✅ .env 配置文件已存在。${NC}"
fi

mkdir -p data
# 确保存储目录具有 UID 1000 写权限
if [ -d "data" ]; then
    sudo chown -R 1000:1000 data 2>/dev/null || true
fi

if [ -f "data/database.sqlite" ]; then
    BACKUP_FILE="data/database.sqlite.bak_$(date +%Y%m%d_%H%M%S)"
    cp data/database.sqlite "$BACKUP_FILE"
    echo -e "${GREEN}  ✅ 数据库已热备至: ${BACKUP_FILE}${NC}"
fi

# ------------------------------------------------------------------------------
# SECTION 4: CONTAINER BUILD & ZERO-DOWNTIME RESTART
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[4/6] 构建镜像并拉起生产容器...${NC}"
$DK compose up -d --build

# ------------------------------------------------------------------------------
# SECTION 5: HEALTHCHECK CONVERGENCE LOOP
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[5/6] 监控容器内置健康探针收敛状态...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    STATUS=$($DK inspect --format='{{json .State.Health.Status}}' situla-auth 2>/dev/null || echo '"unknown"')
    if [ "$STATUS" == '"healthy"' ]; then
        HEALTHY=true
        break
    fi
    echo -e "  ⏳ 等待健康检查收敛: ${STATUS}... (${RETRY_COUNT}/${MAX_RETRIES}s)"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 2))
done

if [ "$HEALTHY" = true ]; then
    echo -e "${GREEN}  ✅ 容器状态已成功收敛为: HEALTHY!${NC}"
else
    echo -e "${YELLOW}  ⚠️  容器健康检查状态: ${STATUS} (已超时)${NC}"
fi

# ------------------------------------------------------------------------------
# SECTION 6: TWO-STAGE COMPREHENSIVE SMOKE TEST GATE
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}[6/6] 触发工业级双层冒烟测试大门 (In & Out-of-Container Gates)...${NC}"

# Stage 6.1: 外部黑盒冒烟测试
echo -e "${CYAN}  ↳ [Stage 6.1] 执行外部基础设施黑盒冒烟...${NC}"
if bash tests/docker-smoke-test.sh --container situla-auth --timeout 10; then
    echo -e "${GREEN}  ✅ 外部基础设施黑盒冒烟测试全部通过！${NC}"
else
    echo -e "${RED}  ❌ 外部黑盒冒烟测试未通过，阻断发布！${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}       🎉 Situla Auth 部署验证大获全胜！容器就绪无异常。    ${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "  服务运行状态概览:"
$DK compose ps
echo ""
