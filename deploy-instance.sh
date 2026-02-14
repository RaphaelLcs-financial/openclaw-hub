#!/bin/bash

# OpenClaw Hub Instance Deployment Script
# 用途：为每个客户自动部署独立的 OpenClaw Hub 实例

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的工具
check_prerequisites() {
    print_info "检查必要的工具..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        exit 1
    fi

    print_info "✅ 所有工具已就绪"
}

# 创建新的实例目录
create_instance_directory() {
    local instance_name=$1
    local instance_dir="instances/$instance_name"

    print_info "创建实例目录: $instance_dir"

    if [ -d "$instance_dir" ]; then
        print_error "实例目录已存在: $instance_dir"
        exit 1
    fi

    mkdir -p "$instance_dir"
    mkdir -p "$instance_dir/data"

    print_info "✅ 实例目录创建成功"
}

# 复制 OpenClaw Hub 文件
copy_hub_files() {
    local instance_name=$1
    local instance_dir="instances/$instance_name"

    print_info "复制 OpenClaw Hub 文件..."

    # 复制核心文件
    cp server.js "$instance_dir/"
    cp package.json "$instance_dir/"
    cp prisma.config.ts "$instance_dir/" 2>/dev/null || true
    cp -r prisma "$instance_dir/"
    cp -r node_modules "$instance_dir/" 2>/dev/null || true

    print_info "✅ 文件复制完成"
}

# 配置实例
configure_instance() {
    local instance_name=$1
    local instance_dir="instances/$instance_name"
    local port=$2
    local api_key=$3

    print_info "配置实例..."

    # 创建 .env 文件
    cat > "$instance_dir/.env" << EOF
# OpenClaw Hub Instance: $instance_name
INSTANCE_NAME=$instance_name
PORT=$port
DATABASE_URL="file:./data/$instance_name.db"

# API Key (生成新的)
API_KEY=$api_key

# Server Configuration
NODE_ENV=production
EOF

    print_info "✅ 配置完成"
}

# 生成 API Key
generate_api_key() {
    # 生成 oc-<32-hex> 格式的 API Key
    echo "oc-$(openssl rand -hex 16)"
}

# 初始化数据库
initialize_database() {
    local instance_name=$1
    local instance_dir="instances/$instance_name"

    print_info "初始化数据库..."

    cd "$instance_dir"

    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        print_error ".env 文件不存在"
        cd - > /dev/null
        exit 1
    fi

    # 导出环境变量
    export $(cat .env | grep -v '^#' | xargs)

    # 运行 Prisma 迁移
    npx prisma migrate deploy

    cd - > /dev/null

    print_info "✅ 数据库初始化完成"
}

# 启动实例
start_instance() {
    local instance_name=$1
    local instance_dir="instances/$instance_name"
    local port=$2

    print_info "启动实例..."

    cd "$instance_dir"

    # 使用 PM2 启动（如果可用）
    if command -v pm2 &> /dev/null; then
        pm2 start server.js --name "openclaw-hub-$instance_name"
        print_info "✅ 实例已启动（PM2）"
    else
        # 后台启动
        nohup node server.js > "logs/$instance_name.log" 2>&1 &
        print_info "✅ 实例已启动（后台进程）"
    fi

    cd - > /dev/null
}

# 显示实例信息
show_instance_info() {
    local instance_name=$1
    local port=$2
    local api_key=$3

    echo ""
    echo "=================================="
    echo "🎉 OpenClaw Hub 实例部署成功！"
    echo "=================================="
    echo ""
    echo "实例名称: $instance_name"
    echo "端口: $port"
    echo "API Key: $api_key"
    echo ""
    echo "连接信息:"
    echo "  MQTT: mqtt://localhost:$port"
    echo "  WebSocket: ws://localhost:$port"
    echo "  HTTP API: http://localhost:$port/api"
    echo ""
    echo "数据库位置: instances/$instance_name/data/$instance_name.db"
    echo "日志位置: instances/$instance_name/logs/$instance_name.log"
    echo ""
    echo "管理命令:"
    echo "  停止实例: npm run stop-instance $instance_name"
    echo "  重启实例: npm run restart-instance $instance_name"
    echo "  查看日志: tail -f instances/$instance_name/logs/$instance_name.log"
    echo ""
}

# 主函数
main() {
    local instance_name=$1
    local port=$2

    # 参数验证
    if [ -z "$instance_name" ]; then
        print_error "用法: $0 <instance-name> [port]"
        print_info "示例: $0 customer-1 8081"
        exit 1
    fi

    # 默认端口
    if [ -z "$port" ]; then
        port=8081
    fi

    print_info "开始部署 OpenClaw Hub 实例: $instance_name"
    print_info "端口: $port"

    # 检查前提条件
    check_prerequisites

    # 生成 API Key
    local api_key=$(generate_api_key)

    # 创建实例
    create_instance_directory "$instance_name"
    copy_hub_files "$instance_name"
    configure_instance "$instance_name" "$port" "$api_key"
    initialize_database "$instance_name"

    # 询问是否立即启动
    read -p "是否立即启动实例？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_instance "$instance_name" "$port"
    fi

    # 显示信息
    show_instance_info "$instance_name" "$port" "$api_key"
}

# 运行主函数
main "$@"
