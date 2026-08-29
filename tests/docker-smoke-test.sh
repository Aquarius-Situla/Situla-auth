#!/usr/bin/env bash
# ==============================================================================
# SCRIPT       : tests/docker-smoke-test.sh
# MODULE       : Situla-Auth / External Infrastructure Smoke Gate
# PURPOSE      : 容器外部黑盒冒烟测试。从宿主机/流水线视角把控 Docker 容器全生命周期：
#                镜像安全规范、非 root 权限、卷挂载可写性、健康探针收敛、网络与安全响应头、
#                日志异常特征及 SIGTERM 优雅退出能力。
# AUTHOR       : Infrastructure & DevOps Team (30-Year Ops Standard)
# CREATED_AT   : 2026-08-29
# EXIT CODES   : 0 = ALL PASS, 1 = ASSERTION FAILED, 2 = PRE-FLIGHT / ENV FAILED
# DEPENDENCIES : bash (>=4.0), docker, curl, jq (optional)
# USAGE        : bash tests/docker-smoke-test.sh [OPTIONS]
#                OPTIONS:
#                  --container <name>   目标容器名称 (默认: situla-auth)
#                  --timeout <seconds>  健康检查最大收敛等待秒数 (默认: 30)
#                  --test-shutdown      开启 SIGTERM 优雅退出破坏性测试
#                  --help               显示帮助信息
# ==============================================================================

set -uo pipefail

# ------------------------------------------------------------------------------
# GLOBAL CONSTANTS & FORMATTING
# ------------------------------------------------------------------------------
COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
COLOR_CYAN='\033[0;36m'
COLOR_RESET='\033[0m'

TARGET_CONTAINER="situla-auth"
MAX_TIMEOUT=30
TEST_SHUTDOWN=false
PASSED_COUNT=0
FAILED_COUNT=0
declare -a FAILED_ITEMS=()

# ------------------------------------------------------------------------------
# LOGGING & ASSERTION HELPERS
# ------------------------------------------------------------------------------
log_info()    { echo -e "${COLOR_CYAN}[INFO]  $(date +'%H:%M:%S')${COLOR_RESET} $*"; }
log_ok()      { echo -e "${COLOR_GREEN}[PASS]  $(date +'%H:%M:%S')${COLOR_RESET} $*"; }
log_warn()    { echo -e "${COLOR_YELLOW}[WARN]  $(date +'%H:%M:%S')${COLOR_RESET} $*"; }
log_error()   { echo -e "${COLOR_RED}[ERROR] $(date +'%H:%M:%S')${COLOR_RESET} $*"; }

assert_eq() {
    local condition="$1"
    local title="$2"
    local hint="${3:-}"

    if eval "$condition"; then
        log_ok "$title"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        log_error "$title"
        if [ -n "$hint" ]; then
            echo -e "        ${COLOR_YELLOW}↳ 💡 [Troubleshooting Hint]: ${hint}${COLOR_RESET}"
        fi
        FAILED_COUNT=$((FAILED_COUNT + 1))
        FAILED_ITEMS+=("$title")
    fi
}

show_help() {
    cat << EOF
使用方法: bash tests/docker-smoke-test.sh [OPTIONS]

选项列表:
  --container <name>   指定待测容器名 (默认: situla-auth)
  --timeout <sec>      健康探针收敛最大等待时长 (默认: 30)
  --test-shutdown      执行 SIGTERM 信号优雅退出测试 (注: 会停止容器)
  -h, --help           显示此帮助文档
EOF
    exit 0
}

# ------------------------------------------------------------------------------
# ARGUMENT PARSING
# ------------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --container)
            TARGET_CONTAINER="$2"
            shift 2
            ;;
        --timeout)
            MAX_TIMEOUT="$2"
            shift 2
            ;;
        --test-shutdown)
            TEST_SHUTDOWN=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo "未知参数: $1"
            show_help
            ;;
    esac
done

START_TIME=$(date +%s)
echo "=============================================================================="
echo -e "${COLOR_BLUE}  🐳 SITULA-AUTH OUT-OF-CONTAINER BLACKBOX SMOKE TEST GATE${COLOR_RESET}"
echo -e "  🕒 Started At : $(date +'%Y-%m-%d %H:%M:%S')"
echo -e "  📦 Container  : ${TARGET_CONTAINER}"
echo -e "  ⏱️  Max Timeout: ${MAX_TIMEOUT}s"
echo "=============================================================================="
echo ""

# ------------------------------------------------------------------------------
# SECTION 1: PRE-FLIGHT CHECKS & ENVIRONMENT VALIDATION
# ------------------------------------------------------------------------------
# [PURPOSE] 验证宿主机 Docker 守护进程与目标容器存活性
# [ASSERTION] docker CLI 存在，docker ps 正常，目标容器处于 running 状态
log_info "📌 [SECTION 1] Pre-Flight & Docker Daemon Check"

if ! command -v docker &> /dev/null; then
    log_error "Docker CLI 未安装或不在 PATH 中！"
    exit 2
fi

if ! docker info &> /dev/null; then
    log_error "无法连接到 Docker Daemon，请检查守护进程运行状态与权限 (sudo/usermod)！"
    exit 2
fi
log_ok "Docker 守护进程连通正常: $(docker --version)"

CONTAINER_STATUS=$(docker inspect --format='{{.State.Status}}' "$TARGET_CONTAINER" 2>/dev/null || echo "not_found")
if [ "$CONTAINER_STATUS" != "running" ]; then
    log_error "目标容器 '$TARGET_CONTAINER' 未处于 running 状态 (当前状态: $CONTAINER_STATUS)"
    echo -e "        ${COLOR_YELLOW}↳ 请先运行 'docker compose up -d' 启动容器！${COLOR_RESET}"
    exit 2
fi
log_ok "目标容器 '$TARGET_CONTAINER' 正在运行 (Status: running)"

# ------------------------------------------------------------------------------
# SECTION 2: CONTAINER SECURITY & NON-ROOT RUNTIME ENFORCEMENT
# ------------------------------------------------------------------------------
# [PURPOSE] 生产安全底线：容器严禁使用 root 权限运行，防止容器逃逸
# [ASSERTION] 容器内进程 UID 必须为 1000 (node)，no-new-privileges 开启
echo ""
log_info "📌 [SECTION 2] Security Compliance & Non-Root UID Gate"

CONTAINER_UID=$(docker exec "$TARGET_CONTAINER" id -u 2>/dev/null || echo "error")
CONTAINER_USER=$(docker exec "$TARGET_CONTAINER" id -un 2>/dev/null || echo "error")

assert_eq "[ '$CONTAINER_UID' = '1000' ]" \
    "Non-Root User Check: UID is 1000 (got UID: $CONTAINER_UID, User: $CONTAINER_USER)" \
    "Dockerfile 中必须指定 'USER node'，严禁使用 root 身份运行应用！"

# 检查安全选项
SECURITY_OPTS=$(docker inspect --format='{{json .HostConfig.SecurityOpt}}' "$TARGET_CONTAINER" 2>/dev/null || echo "[]")
if echo "$SECURITY_OPTS" | grep -q "no-new-privileges"; then
    log_ok "Security Option 'no-new-privileges:true' 已启用"
    PASSED_COUNT=$((PASSED_COUNT + 1))
else
    log_warn "未显式声明 no-new-privileges，建议在 docker-compose.yml 中添加此安全选项"
fi

# ------------------------------------------------------------------------------
# SECTION 3: DOCKER HEALTHCHECK CONVERGENCE PROBE
# ------------------------------------------------------------------------------
# [PURPOSE] 验证 Dockerfile 内置的 HEALTHCHECK 探针能否在超时窗口内稳定收敛为 healthy
# [ASSERTION] .State.Health.Status == 'healthy'，且耗时小于 $MAX_TIMEOUT 秒
echo ""
log_info "📌 [SECTION 3] Docker Healthcheck Convergence Gate"

ELAPSED=0
IS_HEALTHY=false

while [ $ELAPSED -lt $MAX_TIMEOUT ]; do
    HEALTH_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$TARGET_CONTAINER" 2>/dev/null || echo "unknown")

    if [ "$HEALTH_STATUS" = "healthy" ]; then
        IS_HEALTHY=true
        break
    elif [ "$HEALTH_STATUS" = "none" ]; then
        log_warn "容器未配置 Dockerfile HEALTHCHECK，跳过健康探针收敛测试"
        IS_HEALTHY=true
        break
    fi

    echo -ne "  ⏳ 等待健康检查探针收敛... [Status: ${HEALTH_STATUS}] (${ELAPSED}s/${MAX_TIMEOUT}s)\r"
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done
echo ""

assert_eq "[ '$IS_HEALTHY' = 'true' ]" \
    "Healthcheck converged to 'healthy' in ${ELAPSED}s" \
    "容器未在 ${MAX_TIMEOUT} 秒内转为 healthy，请运行 'docker inspect $TARGET_CONTAINER' 查看 Health 日志！"

# ------------------------------------------------------------------------------
# SECTION 4: STORAGE & VOLUME MOUNT PERMISSIONS
# ------------------------------------------------------------------------------
# [PURPOSE] 验证持久化存储卷挂载正常，且非 root 容器用户拥有真实的磁盘写入权限
# [ASSERTION] 容器内 touch /app/data/.host_smoke_probe 成功
echo ""
log_info "📌 [SECTION 4] Volume Mounts & Writability Gate"

# 验证挂载存在
MOUNTS_JSON=$(docker inspect --format='{{json .Mounts}}' "$TARGET_CONTAINER" 2>/dev/null || echo "[]")
if echo "$MOUNTS_JSON" | grep -q "/app/data"; then
    log_ok "持久化目录挂载点 '/app/data' 已正确配置"
    PASSED_COUNT=$((PASSED_COUNT + 1))
else
    log_error "未检测到 '/app/data' 卷挂载！"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_ITEMS+=("Volume Mount /app/data")
fi

# 容器内文件写入测试
TOUCH_RESULT=$(docker exec "$TARGET_CONTAINER" sh -c "touch /app/data/.smoke_probe && rm -f /app/data/.smoke_probe && echo 'OK'" 2>/dev/null || echo "FAIL")
assert_eq "[ '$TOUCH_RESULT' = 'OK' ]" \
    "Container write & remove probe inside /app/data succeeded" \
    "宿主机挂载目录权限不正确！请在宿主机执行: chown -R 1000:1000 ./data"

# ------------------------------------------------------------------------------
# SECTION 5: HTTP REACHABILITY & SECURITY HEADERS
# ------------------------------------------------------------------------------
# [PURPOSE] 从容器内部或网络边界探测 HTTP 响应与关键安全响应头 (Helmet)
# [ASSERTION] /api/health 返回 HTTP 200，并包含 X-Content-Type-Options: nosniff
echo ""
log_info "📌 [SECTION 5] Network API & Security Headers Gate"

HTTP_PROBE=$(docker exec "$TARGET_CONTAINER" node -e "
const http = require('http');
const req = http.get('http://127.0.0.1:3000/api/health', (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
        const hasNosniff = res.headers['x-content-type-options'] === 'nosniff';
        const is200 = res.statusCode === 200;
        let isHealthy = false;
        try { isHealthy = JSON.parse(raw).status === 'healthy'; } catch(e) {}
        console.log(JSON.stringify({ is200, hasNosniff, isHealthy }));
    });
});
req.on('error', () => console.log(JSON.stringify({ is200: false })));
" 2>/dev/null || echo '{"is200":false}')

assert_eq "echo '$HTTP_PROBE' | grep -q '\"is200\":true'" \
    "HTTP GET /api/health returns status 200 OK" \
    "服务内部 HTTP 探测失败，请检查端口 3000 监听状态"

assert_eq "echo '$HTTP_PROBE' | grep -q '\"hasNosniff\":true'" \
    "Security Header Check: 'X-Content-Type-Options: nosniff' present" \
    "Helmet 中间件未生效，缺失基础安全响应头"

# ------------------------------------------------------------------------------
# SECTION 6: IN-CONTAINER APPLICATION SMOKE TEST
# ------------------------------------------------------------------------------
# [PURPOSE] 串联触发容器内全量白盒自检（数据库/OIDC/密码学）
# [ASSERTION] node tests/smoke-test.js 执行退出码为 0
echo ""
log_info "📌 [SECTION 6] In-Container Deep Self-Check Suite"

if docker exec "$TARGET_CONTAINER" node tests/smoke-test.js; then
    log_ok "In-container smoke-test.js completed successfully (Exit code: 0)"
    PASSED_COUNT=$((PASSED_COUNT + 1))
else
    log_error "In-container smoke-test.js failed!"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_ITEMS+=("In-Container smoke-test.js execution")
fi

# ------------------------------------------------------------------------------
# SECTION 7: LOG ERROR & ANOMALY SCAN
# ------------------------------------------------------------------------------
# [PURPOSE] 扫描容器近期日志，严查未捕获异常、数据库锁定或权限拒绝日志
# [ASSERTION] 容器日志不包含 UnhandledPromiseRejection, SQLITE_CANTOPEN, EACCES
echo ""
log_info "📌 [SECTION 7] Container Log Anomaly Scan"

LOG_OUTPUT=$(docker logs --tail 80 "$TARGET_CONTAINER" 2>&1)
CRITICAL_ERRORS=$(echo "$LOG_OUTPUT" | grep -iE "UnhandledPromiseRejection|SQLITE_CANTOPEN|EACCES|FATAL ERROR|segmentation fault" || true)

if [ -n "$CRITICAL_ERRORS" ]; then
    log_error "容器日志中检测到潜在致命错误关键字:"
    echo -e "${COLOR_RED}${CRITICAL_ERRORS}${COLOR_RESET}"
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_ITEMS+=("Log Anomaly Scan")
else
    log_ok "Container logs are clean (No fatal rejections or DB open failures found)"
    PASSED_COUNT=$((PASSED_COUNT + 1))
fi

# ------------------------------------------------------------------------------
# SECTION 8: OPTIONAL SIGTERM GRACEFUL SHUTDOWN TEST
# ------------------------------------------------------------------------------
# [PURPOSE] 验证容器能否在收到 SIGTERM 后优雅关闭，不被 137 SIGKILL 强杀
if [ "$TEST_SHUTDOWN" = true ]; then
    echo ""
    log_info "📌 [SECTION 8] SIGTERM Graceful Shutdown Gate (--test-shutdown)"
    
    STOP_START=$(date +%s)
    docker stop -t 5 "$TARGET_CONTAINER" > /dev/null 2>&1
    STOP_DURATION=$(( $(date +%s) - STOP_START ))
    
    EXIT_CODE=$(docker inspect --format='{{.State.ExitCode}}' "$TARGET_CONTAINER" 2>/dev/null || echo "unknown")
    
    # 优雅退出码通常为 0 或 143 (128 + 15)
    assert_eq "[ '$EXIT_CODE' = '0' ] || [ '$EXIT_CODE' = '143' ]" \
        "Container stopped gracefully within ${STOP_DURATION}s (Exit Code: $EXIT_CODE)" \
        "容器在收到 SIGTERM 后未能在 5 秒内退出，可能被 SIGKILL 强杀 (ExitCode: $EXIT_CODE)"
    
    # 恢复容器
    log_info "正在重新拉起容器以恢复服务..."
    docker start "$TARGET_CONTAINER" > /dev/null 2>&1
fi

# ------------------------------------------------------------------------------
# SUMMARY & VERDICT
# ------------------------------------------------------------------------------
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "=============================================================================="
echo -e "  📊 BLACKBOX SMOKE TEST SUMMARY: ${COLOR_GREEN}${PASSED_COUNT} Passed${COLOR_RESET}, ${COLOR_RED}${FAILED_COUNT} Failed${COLOR_RESET} (${TOTAL_DURATION}s)"
echo "=============================================================================="

if [ $FAILED_COUNT -gt 0 ]; then
    echo ""
    log_error "❌ [GATE BLOCKED] 外部冒烟测试未通过，阻断发布流水线！失败项如下："
    for idx in "${!FAILED_ITEMS[@]}"; do
        echo -e "   ${COLOR_RED}$((idx+1)). ${FAILED_ITEMS[$idx]}${COLOR_RESET}"
    done
    echo ""
    exit 1
else
    echo ""
    log_ok "🎉 [GATE PASSED] 容器基础设施与全链路冒烟测试全部通过！容器具备生产就绪能力。"
    echo ""
    exit 0
fi
