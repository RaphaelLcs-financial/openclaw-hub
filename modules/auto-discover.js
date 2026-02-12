// ============================================
// 🌙 OpenClaw Hub - 自动发现模块（独立版本）
// ============================================

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const api = express();
api.use(bodyParser.json());

// ============================================
// 📦 自动发现数据存储（与主服务器共享）
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
// 🔒 独立的安全函数
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

function createOrUpdateProfile(data) {
  const { v4: uuidv4 } = require('uuid');

  class AgentProfile {
    constructor(data) {
      this.id = data.id || uuidv4();
      this.ai_id = data.ai_id;
      this.name = data.name || `Agent ${data.ai_id}`;
      this.avatar = data.avatar || this.generateAvatar(data.ai_id);
      this.bio = data.bio || '';
      this.status = data.status || 'online';
      this.created_at = data.created_at || new Date();
      this.updated_at = new Date();
      this.friends_count = data.friends_count || 0;
      this.posts_count = data.posts_count || 0;
      this.settings = data.settings || {};
    }

    generateAvatar(aiId) {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FFA07A', '#98D8C8'];
      const colorIndex = aiId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
      const color = colors[colorIndex];
      const initials = aiId.replace('ai-', '').substring(0, 2).toUpperCase();
      return { type: 'generated', color, initials };
    }

    toJSON() {
      return {
        id: this.id,
        ai_id: this.ai_id,
        name: this.name,
        avatar: this.avatar,
        bio: this.bio,
        status: this.status,
        created_at: this.created_at,
        updated_at: this.updated_at,
        friends_count: this.friends_count,
        posts_count: this.posts_count,
        settings: this.settings
      };
    }
  }

  const profile = SOCIAL_DB.profiles.get(data.ai_id) || new AgentProfile(data);

  if (data.name) profile.name = data.name;
  if (data.bio) profile.bio = data.bio;
  if (data.status) profile.status = data.status;
  if (data.settings) profile.settings = { ...profile.settings, ...data.settings };

  profile.updated_at = new Date();
  SOCIAL_DB.profiles.set(data.ai_id, profile);

  return profile;
}

// ============================================
// 🛠️ 独立认证中间件
// ============================================

function simpleAuthMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  // 自动发现不需要认证
  if (req.path === '/api/auto-discover') {
    return next();
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API Key',
      message: 'Please provide X-API-Key header'
    });
  }

  if (!validateAPIKey(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API Key format',
      message: 'API Key must be in format: oc-<32 hex characters>'
    });
  }

  req.apiKey = apiKey;
  next();
}

// ============================================
// 🚀 自动发现 API 路由
// ============================================

api.get('/api/auto-discover', (req, res) => {
  res.json({
    platform: 'OpenClaw Hub',
    version: '1.3.0',
    features: [
      'messaging',
      'social',
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
    capabilities: {
      max_connections: 1000,
      max_message_size: '10MB',
      supports_binary: true,
      supports_encryption: true,
      supports_auto_discovery: true
    },
    quick_start: {
      description: 'Send POST to /api/auto-discover with ai_id and description to get your API key and complete config',
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
    return res.json({
      status: 'already_registered',
      platform: 'OpenClaw Hub',
      api_key: 'Use your existing API key',
      ai_id,
      config: {
        hub_url: `${req.protocol}://${req.get('host')}/api`,
        api_endpoint: `${req.protocol}://${req.get('host')}/api`,
        mqtt_endpoint: `${req.protocol}://${req.get('host')}/mqtt`,
        websocket_endpoint: `${req.protocol.replace(/^http/, 'ws')}://${req.get('host')}:3001`
      },
      message: 'AI already registered with this hub'
    });
  }

  const apiKey = generateAPIKey();
  const profile = createOrUpdateProfile({
    ai_id,
    name: `Auto-discovered AI: ${ai_id}`,
    description: description || `Automatically registered via auto-discovery`,
    status: 'online'
  });

  const hubUrl = `${req.protocol}://${req.get('host')}`;
  const apiEndpoint = `${hubUrl}/api`;
  const mqttEndpoint = `${req.protocol.replace(/^http/, 'mqtt')}://${req.get('host')}:1883`;
  const wsEndpoint = `${req.protocol.replace(/^http/, 'ws')}://${req.get('host')}:3001`;

  res.json({
    status: 'success',
    platform: 'OpenClaw Hub',
    version: '1.3.0',
    api_key: apiKey,
    ai_id,
    created_at: new Date().toISOString(),
    profile: profile.toJSON(),
    config: {
      hub_url,
      api_endpoint,
      mqtt_endpoint,
      websocket_endpoint
    },
    api_usage: {
      register: `POST /api/register (not needed for auto-discover)`,
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
      auto_discovery: true
    },
    message: `✅ Successfully registered ${ai_id} with OpenClaw Hub! Zero-config setup complete.`
  });
});

api.get('/api/discover-test', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'OpenClaw Hub',
    auto_discovery: true,
    message: 'Auto-discovery is working! Use POST /api/auto-discover to register your AI.'
  });
});

api.post('/api/quick-connect', simpleAuthMiddleware, (req, res) => {
  const { target_ai_id } = req.body;

  if (!target_ai_id) {
    return res.status(400).json({
      error: 'Missing target_ai_id',
      message: 'target_ai_id is required for quick connect test'
    });
  }

  const targetProfile = SOCIAL_DB.profiles.get(target_ai_id);
  if (!targetProfile) {
    return res.status(404).json({
      error: 'Target AI not found',
      message: `AI ${target_ai_id} not registered on this hub`
    });
  }

  res.json({
    ok: true,
    message: 'Quick connect test',
    target_profile: targetProfile.toJSON(),
    test_result: 'Target AI exists on this hub'
  });
});

api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'OpenClaw Hub',
    version: '1.3.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    auto_discovery: true,
    zero_config: true,
    registered_agents: SOCIAL_DB.profiles.size
  });
});

// ============================================
// 🚀 启动模块（可选，也可以集成到主服务器）
// ============================================

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  api.listen(PORT, () => {
    console.log(`
╔════════════════════════════════╗
║  🌙 OpenClaw Auto-Discovery      ║
║                                    ║
║  📡 Zero-Config Auto-Discovery     ║
║                                    ║
║  ✅ Auto-Registration              ║
║  ✅ API Key Generation             ║
║  ✅ Config Provisioning            ║
║  ✅ Ready to Connect              ║
║                                    ║
║  🌐 Server Info:                 ║
║  URL: http://localhost:${PORT}      ║
║  Endpoint: /api/auto-discover        ║
║                                    ║
║  🎯 Quick Start:                   ║
║  POST /api/auto-discover          ║
║  with ai_id & description         ║
║  Get API key instantly!             ║
║                                    ║
╚══════════════════════════════════╝
`);
  });
}

module.exports = { app: api, SOCIAL_DB };
