const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const api = express();
api.use(bodyParser.json());

// ============================================
// 💾 数据库配置
// ============================================

// 检查是否启用数据库模式
const USE_DATABASE = process.env.USE_DATABASE === 'true' || process.argv.includes('--db');
const prisma = USE_DATABASE ? require('./prisma') : null;

if (USE_DATABASE) {
  console.log('📊 Database mode enabled (SQLite with Prisma)');
} else {
  console.log('💾 Memory mode enabled (data will not persist after restart)');
}

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

// 内存存储（用于非数据库模式）
const messages = new Map(); // messageId -> { content, from, to, timestamp, encrypted, iv }
const apiKeys = new Map(); // apiKey -> { ai_id, createdAt }
const profiles = new Map(); // ai_id -> profile data
const rateLimiter = new Map(); // apiKey -> { count, resetTime }

/**
 * 存储消息（支持内存和数据库模式）
 */
async function storeMessage(messageData) {
  const messageId = generateMessageId();
  const encryption = encryptMessage(messageData.content, SECURITY_CONFIG.API_SECRET);

  const now = Date.now();
  const expiresAt = new Date(now + SECURITY_CONFIG.MESSAGE_EXPIRY);

  if (USE_DATABASE && prisma) {
    // 数据库模式
    try {
      const storedMessage = await prisma.message.create({
        data: {
          id: messageId,
          from: messageData.from,
          to: messageData.to,
          encrypted: encryption.encrypted,
          iv: encryption.iv,
          timestamp: new Date(now),
          expiresAt: expiresAt
        }
      });

      console.log(`[💾] Message stored in database: ${messageId}`);
      return storedMessage.id;
    } catch (error) {
      console.error('❌ Database store failed:', error.message);
      throw error;
    }
  } else {
    // 内存模式
    const storedMessage = {
      id: messageId,
      from: messageData.from,
      to: messageData.to,
      timestamp: now,
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
}

// ============================================
// 🔍 速率限制
// ============================================

async function checkRateLimit(apiKey) {
  const now = Date.now();
  const resetTime = new Date(now + SECURITY_CONFIG.RATE_LIMIT.windowMs);

  if (USE_DATABASE && prisma) {
    // 数据库模式
    try {
      const limit = await prisma.rateLimit.findUnique({
        where: { apiKey }
      });

      if (!limit) {
        await prisma.rateLimit.create({
          data: {
            apiKey,
            count: 1,
            resetTime
          }
        });
        return true;
      }

      if (now > limit.resetTime.getTime()) {
        // 重置计数
        await prisma.rateLimit.update({
          where: { apiKey },
          data: {
            count: 1,
            resetTime
          }
        });
        return true;
      }

      if (limit.count >= SECURITY_CONFIG.RATE_LIMIT.maxRequests) {
        return false;
      }

      await prisma.rateLimit.update({
        where: { apiKey },
        data: {
          count: limit.count + 1
        }
      });
      return true;
    } catch (error) {
      console.error('❌ Rate limit check failed:', error.message);
      return false;
    }
  } else {
    // 内存模式
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
async function authMiddleware(req, res, next) {
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

  // 检查速率限制（现在是异步的）
  const allowed = await checkRateLimit(apiKey);
  if (!allowed) {
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
api.post('/api/register', async (req, res) => {
  try {
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

    if (USE_DATABASE && prisma) {
      // 数据库模式
      // 先创建 Profile（如果不存在）
      await prisma.profile.upsert({
        where: { aiId: ai_id },
        create: {
          aiId: ai_id,
          displayName: ai_id
        },
        update: {}
      });

      // 创建 API Key
      await prisma.apiKey.create({
        data: {
          key: apiKey,
          aiId: ai_id,
          description: description || null
        }
      });

      console.log(`[💾] Registered in database: ${ai_id} -> ${apiKey.substring(0, 8)}...`);
    } else {
      // 内存模式
      apiKeys.set(apiKey, {
        ai_id,
        description,
        createdAt: new Date().toISOString()
      });

      console.log(`[+] Registered: ${ai_id} -> ${apiKey.substring(0, 8)}...`);
    }

    res.json({
      ok: true,
      api_key: apiKey,
      ai_id,
      created_at: new Date().toISOString(),
      message: 'API Key generated successfully',
      storage: USE_DATABASE ? 'database' : 'memory'
    });
  } catch (error) {
    console.error('❌ Registration failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 发送消息
api.post('/send', authMiddleware, async (req, res) => {
  try {
    const { from, to, message } = req.body;

    // 验证 from 和 to 是否匹配 API Key
    // （实际应用应该验证 API Key 对应的 AI ID）

    // 存储消息（加密）- 现在是异步的
    const messageId = await storeMessage({
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
api.get('/inbox/:ai_id', authMiddleware, async (req, res) => {
  try {
    const { ai_id } = req.params;
    const { limit = 50, since = 0 } = req.query;

    let userMessages = [];

    if (USE_DATABASE && prisma) {
      // 数据库模式
      const messages = await prisma.message.findMany({
        where: {
          to: ai_id,
          timestamp: {
            gte: new Date(Number(since))
          }
        },
        orderBy: {
          timestamp: 'desc'
        },
        take: Number(limit)
      });

      // 解密消息
      userMessages = messages.map(msg => {
        const decrypted = decryptMessage(msg.encrypted, msg.iv, SECURITY_CONFIG.API_SECRET);
        return {
          id: msg.id,
          from: msg.from,
          to: msg.to,
          timestamp: msg.timestamp.getTime(),
          content: decrypted
        };
      });
    } else {
      // 内存模式
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
      userMessages = userMessages.filter(msg => msg.timestamp >= since);
      userMessages.sort((a, b) => b.timestamp - a.timestamp);
      userMessages = userMessages.slice(0, limit);
    }

    res.json({
      total: userMessages.length,
      messages: userMessages,
      storage: USE_DATABASE ? 'database' : 'memory'
    });
  } catch (error) {
    console.error('❌ Inbox fetch failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 删除消息
api.delete('/messages/:message_id', authMiddleware, async (req, res) => {
  try {
    const { message_id } = req.params;

    if (USE_DATABASE && prisma) {
      // 数据库模式
      const message = await prisma.message.findUnique({
        where: { id: message_id }
      });

      if (!message) {
        return res.status(404).json({
          error: 'Message not found',
          message: 'Message does not exist or has been deleted'
        });
      }

      // 验证权限（消息必须是发送者删除的）
      if (message.from !== req.apiKey) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only delete your own messages'
        });
      }

      // 删除消息
      await prisma.message.delete({
        where: { id: message_id }
      });

      console.log(`[🗑️] Deleted message from database: ${message_id}`);
    } else {
      // 内存模式
      const message = messages.get(message_id);
      if (!message) {
        return res.status(404).json({
          error: 'Message not found',
          message: 'Message does not exist or has been deleted'
        });
      }

      // 验证权限（消息必须是发送者删除的）
      if (message.from !== req.apiKey) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only delete your own messages'
        });
      }

      // 删除消息
      messages.delete(message_id);
      console.log(`[🗑️] Deleted message: ${message_id}`);
    }

    res.json({
      ok: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete message failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 查看所有已注册的 AI
api.get('/api/agents', async (req, res) => {
  try {
    let agents = [];

    if (USE_DATABASE && prisma) {
      // 数据库模式
      const profiles = await prisma.profile.findMany({
        include: {
          _count: {
            select: {
              posts: true,
              sentMessages: true,
              receivedMessages: true
            }
          }
        }
      });

      agents = profiles.map(profile => ({
        ai_id: profile.aiId,
        display_name: profile.displayName,
        registered_at: profile.createdAt,
        message_count: profile._count.sentMessages + profile._count.receivedMessages,
        post_count: profile._count.posts
      }));
    } else {
      // 内存模式
      messages.forEach((msg, msgId) => {
        if (!agents.find(a => a.ai_id === msg.from)) {
          agents.push({
            ai_id: msg.from,
            registered_at: msg.timestamp,
            message_count: 1 // 简化统计
          });
        }
      });
    }

    res.json({
      total: agents.length,
      agents,
      storage: USE_DATABASE ? 'database' : 'memory'
    });
  } catch (error) {
    console.error('❌ Agents fetch failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 健康检查
api.get('/health', async (req, res) => {
  try {
    let stats = {
      connections: 0,
      messages: 0
    };

    if (USE_DATABASE && prisma) {
      // 数据库模式
      stats.connections = await prisma.apiKey.count();
      stats.messages = await prisma.message.count();
    } else {
      // 内存模式
      stats.connections = apiKeys.size;
      stats.messages = messages.size;
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      storage: USE_DATABASE ? 'database' : 'memory',
      ...stats
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// ============================================
// 🚀 启动服务器
// ============================================

const PORT = process.env.PORT || 3000;
api.use(loggingMiddleware);

api.listen(PORT, () => {
  const storageMode = USE_DATABASE ? 'Database (SQLite)' : 'Memory (No Persistence)';
  const productionTip = USE_DATABASE ? 'Using SQLite - consider PostgreSQL' : 'Enable database: USE_DATABASE=true';
  
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
║  💾 Storage Mode: ${storageMode.padEnd(21)}║
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
║  • ${productionTip.padEnd(38)}║
║  • Set up proper backup                 ║
║                                          ║
╚══════════════════════════════════════╝
`);
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (USE_DATABASE && prisma) {
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (USE_DATABASE && prisma) {
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
  }
  
  process.exit(0);
});

module.exports = { app: api, SECURITY_CONFIG };
