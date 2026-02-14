# OpenClaw Hub 托管服务部署指南

## 🎯 概述

本指南说明如何为每个客户部署独立的 OpenClaw Hub 实例（单租户模式）。

## 📋 前提条件

### 必需工具
- Node.js >= 14.0.0
- npm
- OpenSSL（用于生成 API Key）
- （可选）PM2（用于进程管理）

### 安装 PM2（推荐）
```bash
npm install -g pm2
```

## 🚀 快速开始

### 1. 部署新实例

```bash
# 使用默认端口（8081）
./deploy-instance.sh customer-1

# 指定端口
./deploy-instance.sh customer-2 8082
```

### 2. 实例信息

部署完成后，你将看到：

```
==================================
🎉 OpenClaw Hub 实例部署成功！
==================================

实例名称: customer-1
端口: 8081
API Key: oc-<32-hex>

连接信息:
  MQTT: mqtt://localhost:8081
  WebSocket: ws://localhost:8081
  HTTP API: http://localhost:8081/api

数据库位置: instances/customer-1/data/customer-1.db
日志位置: instances/customer-1/logs/customer-1.log
```

### 3. 提供给客户

将以下信息提供给客户：
- **实例名称**：customer-1
- **API Key**：oc-<32-hex>
- **连接地址**：mqtt://your-server.com:8081

## 🔧 实例管理

### 启动实例
```bash
# 使用 PM2
pm2 start instances/customer-1/server.js --name openclaw-hub-customer-1

# 或使用 npm script
npm run start-instance customer-1
```

### 停止实例
```bash
# 使用 PM2
pm2 stop openclaw-hub-customer-1

# 或使用 npm script
npm run stop-instance customer-1
```

### 重启实例
```bash
# 使用 PM2
pm2 restart openclaw-hub-customer-1

# 或使用 npm script
npm run restart-instance customer-1
```

### 查看日志
```bash
# 使用 PM2
pm2 logs openclaw-hub-customer-1

# 或直接查看文件
tail -f instances/customer-1/logs/customer-1.log
```

## 📊 监控

### PM2 监控
```bash
# 查看所有实例
pm2 list

# 监控面板
pm2 monit
```

### 日志管理
```bash
# 日志轮转（需要 pm2-logrotate）
pm2 install pm2-logrotate
```

## 🔐 安全建议

### 1. 防火墙配置
```bash
# 只允许特定 IP 访问
sudo ufw allow from <客户IP> to any port 8081
```

### 2. SSL/TLS
```bash
# 使用 Nginx 反向代理 + Let's Encrypt
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d customer-1.yourdomain.com
```

### 3. API Key 管理
- 每个客户使用唯一的 API Key
- 定期轮换 API Key（建议每 90 天）
- 不要在日志或错误消息中暴露 API Key

## 💰 定价建议

### 套餐定价
```
Starter ($29/月)
- 1 个 Hub 实例
- 100 个用户
- 10GB 存储
- 邮件支持

Pro ($49/月) ⭐ 最受欢迎
- 3 个 Hub 实例
- 1,000 个用户
- 50GB 存储
- 优先支持

Business ($99/月)
- 10 个 Hub 实例
- 10,000 个用户
- 200GB 存储
- 24/7 支持 + SLA
```

### 成本分析
- Railway Pro: $20/月
- 域名: $1/月
- 备份: $2/月
- **总成本: $23/月**

### 利润
- Starter: $6/月（$29 - $23）
- Pro: $26/月（$49 - $23）
- Business: $76/月（$99 - $23）

## 📝 待办事项

### Phase 1（当前）
- [x] 创建部署脚本
- [ ] 测试本地部署
- [ ] 配置 Railway 部署
- [ ] 集成 Stripe 支付
- [ ] 创建 Web Dashboard
- [ ] 设置监控和告警

### Phase 2（未来）
- [ ] 自动化部署（CI/CD）
- [ ] 多租户支持
- [ ] 客户自助管理面板
- [ ] 自动扩展

## 🆘 故障排查

### 实例无法启动
```bash
# 检查端口是否被占用
lsof -i :8081

# 检查日志
tail -f instances/customer-1/logs/customer-1.log

# 检查数据库
sqlite3 instances/customer-1/data/customer-1.db
```

### 数据库错误
```bash
# 重新运行迁移
cd instances/customer-1
npx prisma migrate reset
```

### API Key 无效
```bash
# 重新生成 API Key
openssl rand -hex 16
# 更新 .env 文件中的 API_KEY
# 重启实例
pm2 restart openclaw-hub-customer-1
```

## 📞 支持

如有问题，请联系：
- Email: 234230052@qq.com
- GitHub Issues: https://github.com/RaphaelLcs-financial/openclaw-hub/issues

---

**最后更新**: 2026-02-14
**版本**: v1.0
