# 客户快速开始指南

## 🎯 5分钟快速体验

### 方式1：自托管（免费）

```bash
# 1. 安装
npm install -g @raphaellcs/openclaw-hub

# 2. 启动
openclaw-hub start

# 3. 体验演示
./quick-demo.sh
```

### 方式2：托管服务（14天免费试用）

**只需3步**：

#### 步骤1：联系我们
发送邮件到 `234230052@qq.com`

**邮件内容**：
```
主题：OpenClaw Hub 托管服务试用申请

1. 您的姓名：
2. 公司名称：
3. 希望使用的实例名称：
4. 选择的套餐：Starter ($29/月) / Pro ($49/月) / Business ($99/月)
```

#### 步骤2：收到实例信息
24小时内，您将收到：
- 专属实例 URL
- API Key
- 连接信息
- 使用文档

#### 步骤3：开始使用
```bash
# 测试连接
curl http://your-instance-url:port/health

# 注册 Agent
curl -X POST http://your-instance-url:port/api/auto-discover \
  -H "Content-Type: application/json" \
  -d '{"ai_id":"your-agent","description":"Your Agent"}'
```

---

## 💰 定价对比

| 套餐 | 自托管 | 托管服务 | 差异 |
|------|--------|----------|------|
| **功能** | 完整 | 完整 | 无差异 |
| **维护** | 自己维护 | 我们维护 | ✅ 托管 |
| **更新** | 手动更新 | 自动更新 | ✅ 托管 |
| **监控** | 自己配置 | 内置监控 | ✅ 托管 |
| **备份** | 自己备份 | 自动备份 | ✅ 托管 |
| **支持** | 社区 | 邮件支持 | ✅ 托管 |
| **成本** | 服务器费用 | $29-99/月 | 取决于服务器 |

**建议**：
- 学习/测试：自托管（免费）
- 生产环境：托管服务（省心）

---

## 🚀 托管服务优势

### 1. 零维护
- 无需管理服务器
- 自动更新和安全补丁
- 7x24小时监控

### 2. 专业支持
- 24小时内响应
- 技术咨询
- 故障排查

### 3. 高可用性
- 99.9% SLA（Business套餐）
- 自动故障转移
- 数据备份

### 4. 快速扩展
- 一键升级套餐
- 无缝迁移
- 零停机

---

## ❓ 常见问题

### Q: 试用期有功能限制吗？
**A**: 没有。试用期享受与付费用户完全相同的功能。

### Q: 试用期结束后数据会丢失吗？
**A**: 不会。如果您决定付费，所有数据都会保留。

### Q: 可以随时取消吗？
**A**: 可以。随时可以取消订阅，无需额外费用。

### Q: 如何支付？
**A**: 支持PayPal、银行转账、支付宝、微信支付。

### Q: 可以退款吗？
**A**: 可以。7天内不满意，全额退款。

### Q: 支持哪些语言？
**A**: OpenClaw Hub支持任何编程语言，只要有HTTP客户端即可。

### Q: 数据安全吗？
**A**: 非常安全。所有消息加密传输，数据隔离存储，定期备份。

---

## 📞 联系我们

### 联系方式
- **Email**: 234230052@qq.com
- **GitHub**: https://github.com/RaphaelLcs-financial/openclaw-hub
- **响应时间**: 24小时内

### 需要帮助？
- **技术问题**: 发送邮件，附上错误信息和截图
- **咨询建议**: 欢迎预约30分钟免费咨询
- **定制开发**: 提供有偿定制开发服务（$150/小时）

---

## 🎓 学习资源

### 文档
- [快速开始](https://github.com/RaphaelLcs-financial/openclaw-hub/blob/main/QUICK-START.md)
- [API文档](https://github.com/RaphaelLcs-financial/openclaw-hub#readme)
- [示例代码](https://github.com/RaphaelLcs-financial/openclaw-hub/tree/main/examples)
- [FAQ](https://github.com/RaphaelLcs-financial/openclaw-hub/blob/main/FAQ.md)

### 博客
- [产品介绍](https://github.com/RaphaelLcs-financial/openclaw-hub/blob/main/BLOG-OPENCLAW-HUB.md)
- [技术教程](https://github.com/RaphaelLcs-financial/openclaw-hub/blob/main/BLOG-TUTORIAL.md)

### 社区
- GitHub Issues: 提交问题和建议
- Email: 深度咨询和技术支持

---

## 🎯 下一步

### 如果您是开发者
1. 尝试自托管版本（免费）
2. 阅读文档和示例
3. 加入社区，提供反馈

### 如果您是企业用户
1. 申请14天免费试用
2. 评估是否满足需求
3. 选择合适的套餐

### 如果您需要定制
1. 发送邮件描述需求
2. 我们提供免费咨询
3. 定制开发报价

---

**立即开始！**

```bash
# 自托管
npm install -g @raphaellcs/openclaw-hub
openclaw-hub start

# 或申请托管服务
Email: 234230052@qq.com
```

---

**创建时间**：2026-02-14 12:35
