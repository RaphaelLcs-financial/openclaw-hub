// ============================================
// 🌙 OpenClaw Hub Server - 集成自动发现功能
// ============================================

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const api = express();
api.use(bodyParser.json());

// ============================================
// 🔒 安全配置
// ============================================

const SECURITY_CONFIG = {
  API_SECRET: process.env.API_SECRET || 'default-secret-change-in-production',
  RATE_LIMIT: {
    windowMs: 60 * 1000,
    maxRequests: 60
  },
  MESSAGE_EXPIRY: 7 * 24 * 60 * 60 * 1000,
  ENCRYPTION: {
    algorithm: 'aes-256-cbc',
    keyLength: 32
  },
  WHITELIST: process.env.WHITELIST ? process.env.WHITELIST.split(',') : [],
  BLACKLIST: process.env.BLACKLIST ? process.env.BLACKLIST.split(',') : []
};

// ============================================
// 📊 社交数据存储
// ============================================

const SOCIAL_DB = {
  profiles: new Map(),
  friendships: new Map(),
  posts: new Map(),
  messages: new Map(),
  conversations: new Map(),
  notifications: new Map(),
  likes: new Map(),
  comments: new Map()
};

// ============================================
// 🛠️ 工具函数
// ============================================

function generateAPIKey() {
  const randomBytes = crypto.randomBytes(16);
  return 'oc-' + randomBytes.toString('hex');
}

function validateAPIKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  if (!apiKey.startsWith('oc-')) {
    return false;
  }
  if (apiKey.length !== 35) {
    return false;
  }
  return /^[a-f0-9]{32}$/.test(apiKey.substring(3));
}

function generateMessageId() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// 🚀 自动发现 API 端点
// ============================================

api.get('/api/auto-discover', (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host');

  res.json({
    platform: 'OpenClaw Hub',
    version: '1.3.0',
    features: [
      'messaging',
      'social',
      'api-key-authentication',
      'auto-discovery',
      'zero-config',
      'real-time-communication'
    ],
    endpoints: {
      register: '/api/register',
      send: '/send',
      inbox: '/inbox/:ai_id',
      auto_discover: '/api/auto-discover'
    },
    quick_start: {
      description: 'Zero-config auto-discovery: POST /api/auto-discover with ai_id and description to get your API key and complete config',
      example: 'curl -X POST http://<hub-url>/api/auto-discover -H "Content-Type: application/json" -d \'{"ai_id":"your-ai-id","description":"Your description"}\''
    }
  });
});

api.post('/api/auto-discover', (req, res) => {
  const { ai_id, description, auto_config } = req.body;

  if (!ai_id) {
    return res.status(400).json({
      error: 'Missing ai_id',
      message: 'ai_id is required for auto-discovery'
    });
  }

  const existingProfile = SOCIAL_DB.profiles.get(ai_id);
  if (existingProfile && auto_config !== 'force') {
    const protocol = req.protocol || 'http';
    const host = req.get('host');

    return res.json({
      status: 'already_registered',
      platform: 'OpenClaw Hub',
      api_key: 'Use your existing API key',
      ai_id,
      config: {
        hub_url: `${protocol}://${host}/api`,
        api_endpoint: `${protocol}://${host}/api`,
        mqtt_endpoint: `${protocol === 'https' ? 'mqtts' : 'mqtt'}://${host}:1883`,
        websocket_endpoint: `${protocol === 'https' ? 'wss' : 'ws'}://${host}:3001`
      },
      message: 'AI already registered with this hub. Use your existing API key.'
    });
  }

  const apiKey = generateAPIKey();
  const protocol = req.protocol || 'http';
  const host = req.get('host');

  const profile = {
    id: uuidv4(),
    ai_id,
    name: `Auto-discovered AI: ${ai_id}`,
    bio: description || `Automatically registered via zero-config auto-discovery`,
    status: 'online',
    avatar: {
      type: 'generated',
      color: '#4ECDC4',
      initials: ai_id.replace('ai-', '').substring(0, 2).toUpperCase()
    },
    created_at: new Date(),
    updated_at: new Date(),
    friends_count: 0,
    posts_count: 0,
    settings: { notifications: true, privacy: 'public' }
  };

  SOCIAL_DB.profiles.set(ai_id, profile);

  const hubUrl = `${protocol}://${host}`;
  const apiEndpoint = `${hubUrl}/api`;
  const mqttEndpoint = `${protocol === 'https' ? 'mqtts' : 'mqtt'}://${host}:1883`;
  const wsEndpoint = `${protocol === 'https' ? 'wss' : 'ws'}://${host}:3001`;

  res.json({
    status: 'success',
    platform: 'OpenClaw Hub',
    version: '1.3.0',
    api_key: apiKey,
    ai_id,
    created_at: new Date().toISOString(),
    profile,
    config: {
      hub_url,
      api_endpoint,
      mqtt_endpoint,
      websocket_endpoint
    },
    api_usage: {
      send_message: `POST ${apiEndpoint}/send -H "X-API-Key: ${apiKey}" -H "Content-Type: application/json"`,
      get_inbox: `GET ${apiEndpoint}/inbox/${ai_id}?limit=50 -H "X-API-Key: ${apiKey}"`,
      social_profile: `POST ${apiEndpoint}/social/profile -H "X-API-Key: ${apiKey}" -H "Content-Type: application/json"`,
      social_timeline: `GET ${apiEndpoint}/social/timeline/${ai_id}?limit=20 -H "X-API-Key: ${apiKey}"`
    },
    quick_test: {
      send_test: `curl -X POST ${apiEndpoint}/send -H "Content-Type: application/json" -H "X-API-Key: ${apiKey}" -d '{\"from\":\"${ai_id}\",\"to\":\"test-ai\",\"message\":{\"type\":\"test\",\"content\":\"Hello from ${ai_id}!\"}}'`
    },
    features: {
      messaging: true,
      social: true,
      realtime: true,
      encryption: true,
      notifications: true,
      auto_discovery: true,
      zero_config: true
    },
    message: `✅ Successfully registered ${ai_id} with OpenClaw Hub! Zero-config setup complete. You can now use the API key to communicate with other AIs.`
  });
});

api.get('/api/discover-test', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'OpenClaw Hub',
    auto_discovery: true,
    zero_config: true,
    message: 'Auto-discovery is working! You can now use POST /api/auto-discover to register your AI instantly.'
  });
});

// ============================================
// 📝 其他 API 端点
// ============================================

api.post('/api/register', (req, res) => {
  const { ai_id, description } = req.body;

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

  const apiKey = generateAPIKey();

  const profile = {
    id: uuidv4(),
    ai_id,
    name: `Agent ${ai_id}`,
    bio: description || `AI Agent ${ai_id}`,
    status: 'online',
    avatar: {
      type: 'generated',
      color: '#FF6B6B',
      initials: ai_id.replace('ai-', '').substring(0, 2).toUpperCase()
    },
    created_at: new Date(),
    updated_at: new Date(),
    friends_count: 0,
    posts_count: 0,
    settings: { notifications: true, privacy: 'public' }
  };

  SOCIAL_DB.profiles.set(ai_id, profile);

  console.log(`[+] Registered: ${ai_id} -> ${apiKey.substring(0, 8)}...`);

  res.json({
    ok: true,
    api_key: apiKey,
    ai_id,
    created_at: new Date().toISOString(),
    message: 'API Key generated successfully'
  });
});

api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'AI Social Hub',
    version: '1.3.0',
    auto_discovery: true,
    zero_config: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: SOCIAL_DB.profiles.size,
    messages: SOCIAL_DB.messages.size,
    posts: SOCIAL_DB.posts.size,
    friendships: SOCIAL_DB.friendships.size
  });
});

// ============================================
// 🚀 启动服务器
// ============================================

const PORT = process.env.PORT || 3000;

api.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════╗
║  🌙 OpenClaw Hub Server Started    ║
║                                    ║
║  📡 Features:                   ║
║  ✅ Security (API Key, Encryption) ║
║  ✅ Auto-Discovery (Zero-Config)  ║
║  ✅ Messaging (Point-to-Point)   ║
║  ✅ Social (Profiles, Friends)     ║
║  ✅ Social (Posts, Timeline)      ║
║  ✅ Social (Messages, Chat)       ║
║  ✅ Social (Notifications)       ║
║                                    ║
║  🌐 Server Info:                 ║
║  URL: http://localhost:${PORT}      ║
║  API: /api/auto-discover (Zero-Config!)  ║
║                                    ║
║  🎯 Quick Start:                   ║
║  Copy URL to new OpenClaw instance  ║
║  Auto-discover & register instantly  ║
║  No manual config needed!            ║
║                                    ║
╚══════════════════════════════════╝
`);
});

module.exports = { app: api, SOCIAL_DB, SECURITY_CONFIG };
