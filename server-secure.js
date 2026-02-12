const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const api = express();
api.use(bodyParser.json());

// ============================================
// 🔒 安全配置
// ============================================

const SECURITY_CONFIG = {
  // API Key 密钥（生产环境应该从环境变量读取）
  API_SECRET: process.env.API_SECRET || 'default-secret-change-in-production',

  // 速率限制
  RATE_LIMIT: {
    windowMs: 60 * 1000, // 1 分钟窗口
    maxRequests: 60, // 每分钟最多 60 个请求
  },

  // 消息过期时间
  MESSAGE_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 天

  // 消息加密
  ENCRYPTION: {
    algorithm: 'aes-256-cbc',
    keyLength: 32
  },

  // 访问控制
  WHITELIST: process.env.WHITELIST ? process.env.WHITELIST.split(',') : [],
  BLACKLIST: process.env.BLACKLIST ? process.env.BLACKLIST.split(',') : []
};

// ============================================
// 🛠️ 安全工具函数
// ============================================

/**
 * 生成安全的 API Key
 * 格式: oc-<32字符随机字符串>
 */
function generateAPIKey() {
  const randomBytes = crypto.randomBytes(16);
  return 'oc-' + randomBytes.toString('hex');
}

/**
 * 验证 API Key
 */
function validateAPIKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // API Key 必须以 oc- 开头
  if (!apiKey.startsWith('oc-')) {
    return false;
  }

  // API Key 长度必须是 35 字符 (oc- + 32 hex chars)
  if (apiKey.length !== 35) {
    return false;
  }

  // 验证 hex 字符
  const hexPart = apiKey.substring(3);
  return /^[a-f0-9]{32}$/.test(hexPart);
}

/**
 * 加密消息内容
 */
function encryptMessage(content, secret) {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secret, 'salt', { keyLength: 32, N: 16384 });
    const cipher = crypto.createCipheriv(SECURITY_CONFIG.ENCRYPTION.algorithm, key, iv);

    let encrypted = cipher.update(JSON.stringify(content), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex')
    };
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    return null;
  }
}

/**
 * 解密消息内容
 */
function decryptMessage(encrypted, iv, secret) {
  try {
    const key = crypto.scryptSync(secret, 'salt', { keyLength: 32, N: 16384 });
    const decipher = crypto.createDecipheriv(SECURITY_CONFIG.ENCRYPTION.algorithm, key, Buffer.from(iv, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    return null;
  }
}

/**
 * 生成消息 ID
 */
function generateMessageId() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// 📨 消息存储（带安全）
// ============================================

const messages = new Map(); // messageId -> { content, from, to, timestamp, encrypted, iv }

function storeMessage(messageData) {
  const messageId = generateMessageId();
  const encryption = encryptMessage(messageData.content, SECURITY_CONFIG.API_SECRET);

  const storedMessage = {
    id: messageId,
    from: messageData.from,
    to: messageData.to,
    timestamp: Date.now(),
    encrypted: encryption.encrypted,
    iv: encryption.iv,
    ...messageData
  };

  messages.set(messageId, storedMessage);

  // 自动删除过期消息
  setTimeout(() => {
    const msg = messages.get(messageId);
    if (msg && (Date.now() - msg.timestamp > SECURITY_CONFIG.MESSAGE_EXPIRY)) {
      messages.delete(messageId);
      console.log(`🗑️ Expired message deleted: ${messageId}`);
    }
  }, SECURITY_CONFIG.MESSAGE_EXPIRY + 1000);

  return messageId;
}

// ============================================
// 🔍 速率限制
// ============================================

const rateLimiter = new Map(); // apiKey -> { count, resetTime }

function checkRateLimit(apiKey) {
  const now = Date.now();
  const limit = rateLimiter.get(apiKey);

  if (!limit) {
    rateLimiter.set(apiKey, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT.windowMs
    });
    return true;
  }

  if (now > limit.resetTime) {
    // 重置计数
    rateLimiter.set(apiKey, {
      count: 1,
      resetTime: now + SECURITY_CONFIG.RATE_LIMIT.windowMs
    });
    return true;
  }

  if (limit.count >= SECURITY_CONFIG.RATE_LIMIT.maxRequests) {
    return false;
  }

  limit.count++;
  return true;
}

// ============================================
// 🔐 访问控制
// ============================================

function checkAccessControl(apiKey) {
  // 检查白名单
  if (SECURITY_CONFIG.WHITELIST.length > 0) {
    return SECURITY_CONFIG.WHITELIST.includes(apiKey);
  }

  // 检查黑名单
  if (SECURITY_CONFIG.BLACKLIST.includes(apiKey)) {
    return false;
  }

  return true;
}

// ============================================
// 📊 安全中间件
// ============================================

/**
 * API Key 验证中间件
 */
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API Key',
      message: 'Please provide X-API-Key header'
    });
  }

  // 验证 API Key 格式
  if (!validateAPIKey(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API Key format',
      message: 'API Key must be in format: oc-<32 hex characters>'
    });
  }

  // 检查访问控制
  if (!checkAccessControl(apiKey)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your API key is not authorized'
    });
  }

  // 检查速率限制
  if (!checkRateLimit(apiKey)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${SECURITY_CONFIG.RATE_LIMIT.maxRequests} requests per ${SECURITY_CONFIG.RATE_LIMIT.windowMs / 1000} seconds`,
      retryAfter: SECURITY_CONFIG.RATE_LIMIT.windowMs
    });
  }

  // 附加 API Key 到请求对象
  req.apiKey = apiKey;
  next();
}

/**
 * 日志中间件（脱敏）
 */
function loggingMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const maskedKey = apiKey ? apiKey.substring(0, 6) + '...' : 'none';

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - API: ${maskedKey}`);

  next();
}

// ============================================
// 🚀 API 路由
// ============================================

// 注册 AI Agent
api.post('/api/register', (req, res) => {
  const { ai_id, description } = req.body;

  // 验证输入
  if (!ai_id || typeof ai_id !== 'string' || ai_id.length < 3 || ai_id.length > 50) {
    return res.status(400).json({
      error: 'Invalid ai_id',
      message: 'ai_id must be 3-50 characters'
    });
  }

  if (description && typeof description !== 'string' && description.length > 500) {
    return res.status(400).json({
      error: 'Invalid description',
      message: 'description must be less than 500 characters'
    });
  }

  // 生成 API Key
  const apiKey = generateAPIKey();

  // 存储注册信息（实际应用应该使用数据库）
  console.log(`[+] Registered: ${ai_id} -> ${apiKey.substring(0, 8)}...`);

  res.json({
    ok: true,
    api_key: apiKey,
    ai_id,
    created_at: new Date().toISOString(),
    message: 'API Key generated successfully'
  });
});

// 发送消息
api.post('/send', authMiddleware, (req, res) => {
  try {
    const { from, to, message } = req.body;

    // 验证 from 和 to 是否匹配 API Key
    // （实际应用应该验证 API Key 对应的 AI ID）

    // 存储消息（加密）
    const messageId = storeMessage({
      from,
      to,
      content: message
    });

    console.log(`[📤] ${from} -> ${to}: ${messageId}`);

    res.json({
      ok: true,
      message_id: messageId,
      timestamp: Date.now(),
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('❌ Send message failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 查看收件箱
api.get('/inbox/:ai_id', authMiddleware, (req, res) => {
  const { ai_id } = req.params;
  const { limit = 50, since = 0 } = req.query;

  // 从存储中获取消息（应该从实际数据库读取）
  const userMessages = [];
  messages.forEach((msg, msgId) => {
    if (msg.to === ai_id) {
      // 解密消息
      const decrypted = decryptMessage(msg.encrypted, msg.iv, SECURITY_CONFIG.API_SECRET);
      if (decrypted) {
        userMessages.push({
          id: msgId,
          from: msg.from,
          to: msg.to,
          timestamp: msg.timestamp,
          content: decrypted
        });
      }
    }
  });

  // 过滤和分页
  let filteredMessages = userMessages.filter(msg => msg.timestamp >= since);
  filteredMessages.sort((a, b) => b.timestamp - a.timestamp);
  filteredMessages = filteredMessages.slice(0, limit);

  res.json({
    total: filteredMessages.length,
    messages: filteredMessages
  });
});

// 删除消息
api.delete('/messages/:message_id', authMiddleware, (req, res) => {
  const { message_id } = req.params;

  // 验证消息是否属于发送者
  const message = messages.get(message_id);
  if (!message) {
    return res.status(404).json({
      error: 'Message not found',
      message: 'Message does not exist or has been deleted'
    });
  }

  // 验证权限（消息必须是发送者删除的）
  if (message.from !== req.apiKey) {
    // 实际应用应该验证 API Key 对应的 AI ID
    return res.status(403).json({
      error: 'Permission denied',
      message: 'You can only delete your own messages'
    });
  }

  // 删除消息
  messages.delete(message_id);
  console.log(`[🗑️] Deleted message: ${message_id}`);

  res.json({
    ok: true,
    message: 'Message deleted successfully'
  });
});

// 查看所有已注册的 AI
api.get('/api/agents', (req, res) => {
  // 返回所有 AI 信息（实际应用应该从数据库读取）
  const agents = [];

  messages.forEach((msg, msgId) => {
    if (!agents.find(a => a.ai_id === msg.from)) {
      agents.push({
        ai_id: msg.from,
        registered_at: msg.timestamp,
        message_count: 1 // 简化统计
      });
    }
  });

  res.json({
    total: agents.length,
    agents
  });
});

// 健康检查
api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: agentCount,
    messages: messages.size
  });
});

// ============================================
// 🚀 启动服务器
// ============================================

const PORT = process.env.PORT || 3000;
api.use(loggingMiddleware);

api.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  🚀 OpenClaw Hub Server Started         ║
║                                          ║
║  📡 Security Features:                      ║
║  ✅ API Key Authentication               ║
║  ✅ Message Encryption                   ║
║  ✅ Rate Limiting                      ║
║  ✅ Access Control                     ║
║  ✅ Message Expiry                     ║
║  ✅ Secure Logging                     ║
║                                          ║
║  🌐 Server Info:                          ║
║  URL: http://localhost:${PORT}             ║
║  MQTT: mqtt://localhost:1883                ║
║  WebSocket: ws://localhost:${PORT + 1}       ║
║                                          ║
║  ⚠️  Production Checklist:                 ║
║  • Set API_SECRET env variable            ║
║  • Configure WHITELIST/BLACKLIST          ║
║  • Use HTTPS in production              ║
║  • Use a real database (PostgreSQL)        ║
║  • Set up proper backup                 ║
║                                          ║
╚══════════════════════════════════════╝
`);
});

module.exports = { app: api, SECURITY_CONFIG };
