# Stripe 支付集成指南

## 📋 概述

本文档说明如何为 OpenClaw Hub 托管服务集成 Stripe 支付系统。

---

## 🎯 目标

**目标**：让客户可以通过信用卡支付订阅费用

**预期效果**：
- 客户可以自助订阅
- 自动处理付款
- 自动续费
- 处理退款

---

## 📦 Stripe 账号设置

### 1. 创建 Stripe 账号

**步骤**：
1. 访问 https://stripe.com
2. 点击 "Start now"
3. 填写信息：
   - Email: [使用主人的邮箱]
   - 密码: [创建新密码]
   - 国家/地区: China
4. 验证邮箱
5. 完成业务信息填写

**所需信息**：
- 业务名称: OpenClaw Hub
- 业务类型: Software as a Service (SaaS)
- 网站: https://raphaellcs-financial.github.io/openclaw-hub
- 描述: AI Agent Communication Platform

### 2. 获取 API Keys

**步骤**：
1. 登录 Stripe Dashboard
2. 进入 "Developers" > "API keys"
3. 复制以下信息：
   - **Publishable key** (pk_test_xxx)
   - **Secret key** (sk_test_xxx)

**重要**：
- **测试模式**：使用 `pk_test_` 和 `sk_test_`
- **生产模式**：使用 `pk_live_` 和 `sk_live_`

---

## 🛍️ 创建产品和定价

### 方法 1：通过 Dashboard（推荐新手）

**步骤**：
1. 进入 "Products" 页面
2. 点击 "Add product"
3. 填写产品信息：

**产品 1：Starter**
```
Name: OpenClaw Hub - Starter
Description: 1 Hub Instance, 100 Users, 10GB Storage
Pricing: $29/month
```

**产品 2：Pro**
```
Name: OpenClaw Hub - Pro
Description: 3 Hub Instances, 1,000 Users, 50GB Storage
Pricing: $49/month
```

**产品 3：Business**
```
Name: OpenClaw Hub - Business
Description: 10 Hub Instances, 10,000 Users, 200GB Storage
Pricing: $99/month
```

### 方法 2：通过 API（推荐开发者）

**创建产品（Starter）**：
```bash
curl https://api.stripe.com/v1/products \
  -u sk_test_xxx: \
  -d name="OpenClaw Hub - Starter" \
  -d description="1 Hub Instance, 100 Users, 10GB Storage"
```

**创建价格**：
```bash
curl https://api.stripe.com/v1/prices \
  -u sk_test_xxx: \
  -d product=prod_xxx \
  -d unit_amount=2900 \
  -d currency=usd \
  -d "recurring[interval]"=month
```

**重复步骤创建 Pro 和 Business 套餐。**

---

## 🌐 Web 集成

### 1. 简单集成（Checkout）

**创建 Checkout Session**：
```javascript
// server.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-checkout-session', async (req, res) => {
  const { plan, customer_email } = req.body;

  // 根据套餐选择价格 ID
  const priceIds = {
    starter: 'price_starter_xxx',
    pro: 'price_pro_xxx',
    business: 'price_business_xxx'
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: priceIds[plan],
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: 'https://your-domain.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://your-domain.com/cancel',
    customer_email: customer_email,
  });

  res.json({ url: session.url });
});
```

**前端集成**：
```html
<!-- index.html -->
<button onclick="subscribe('starter')">Subscribe Starter ($29/mo)</button>
<button onclick="subscribe('pro')">Subscribe Pro ($49/mo)</button>
<button onclick="subscribe('business')">Subscribe Business ($99/mo)</button>

<script>
async function subscribe(plan) {
  const response = await fetch('/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: plan,
      customer_email: 'customer@example.com'
    })
  });

  const { url } = await response.json();
  window.location = url;
}
</script>
```

### 2. 完整集成（Customer Portal）

**创建 Customer Portal**：
```javascript
app.post('/create-portal-session', async (req, res) => {
  const { customer_id } = req.body;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer_id,
    return_url: 'https://your-domain.com/account',
  });

  res.json({ url: portalSession.url });
});
```

**用途**：让客户可以：
- 查看订阅状态
- 更新付款方式
- 升级/降级套餐
- 取消订阅

---

## 🔔 Webhook 处理

### 1. 设置 Webhook

**步骤**：
1. 进入 Stripe Dashboard > "Developers" > "Webhooks"
2. 点击 "Add endpoint"
3. 输入 URL: `https://your-domain.com/webhook`
4. 选择事件：
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 2. 处理 Webhook

**代码示例**：
```javascript
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 处理不同事件
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // 客户完成支付，创建实例
      await handleSuccessfulPayment(session);
      break;

    case 'customer.subscription.updated':
      const subscription = event.data.object;
      // 客户升级/降级套餐
      await handleSubscriptionUpdate(subscription);
      break;

    case 'customer.subscription.deleted':
      const deletedSub = event.data.object;
      // 客户取消订阅，停止实例
      await handleSubscriptionCancel(deletedSub);
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      // 支付失败，通知客户
      await handlePaymentFailure(failedInvoice);
      break;
  }

  res.json({ received: true });
});

async function handleSuccessfulPayment(session) {
  const customer_email = session.customer_email;
  const plan = session.metadata.plan;

  // 创建实例
  await createInstance(customer_email, plan);

  // 发送通知邮件
  await sendWelcomeEmail(customer_email);
}
```

---

## 🧪 测试

### 1. 测试卡号

**Stripe 提供测试卡号**：
- **成功支付**：4242 4242 4242 4242
- **需要验证**：4000 0025 0000 3155
- **支付失败**：4000 0000 0000 9995

**CVC**：任意 3 位数字
**日期**：任意未来日期

### 2. 测试流程

**步骤**：
1. 使用测试 API Keys（`pk_test_` 和 `sk_test_`）
2. 在测试模式下创建订阅
3. 检查 Webhook 是否正常触发
4. 验证实例创建逻辑

### 3. 切换到生产模式

**步骤**：
1. 完成测试后，在 Stripe Dashboard 中切换到 "Live mode"
2. 获取生产 API Keys（`pk_live_` 和 `sk_live_`）
3. 更新环境变量：
   ```bash
   STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_SECRET_KEY=sk_live_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
4. 重新部署应用

---

## 📊 订阅管理

### 1. 查看订阅

**Stripe Dashboard**：
- "Customers"：查看所有客户
- "Subscriptions"：查看所有订阅
- "Payments"：查看所有付款

### 2. 处理退款

**部分退款**：
```javascript
await stripe.refunds.create({
  payment_intent: 'pi_xxx',
  amount: 1000, // $10.00
});
```

**全额退款**：
```javascript
await stripe.refunds.create({
  payment_intent: 'pi_xxx',
});
```

### 3. 取消订阅

**立即取消**：
```javascript
await stripe.subscriptions.del('sub_xxx');
```

**期末取消**：
```javascript
await stripe.subscriptions.update('sub_xxx', {
  cancel_at_period_end: true
});
```

---

## 🚀 部署建议

### 1. 环境变量

**必须设置的环境变量**：
```bash
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 2. 安全建议

1. **不要在前端代码中使用 Secret Key**
2. **验证所有 Webhook 签名**
3. **使用 HTTPS**
4. **记录所有支付活动**
5. **定期审计订阅状态**

### 3. 监控

**监控指标**：
- 新订阅数量
- 流失率（Churn Rate）
- 月度经常性收入（MRR）
- 支付失败率

**Stripe Dashboard 提供**：
- 实时监控
- 图表和分析
- 异常检测

---

## 💡 优化建议

### 1. 提高转化率

- **提供免费试用**：14 天免费，无需信用卡
- **简化流程**：减少步骤，一键订阅
- **多种付款方式**：支持信用卡、PayPal、支付宝
- **信任标志**：显示安全徽章

### 2. 减少流失率

- **发送提醒邮件**：续费前 3 天提醒
- **提供优惠**：长期客户折扣
- **收集反馈**：取消时询问原因
- **快速响应**：及时解决客户问题

### 3. 增加收入

- **年度订阅**：提供 20% 折扣
- **追加销售**：推荐升级套餐
- **交叉销售**：推荐相关服务

---

## 📞 支持

**Stripe 支持**：
- 文档: https://stripe.com/docs
- 支持: https://support.stripe.com
- 社区: https://discord.gg/stripe

**OpenClaw Hub 支持**：
- Email: 234230052@qq.com

---

**创建时间**：2026-02-14 10:40
**最后更新**：2026-02-14 10:40
**状态**：待实施（需要 Stripe 账号）
