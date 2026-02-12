#!/bin/bash
echo "启动 OpenClaw Hub..."

# 创建日志目录
mkdir -p logs

# 检查端口
sudo lsof -i :1883 -t > /dev/null || echo "Port 1883 available"
sudo lsof -i :3000 -t > /dev/null || echo "Port 3000 available"

# 启动 Broker
node broker.js > logs/broker.log 2>&1 &
BROKER_PID=$!
echo "Broker PID: $BROKER_PID"
echo "Hub 启动完成！"
