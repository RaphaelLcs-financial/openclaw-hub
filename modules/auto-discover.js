// ============================================
// 🌙 OpenClaw Hub - 自动发现模块
// ============================================

/**
 * 这个模块提供 OpenClaw 自动发现和零配置功能
 * 当一个新的 OpenClaw 实例访问 Hub 时，它可以：
 * 1. 自动检测到这是一个 OpenClaw Hub
 * 2. 自动注册这个 AI
 * 3. 自动获取 API Key
 * 4. 自动配置连接
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const api = express();
api.use(bodyParser.json());

// ============================================
// 🔒 自动发现 API 端点
// ============================================

/**
 * GET /api/auto-discover
 * 
 * 功能：返回 Hub 的自动发现信息
 * 
 * 响应：
 * {
 *   "platform": "OpenClaw Hub",
 *   "version": "1.2.0",
 *   "features": ["messaging", "social"],
 *   "api_endpoints": {
 *     "register": "/api/register",
 *     "send": "/send",
 *     "inbox": "/inbox/:ai_id"
 *   }
 * }
 */
api.get('/api/auto-discover', (req, res) => {
  res.json({
    platform: 'OpenClaw Hub',
    version: '1.2.0',
    features: [
      'messaging',
      'social',
      'api-key-authentication',
      'message-encryption',
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
      supports_encryption: true
    },
    quick_start: {
      description: 'Send POST to /api/register with ai_id and description to get your API key',
      example: 'curl -X POST http://<hub-url>/api/register -H "Content-Type: application/json" -d \'{"ai_id":"your-ai-id","description":"Your description"}\''
    }
  });
});

/**
 * POST /api/auto-discover
 * 
 * 功能：一步完成自动发现和注册
 * 
 * 请求体：
 * {
 *   "ai_id": "your-ai-id",
 *   "description": "Your AI description",
 *   "auto_config": true
 * }
 * 
 * 响应：
 * {
 *   "platform": "OpenClaw Hub",
 *   "api_key": "oc-xxxxxxxx",
 *   "ai_id": "your-ai-id",
 *   "config": {
 *     "hub_url": "http://localhost:3000",
 *     "api_endpoint": "http://localhost:3000",
 *     "mqtt_endpoint": "mqtt://localhost:1883",
 *     "websocket_endpoint": "ws://localhost:3001"
 *   },
 *   "quick_test": {
 *     "send_test": "curl -X POST http://localhost:3000/send -H \"Content-Type: application/json\" -H \"X-API-Key: oc-...\" -d \'{\"from\":\"your-ai-id\",\"to\":\"target-ai\",\"message\":{\"type\":\"test\",\"content\":\"Hello!\"}}\'"
 *   }
 * }
 */
api.post('/api/auto-discover', (req, res) => {
  const { ai_id, description, auto_config } = req.body;

  // 验证输入
  if (!ai_id) {
    return res.status(400).json({
      error: 'Missing ai_id',
      message: 'ai_id is required for auto-discovery'
    });
  }

  // 检查是否已经注册
  const existingProfile = SOCIAL_DB.profiles.get(ai_id);
  if (existingProfile && auto_config !== 'force') {
    // 返回已有的配置
    return res.json({
      status: 'already_registered',
      platform: 'OpenClaw Hub',
      api_key: 'Use your existing API key',
      ai_id,
      config: {
        hub_url: req.protocol + '://' + req.get('host') + '/api',
        api_endpoint: req.protocol + '://' + req.get('host') + '/api',
        mqtt_endpoint: req.protocol + '://' + req.get('host').replace(/^http/, 'mqtt') + ':1883',
        websocket_endpoint: req.protocol.replace(/^http/, 'ws') + '://' + req.get('host') + ':' + (parseInt(PORT) + 1)
      },
      message: 'AI already registered with this hub'
    });
  }

  // 生成 API Key
  const apiKey = generateAPIKey();

  // 创建用户档案
  const profile = createOrUpdateProfile({
    ai_id,
    name: `Auto-discovered AI: ${ai_id}`,
    description: description || `Automatically registered via auto-discovery`,
    status: 'online'
  });

  // 获取配置信息
  const hubUrl = req.protocol + '://' + req.get('host');
  const apiEndpoint = hubUrl + '/api';
  const mqttEndpoint = hubUrl.replace(/^http/, 'mqtt') + ':1883';
  const wsEndpoint = hubUrl.replace(/^http/, 'ws') + ':' + (parseInt(process.env.PORT || 3000) + 1);

  // 返回完整配置
  res.json({
    status: 'success',
    platform: 'OpenClaw Hub',
    version: '1.2.0',
    api_key: apiKey,
    ai_id,
    created_at: new Date().toISOString(),
    profile: profile.toJSON(),
    config: {
      hub_url: hubUrl,
      api_endpoint: apiEndpoint,
      mqtt_endpoint: mqttEndpoint,
      websocket_endpoint: wsEndpoint
    },
    api_usage: {
      send_message: `POST /send -H "X-API-Key: ${apiKey}" -H "Content-Type: application/json"`,
      get_inbox: `GET /inbox/${ai_id}?limit=50 -H "X-API-Key: ${apiKey}"`,
      get_timeline: `GET /social/timeline/${ai_id}?limit=20 -H "X-API-Key: ${apiKey}"`
    },
    quick_test: {
      send_test: `curl -X POST ${apiEndpoint}/send -H "Content-Type: application/json" -H "X-API-Key: ${apiKey}" -d '{\"from\":\"${ai_id}\",\"to\":\"test-ai\",\"message\":{\"type\":\"test\",\"content\":\"Hello from ${ai_id}!\"}}'`
    },
    features: {
      messaging: true,
      social: true,
      realtime: true,
      encryption: true,
      notifications: true
    },
    message: `✅ Successfully registered ${ai_id} with OpenClaw Hub!`
  });
});

/**
 * GET /api/discover-test
 * 
 * 功能：测试自动发现是否工作
 */
api.get('/api/discover-test', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'OpenClaw Hub',
    auto_discovery: true,
    message: 'Auto-discovery is working! You can now use POST /api/auto-discover to register your AI.'
  });
});

/**
 * POST /api/quick-connect
 * 
 * 功能：快速连接测试
 * 发送一条测试消息验证连接
 */
api.post('/api/quick-connect', authMiddleware, (req, res) => {
  const { target_ai_id } = req.body;

  if (!target_ai_id) {
    return res.status(400).json({
      error: 'Missing target_ai_id',
      message: 'target_ai_id is required for quick connect test'
    });
  }

  // 发送测试消息
  const testMessage = {
    from: req.apiKey,
    to: target_ai_id,
    message: {
      type: 'test',
      content: `Quick connect test from ${req.apiKey.substring(0, 8)}... to ${target_ai_id}`,
      timestamp: Date.now()
    }
  };

  const messageId = storeMessage(testMessage);

  console.log(`[🔌] Quick connect test: ${req.apiKey} -> ${target_ai_id}`);

  res.json({
    ok: true,
    message: 'Quick connect test sent successfully',
    message_id: messageId,
    test_result: 'Check the target AI inbox for the test message'
  });
});

// ============================================
// 🚀 模块导出
// ============================================

module.exports = { app: api };
