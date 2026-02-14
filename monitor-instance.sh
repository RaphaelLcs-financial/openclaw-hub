#!/bin/bash

# OpenClaw Hub 监控脚本
# 用途：监控实例状态、性能和健康

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
HUB_URL=${HUB_URL:-"http://localhost:3000"}
LOG_FILE=${LOG_FILE:-"/var/log/openclaw-hub-monitor.log"}
ALERT_EMAIL=${ALERT_EMAIL:-""}

# 日志函数
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 检查健康状态
check_health() {
    log "${BLUE}检查健康状态...${NC}"

    RESPONSE=$(curl -s -w "\n%{http_code}" ${HUB_URL}/health)
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        log "${GREEN}✅ 服务器健康${NC}"
        log "响应: $BODY"

        # 解析 JSON（如果有 jq）
        if command -v jq &> /dev/null; then
            STATUS=$(echo $BODY | jq -r '.status')
            UPTIME=$(echo $BODY | jq -r '.uptime')
            REGISTERED=$(echo $BODY | jq -r '.registered')

            log "状态: $STATUS"
            log "运行时间: ${UPTIME}秒"
            log "注册 Agents: $REGISTERED"
        fi

        return 0
    else
        log "${RED}❌ 服务器不健康 (HTTP $HTTP_CODE)${NC}"
        send_alert "服务器不健康" "HTTP Code: $HTTP_CODE"
        return 1
    fi
}

# 检查响应时间
check_response_time() {
    log "${BLUE}检查响应时间...${NC}"

    START=$(date +%s%N)
    curl -s ${HUB_URL}/health > /dev/null
    END=$(date +%s%N)

    DIFF=$((($END - $START) / 1000000))
    log "响应时间: ${DIFF}ms"

    if [ $DIFF -gt 1000 ]; then
        log "${YELLOW}⚠️  响应时间过长 (>${DIFF}ms)${NC}"
        send_alert "响应时间过长" "响应时间: ${DIFF}ms"
    else
        log "${GREEN}✅ 响应时间正常${NC}"
    fi
}

# 检查内存使用
check_memory() {
    log "${BLUE}检查内存使用...${NC}"

    # 查找 OpenClaw Hub 进程
    PID=$(pgrep -f "node.*openclaw-hub" | head -1)

    if [ -z "$PID" ]; then
        log "${RED}❌ OpenClaw Hub 进程未找到${NC}"
        send_alert "进程未运行" "OpenClaw Hub 进程未找到"
        return 1
    fi

    # 获取内存使用（Linux）
    if command -v ps &> /dev/null; then
        MEM=$(ps -p $PID -o rss= | awk '{printf "%.2f MB", $1/1024}')
        log "内存使用: $MEM"
    fi

    log "${GREEN}✅ 内存检查完成${NC}"
}

# 检查磁盘空间
check_disk() {
    log "${BLUE}检查磁盘空间...${NC}"

    # 检查当前目录磁盘使用
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ $DISK_USAGE -gt 80 ]; then
        log "${YELLOW}⚠️  磁盘使用率过高 (${DISK_USAGE}%)${NC}"
        send_alert "磁盘空间不足" "磁盘使用率: ${DISK_USAGE}%"
    else
        log "${GREEN}✅ 磁盘空间充足 (${DISK_USAGE}%)${NC}"
    fi
}

# 检查数据库大小
check_database() {
    log "${BLUE}检查数据库大小...${NC}"

    # 查找 SQLite 数据库文件
    DB_FILE=$(find . -name "*.db" -type f | head -1)

    if [ -n "$DB_FILE" ]; then
        DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
        log "数据库大小: $DB_SIZE"

        # 如果数据库超过 1GB，发出警告
        DB_SIZE_BYTES=$(stat -f%z "$DB_FILE" 2>/dev/null || stat -c%s "$DB_FILE")
        if [ $DB_SIZE_BYTES -gt 1073741824 ]; then
            log "${YELLOW}⚠️  数据库文件过大 (>${DB_SIZE})${NC}"
            send_alert "数据库过大" "数据库大小: $DB_SIZE"
        else
            log "${GREEN}✅ 数据库大小正常${NC}"
        fi
    else
        log "${YELLOW}⚠️  未找到数据库文件${NC}"
    fi
}

# 检查日志文件
check_logs() {
    log "${BLUE}检查最近日志...${NC}"

    if [ -f "/tmp/openclaw-hub.log" ]; then
        # 检查最近10行日志中的错误
        ERRORS=$(tail -10 /tmp/openclaw-hub.log | grep -i "error" | wc -l)

        if [ $ERRORS -gt 0 ]; then
            log "${YELLOW}⚠️  发现 $ERRORS 个错误${NC}"
            log "最近的错误:"
            tail -10 /tmp/openclaw-hub.log | grep -i "error" | head -3
        else
            log "${GREEN}✅ 未发现错误${NC}"
        fi
    fi
}

# 发送警报
send_alert() {
    local subject="$1"
    local message="$2"

    if [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "OpenClaw Hub Alert: $subject" "$ALERT_EMAIL"
        log "警报已发送到 $ALERT_EMAIL"
    fi
}

# 生成报告
generate_report() {
    log "${GREEN}══════════════════════════════════${NC}"
    log "${GREEN}  OpenClaw Hub 监控报告${NC}"
    log "${GREEN}══════════════════════════════════${NC}"
    log "时间: $(date)"
    log "服务器: $HUB_URL"
    log ""

    check_health
    check_response_time
    check_memory
    check_disk
    check_database
    check_logs

    log ""
    log "${GREEN}══════════════════════════════════${NC}"
    log "${GREEN}  监控完成${NC}"
    log "${GREEN}══════════════════════════════════${NC}"
}

# 主函数
main() {
    case "$1" in
        --once)
            generate_report
            ;;
        --daemon)
            while true; do
                generate_report
                sleep 300  # 每5分钟检查一次
            done
            ;;
        *)
            echo "用法: $0 [--once|--daemon]"
            echo "  --once    检查一次并退出"
            echo "  --daemon  持续监控（每5分钟）"
            exit 1
            ;;
    esac
}

main "$@"
