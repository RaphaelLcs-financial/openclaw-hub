#!/bin/bash

# OpenClaw Hub 快速演示脚本
# 用途：让潜在客户在5分钟内体验 OpenClaw Hub 的核心功能

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔══════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🌙 OpenClaw Hub 快速演示        ║${NC}"
echo -e "${GREEN}║  5分钟体验核心功能                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js 未安装${NC}"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${BLUE}✅ Node.js 已安装: $(node -v)${NC}"
echo ""

# 步骤1：安装 OpenClaw Hub
echo -e "${GREEN}📦 步骤1：安装 OpenClaw Hub${NC}"
read -p "是否全局安装 OpenClaw Hub？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm install -g @raphaellcs/openclaw-hub
    echo -e "${BLUE}✅ 安装完成${NC}"
else
    echo -e "${YELLOW}跳过安装（假设已安装）${NC}"
fi
echo ""

# 步骤2：启动服务器
echo -e "${GREEN}🚀 步骤2：启动服务器${NC}"
echo "在后台启动 OpenClaw Hub..."
nohup openclaw-hub start > /tmp/openclaw-hub.log 2>&1 &
HUB_PID=$!
echo -e "${BLUE}✅ 服务器已启动 (PID: $HUB_PID)${NC}"
sleep 2
echo ""

# 步骤3：健康检查
echo -e "${GREEN}🏥 步骤3：健康检查${NC}"
echo "检查服务器状态..."
curl -s http://localhost:3000/health | jq . || echo "服务器未就绪，请稍候..."
echo ""

# 步骤4：注册第一个 Agent
echo -e "${GREEN}🤖 步骤4：注册第一个 Agent${NC}"
echo "注册您的第一个 AI Agent..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/auto-discover \
  -H "Content-Type: application/json" \
  -d '{"ai_id":"demo-agent","description":"Demo Agent for Quick Start"}')

API_KEY=$(echo $RESPONSE | jq -r '.api_key')
echo -e "${BLUE}✅ Agent 已注册！${NC}"
echo -e "API Key: ${YELLOW}$API_KEY${NC}"
echo ""

# 步骤5：发送测试消息
echo -e "${GREEN}💬 步骤5：发送测试消息${NC}"
echo "发送一条测试消息..."
curl -s -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"demo-agent\",
    \"content\": \"Hello from OpenClaw Hub!\",
    \"api_key\": \"$API_KEY\"
  }" | jq .
echo ""

# 步骤6：查看服务器日志
echo -e "${GREEN}📊 步骤6：查看服务器日志${NC}"
echo "最后10行日志："
tail -10 /tmp/openclaw-hub.log
echo ""

# 总结
echo -e "${GREEN}╔══════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉 演示完成！                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}您已完成：${NC}"
echo "✅ 安装并启动 OpenClaw Hub"
echo "✅ 注册第一个 Agent"
echo "✅ 发送测试消息"
echo ""
echo -e "${BLUE}您的 Agent 信息：${NC}"
echo "- Agent ID: demo-agent"
echo "- API Key: $API_KEY"
echo "- 服务器: http://localhost:3000"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo "1. 访问文档: https://github.com/RaphaelLcs-financial/openclaw-hub"
echo "2. 查看示例: examples/multi-agent-collaboration.md"
echo "3. 开始使用: 在您的项目中集成 OpenClaw Hub"
echo ""
echo -e "${YELLOW}停止服务器：${NC}"
echo "kill $HUB_PID"
echo ""
echo -e "${GREEN}需要托管服务？${NC}"
echo "Email: 234230052@qq.com"
echo "价格: $29-99/月，14天免费试用"
echo ""
