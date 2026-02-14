# OpenClaw Hub 托管服务 - 部署指南

## 概述

这是一个用于快速部署 OpenClaw Hub 客户实例的部署脚本。每个客户获得独立的 Hub 实例（单租户架构），托管在 Railway 上。

## 前置要求

1. **Railway 账户**
   - 注册: https://railway.app
   - 安装 CLI: `npm install -g @railway/cli`
   - 登录: `railway login`

2. **系统要求**
   - Bash shell
   - Git
   - Node.js (v18+)
   - OpenSSL（用于生成密钥）

## 使用方法

### 基本用法

```bash
./scripts/deploy-instance.sh <customer-id> <domain> [plan]
```

### 参数说明

- **customer-id**: 客户唯一标识符（例如：customer-001）
- **domain**: 客户的域名（例如：hub.customer001.com）
- **plan**: 订阅计划（可选，默认：starter）
  - `starter`: $29/月，100 用户，10GB 存储
  - `pro`: $49/月，1,000 用户，50GB 存储
  - `business`: $99/月，10,000 用户，200GB 存储

### 示例

```bash
# 部署 Starter 计划
./scripts/deploy-instance.sh customer-001 hub.customer001.com starter

# 部署 Pro 计划
./scripts/deploy-instance.sh customer-002 hub.customer002.com pro

# 部署 Business 计划
./scripts/deploy-instance.sh customer-003 hub.customer003.com business
```

## 部署流程

脚本会自动执行以下步骤：

1. **创建部署目录**: `~/openclaw-hub-customers/<customer-id>/`
2. **克隆代码**: 从 GitHub 克隆 OpenClaw Hub v1.4.0
3. **生成配置**: 创建 API Key 和加密密钥
4. **安装依赖**: `npm install`
5. **运行迁移**: `prisma migrate deploy`
6. **部署到 Railway**: 自动部署并配置域名
7. **测试部署**: 验证健康检查端点

## 部署后任务

### 1. 配置 DNS

在客户的域名提供商处添加 CNAME 记录：

```
hub.customer001.com  CNAME  <railway-app>.railway.app
```

### 2. 发送凭证给客户

通过安全渠道（如加密邮件）发送以下信息：

- **Deployment URL**: `https://hub.customer001.com`
- **API Key**: `oc-...`

### 3. 设置 Stripe 订阅

在 Stripe 中创建订阅：

- 客户邮箱
- 订阅计划（Starter/Pro/Business）
- 定价（$29/$49/$99 每月）

### 4. 配置监控

建议监控项：

- 服务健康检查（`/health`）
- 数据库大小
- 用户数量
- 响应时间

## 客户信息文件

部署完成后，会在 `~/openclaw-hub-customers/<customer-id>/customer-info.json` 创建客户信息文件：

```json
{
  "customerId": "customer-001",
  "domain": "hub.customer001.com",
  "plan": "starter",
  "price": 29,
  "maxUsers": 100,
  "storage": "10GB",
  "apiKey": "oc-...",
  "encryptionKey": "...",
  "deploymentUrl": "https://hub.customer001.com",
  "deployedAt": "2026-02-14T00:00:00Z",
  "railwayProject": "..."
}
```

**⚠️ 重要**: 此文件包含敏感信息，请妥善保管！

## 管理命令

### 查看日志

```bash
cd ~/openclaw-hub-customers/<customer-id>
railway logs
```

### 更新实例

```bash
cd ~/openclaw-hub-customers/<customer-id>
git pull origin main
railway up
```

### 重启实例

```bash
cd ~/openclaw-hub-customers/<customer-id>
railway restart
```

### 删除实例

```bash
cd ~/openclaw-hub-customers/<customer-id>
railway down
cd ~
rm -rf ~/openclaw-hub-customers/<customer-id>
```

## 成本估算

### Railway 成本

- **Starter**: ~$5-10/月（轻量使用）
- **Pro**: ~$15-20/月（中等使用）
- **Business**: ~$30-50/月（重度使用）

### 利润计算

- **Starter**: $29 - $10 = **$19 利润**
- **Pro**: $49 - $20 = **$29 利润**
- **Business**: $99 - $50 = **$49 利润**

## 故障排查

### 部署失败

1. 检查 Railway CLI 是否登录：`railway whoami`
2. 检查网络连接
3. 查看 Railway 日志：`railway logs`

### 域名无法访问

1. 检查 DNS 配置是否正确
2. 等待 DNS 传播（最多 48 小时）
3. 检查 Railway 域名配置：`railway domain`

### 客户无法连接

1. 验证 API Key 是否正确
2. 检查客户代码是否使用正确的 URL
3. 查看服务日志：`railway logs`

## 扩展功能（Phase 2）

未来版本将包括：

- [ ] 自动化 DNS 配置
- [ ] Stripe 自动集成
- [ ] Web Dashboard（客户自助服务）
- [ ] 自动备份和恢复
- [ ] 监控和告警系统
- [ ] 使用量统计和计费

## 支持

如有问题，请联系：

- Email: 234230052@qq.com
- GitHub: https://github.com/RaphaelLcs-financial/openclaw-hub/issues

---

**版本**: v1.0.0
**最后更新**: 2026-02-14
**作者**: 梦月 🌙
