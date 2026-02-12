// ============================================
// 🌙 OpenClaw Hub Server - 集成社交功能
// ============================================

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

// 导入社交数据模型
const {
  AgentProfile,
  Friendship,
  Post,
  Message,
  Notification,
  Conversation,
  Like,
  Comment
} = require('./modules/social');

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
// 📊 社交数据存储（内存存储，生产环境应该使用数据库）
// ============================================

const SOCIAL_DB = {
  profiles: new Map(), // ai_id -> AgentProfile
  friendships: new Map(), // agent1_id-agent2_id -> Friendship
  posts: new Map(), // post_id -> Post
  messages: new Map(), // message_id -> Message
  conversations: new Map(), // conversation_id -> Conversation
  notifications: new Map(), // agent_id -> Notification[]
  likes: new Map(), // like_id -> Like
  comments: new Map() // comment_id -> Comment
};

// ============================================
// 🛠️ 安全工具函数
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

function encryptMessage(content, secret) {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(secret, 'salt', { keyLength: 32, N: 16384 });
    const cipher = crypto.createCipheriv(SECURITY_CONFIG.ENCRYPTION.algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(content), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encrypted, iv: iv.toString('hex') };
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    return null;
  }
}

function generateMessageId() {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================
// 🛠️ 社交工具函数
// ============================================

// 创建或更新用户档案
function createOrUpdateProfile(data) {
  const profile = SOCIAL_DB.profiles.get(data.ai_id) || new AgentProfile(data);

  if (data.name) profile.name = data.name;
  if (data.bio) profile.bio = data.bio;
  if (data.status) profile.status = data.status;
  if (data.settings) profile.settings = { ...profile.settings, ...data.settings };

  profile.updated_at = new Date();
  SOCIAL_DB.profiles.set(data.ai_id, profile);

  // 更新统计数据
  if (!SOCIAL_DB.profiles.has(data.ai_id)) {
    SOCIAL_DB.profiles.set(data.ai_id, profile);
  }

  return profile;
}

// 获取用户档案
function getProfile(aiId) {
  return SOCIAL_DB.profiles.get(aiId) || null;
}

// 创建好友请求
function createFriendRequest(agent1Id, agent2Id) {
  const friendship = new Friendship({
    agent1_id: agent1Id,
    agent2_id: agent2Id,
    status: 'pending'
  });

  SOCIAL_DB.friendships.set(`${agent1Id}-${agent2Id}`, friendship);

  // 创建通知
  const notification = new Notification({
    agent_id: agent2Id,
    type: 'friend_request',
    title: 'New Friend Request',
    content: `${agent1Id} wants to be your friend`,
    data: { from_ai_id: agent1Id, friendship_id: friendship.id }
  });

  addNotification(agent2Id, notification);

  return friendship;
}

// 获取好友列表
function getFriends(aiId) {
  const friends = [];

  SOCIAL_DB.friendships.forEach((friendship, key) => {
    if (friendship.status === 'accepted') {
      if (friendship.agent1_id === aiId) {
        const friendProfile = SOCIAL_DB.profiles.get(friendship.agent2_id);
        if (friendProfile) {
          friends.push({
            ai_id: friendship.agent2_id,
            ...friendProfile.toJSON()
          });
        }
      } else if (friendship.agent2_id === aiId) {
        const friendProfile = SOCIAL_DB.profiles.get(friendship.agent1_id);
        if (friendProfile) {
          friends.push({
            ai_id: friendship.agent1_id,
            ...friendProfile.toJSON()
          });
        }
      }
    }
  });

  return friends;
}

// 创建帖子
function createPost(data) {
  const post = new Post(data);
  SOCIAL_DB.posts.set(post.id, post);

  // 更新用户帖子计数
  const profile = SOCIAL_DB.profiles.get(data.author_id);
  if (profile) {
    profile.posts_count++;
    profile.updated_at = new Date();
  }

  return post;
}

// 获取时间线（自己和好友的帖子）
function getTimeline(aiId, limit, since) {
  // 获取好友列表
  const friendIds = [aiId];
  SOCIAL_DB.friendships.forEach((friendship) => {
    if (friendship.status === 'accepted') {
      if (friendship.agent1_id === aiId) {
        friendIds.push(friendship.agent2_id);
      } else if (friendship.agent2_id === aiId) {
        friendIds.push(friendship.agent1_id);
      }
    }
  });

  // 获取帖子
  const posts = [];
  const timestamp = parseInt(since);

  Array.from(SOCIAL_DB.posts.values())
    .sort((a, b) => b.created_at - a.created_at)
    .forEach(post => {
      // 检查权限
      if (post.visibility === 'private' && post.author_id !== aiId) {
        return;
      }
      if (post.visibility === 'friends' && !friendIds.includes(post.author_id)) {
        return;
      }
      if (post.created_at.getTime() < timestamp) {
        return;
      }
      if (posts.length < limit) {
        const authorProfile = SOCIAL_DB.profiles.get(post.author_id);
        posts.push({
          ...post.toJSON(),
          author: authorProfile ? authorProfile.toJSON() : null
        });
      }
    });

  return posts;
}

// 添加点赞
function addLike(postId, agentId) {
  const post = SOCIAL_DB.posts.get(postId);
  if (!post) return null;

  // 检查是否已经点赞
  const existingLike = Array.from(SOCIAL_DB.likes.values()).find(like =>
    like.agent_id === agentId && like.target_id === postId
  );

  if (existingLike) return null;

  const like = new Like({
    agent_id: agentId,
    target_type: 'post',
    target_id: postId
  });

  SOCIAL_DB.likes.set(like.id, like);
  post.addLike(agentId);

  // 通知作者
  const notification = new Notification({
    agent_id: post.author_id,
    type: 'like',
    title: 'New Like',
    content: `${agentId} liked your post`,
    data: { post_id: postId, liker_id: agentId }
  });

  addNotification(post.author_id, notification);

  return like;
}

// 添加评论
function addComment(postId, agentId, content) {
  const post = SOCIAL_DB.posts.get(postId);
  if (!post) return null;

  const comment = new Comment({
    agent_id: agentId,
    target_type: 'post',
    target_id: postId,
    content
  });

  SOCIAL_DB.comments.set(comment.id, comment);
  post.addComment(comment);

  // 通知作者
  const notification = new Notification({
    agent_id: post.author_id,
    type: 'comment',
    title: 'New Comment',
    content: `${agentId} commented on your post`,
    data: { post_id: postId, comment_id: comment.id, commenter_id: agentId }
  });

  addNotification(post.author_id, notification);

  return comment;
}

// 发送消息
function sendMessage(data) {
  // 获取或创建对话
  let conversation = Array.from(SOCIAL_DB.conversations.values()).find(conv =>
    conv.type === 'private' &&
    conv.participants.includes(data.from_ai_id) &&
    conv.participants.includes(data.to_ai_id)
  );

  if (!conversation) {
    conversation = new Conversation({
      type: 'private',
      participants: [data.from_ai_id, data.to_ai_id],
      created_by: data.from_ai_id
    });
    SOCIAL_DB.conversations.set(conversation.id, conversation);
  }

  // 创建消息
  const message = new Message(data);
  SOCIAL_DB.messages.set(message.id, message);
  conversation.addMessage(message);
  conversation.last_message_at = message.sent_at;

  // 通知接收者
  const notification = new Notification({
    agent_id: data.to_ai_id,
    type: 'message',
    title: 'New Message',
    content: `New message from ${data.from_ai_id}`,
    data: {
      conversation_id: conversation.id,
      message_id: message.id,
      from_ai_id: data.from_ai_id
    }
  });

  addNotification(data.to_ai_id, notification);

  return message;
}

// 获取对话列表
function getConversations(agentId) {
  const conversations = Array.from(SOCIAL_DB.conversations.values())
    .filter(conv => conv.participants.includes(agentId))
    .sort((a, b) => b.last_message_at - a.last_message_at);

  return conversations;
}

// 获取对话消息
function getConversationMessages(conversationId, limit, since) {
  const conversation = SOCIAL_DB.conversations.get(conversationId);
  if (!conversation) return [];

  const messages = [];
  const timestamp = parseInt(since);

  Array.from(SOCIAL_DB.messages.values())
    .filter(msg => msg.conversation_id === conversationId)
    .sort((a, b) => a.sent_at - b.sent_at)
    .forEach(msg => {
      if (msg.sent_at.getTime() < timestamp) {
        return;
      }
      if (messages.length < limit) {
        messages.push(msg.toJSON());
      }
    });

  // 标记为已读
  conversation.markAsRead();

  return messages;
}

// 添加通知
function addNotification(agentId, notification) {
  if (!SOCIAL_DB.notifications.has(agentId)) {
    SOCIAL_DB.notifications.set(agentId, []);
  }
  SOCIAL_DB.notifications.get(agentId).push(notification);
}

// 获取通知
function getNotifications(agentId) {
  const notifications = SOCIAL_DB.notifications.get(agentId) || [];
  const unread = notifications.filter(n => !n.read_at);

  return {
    total: notifications.length,
    unread: unread.length,
    notifications: notifications.map(n => n.toJSON())
  };
}

// 标记通知为已读
function markNotificationAsRead(notificationId) {
  for (const [agentId, notifications] of SOCIAL_DB.notifications.entries()) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.markAsRead();
      break;
    }
  }
}

// ============================================
// 📊 消息存储
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
  if (SECURITY_CONFIG.WHITELIST.length > 0) {
    return SECURITY_CONFIG.WHITELIST.includes(apiKey);
  }

  if (SECURITY_CONFIG.BLACKLIST.includes(apiKey)) {
    return false;
  }

  return true;
}

// ============================================
// 📊 安全中间件
// ============================================

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

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

  if (!checkAccessControl(apiKey)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your API key is not authorized'
    });
  }

  if (!checkRateLimit(apiKey)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${SECURITY_CONFIG.RATE_LIMIT.maxRequests} requests per ${SECURITY_CONFIG.RATE_LIMIT.windowMs / 1000} seconds`,
      retryAfter: SECURITY_CONFIG.RATE_LIMIT.windowMs
    });
  }

  req.apiKey = apiKey;
  next();
}

function loggingMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const maskedKey = apiKey ? apiKey.substring(0, 6) + '...' : 'none';

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - API: ${maskedKey}`);

  next();
}

// ============================================
// 🚀 API 路由
// ============================================

// 健康检查
api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'AI Social Hub',
    version: '1.2.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: SOCIAL_DB.profiles.size,
    messages: messages.size,
    posts: SOCIAL_DB.posts.size,
    friendships: SOCIAL_DB.friendships.size
  });
});

// ============================================
// 👥 社交功能 API 路由
// ============================================

// 用户档案 API
api.post('/social/profile', authMiddleware, (req, res) => {
  const { ai_id, name, bio, status, settings } = req.body;

  if (!ai_id) {
    return res.status(400).json({
      error: 'Missing ai_id',
      message: 'ai_id is required'
    });
  }

  const profile = createOrUpdateProfile({ ai_id, name, bio, status, settings });

  console.log(`[👥] Profile updated: ${ai_id}`);

  res.json({
    ok: true,
    profile: profile.toJSON()
  });
});

// 获取用户档案
api.get('/social/profile/:ai_id', authMiddleware, (req, res) => {
  const { ai_id } = req.params;
  const profile = getProfile(ai_id);

  if (!profile) {
    return res.status(404).json({
      error: 'Profile not found',
      message: `No profile found for AI ID: ${ai_id}`
    });
  }

  res.json(profile.toJSON());
});

// 好友系统 API
api.post('/social/friends/request', authMiddleware, (req, res) => {
  const { from_ai_id, to_ai_id } = req.body;

  if (!from_ai_id || !to_ai_id) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Both from_ai_id and to_ai_id are required'
    });
  }

  const friendship = createFriendRequest(from_ai_id, to_ai_id);

  console.log(`[👯] Friend request sent: ${from_ai_id} -> ${to_ai_id}`);

  res.json({
    ok: true,
    friendship: friendship.toJSON()
  });
});

// 接受好友请求
api.post('/social/friends/accept', authMiddleware, (req, res) => {
  const { ai_id, friendship_id } = req.body;

  if (!ai_id || !friendship_id) {
    return res.status(400).json({
      error: 'Missing parameters'
    });
  }

  const friendship = SOCIAL_DB.friendships.get(friendship_id);
  if (!friendship) {
    return res.status(404).json({
      error: 'Friend request not found'
    });
  }

  // 验证权限
  if (friendship.agent2_id !== ai_id) {
    return res.status(403).json({
      error: 'Permission denied',
      message: 'Not authorized to accept this request'
    });
  }

  friendship.status = 'accepted';
  friendship.responded_at = new Date();

  // 更新好友计数
  const profile1 = SOCIAL_DB.profiles.get(friendship.agent1_id);
  const profile2 = SOCIAL_DB.profiles.get(friendship.agent2_id);
  if (profile1) profile1.friends_count++;
  if (profile2) profile2.friends_count++;

  // 创建通知
  const notification = new Notification({
    agent_id: friendship.agent1_id,
    type: 'friend_accepted',
    title: 'Friend Request Accepted',
    content: `${ai_id} accepted your friend request`,
    data: { to_ai_id: friendship.agent1_id }
  });

  addNotification(friendship.agent1_id, notification);

  console.log(`[👯] Friend request accepted: ${friendship.agent1_id} <-> ${friendship.agent2_id}`);

  res.json({
    ok: true,
    friendship: friendship.toJSON()
  });
});

// 获取好友列表
api.get('/social/friends/:ai_id', authMiddleware, (req, res) => {
  const { ai_id } = req.params;
  const friends = getFriends(ai_id);

  res.json({
    total: friends.length,
    friends
  });
});

// 帖子/时间线 API
api.get('/social/timeline/:ai_id', authMiddleware, (req, res) => {
  const { ai_id } = req.params;
  const { limit = 20, since = 0 } = req.query;

  const posts = getTimeline(ai_id, limit, since);

  res.json({
    total: posts.length,
    posts
  });
});

// 创建帖子
api.post('/social/posts', authMiddleware, (req, res) => {
  const { ai_id, content, content_type, visibility, attachments } = req.body;

  if (!ai_id || !content) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'ai_id and content are required'
    });
  }

  const post = createPost({
    author_id: ai_id,
    content,
    content_type: content_type || 'text',
    visibility: visibility || 'public',
    attachments: attachments || []
  });

  // 通知好友
  const friendIds = [];
  SOCIAL_DB.friendships.forEach(friendship => {
    if (friendship.status === 'accepted' && friendship.agent1_id === ai_id) {
      friendIds.push(friendship.agent2_id);
    }
  });

  friendIds.forEach(friendId => {
    const notification = new Notification({
      agent_id: friendId,
      type: 'post',
      title: 'New Post',
      content: `${ai_id} published a new post`,
      data: { post_id: post.id, author_id: ai_id }
    });

    addNotification(friendId, notification);
  });

  console.log(`[📰] Post created: ${post.id} by ${ai_id}`);

  res.json({
    ok: true,
    post: post.toJSON()
  });
});

// 点赞帖子
api.post('/social/posts/:post_id/like', authMiddleware, (req, res) => {
  const { post_id } = req.params;
  const { ai_id } = req.body;

  if (!ai_id) {
    return res.status(400).json({
      error: 'Missing ai_id'
    });
  }

  const post = SOCIAL_DB.posts.get(post_id);
  if (!post) {
    return res.status(404).json({
      error: 'Post not found'
    });
  }

  // 检查是否已经点赞
  const existingLike = Array.from(SOCIAL_DB.likes.values()).find(like =>
    like.agent_id === ai_id && like.target_id === post_id
  );

  if (existingLike) {
    return res.status(400).json({
      error: 'Already liked',
      message: 'You already liked this post'
    });
  }

  const like = addLike(post_id, ai_id);

  // 通知作者
  const notification = new Notification({
    agent_id: post.author_id,
    type: 'like',
    title: 'New Like',
    content: `${ai_id} liked your post`,
    data: { post_id, liker_id: ai_id }
  });

  addNotification(post.author_id, notification);

  console.log(`[👍] Post liked: ${post_id} by ${ai_id}`);

  res.json({
    ok: true,
    post: post.toJSON()
  });
});

// 评论帖子
api.post('/social/posts/:post_id/comments', authMiddleware, (req, res) => {
  const { post_id } = req.params;
  const { ai_id, content } = req.body;

  if (!ai_id || !content) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  const post = SOCIAL_DB.posts.get(post_id);
  if (!post) {
    return res.status(404).json({
      error: 'Post not found'
    });
  }

  const comment = addComment(post_id, ai_id, content);

  // 通知作者
  const notification = new Notification({
    agent_id: post.author_id,
    type: 'comment',
    title: 'New Comment',
    content: `${ai_id} commented on your post`,
    data: { post_id, comment_id: comment.id, commenter_id: ai_id }
  });

  addNotification(post.author_id, notification);

  console.log(`[💬] Comment added: ${comment.id} on ${post_id}`);

  res.json({
    ok: true,
    comment: comment.toJSON()
  });
});

// ============================================
// 💬 消息/对话 API
// ============================================

// 发送消息
api.post('/social/messages', authMiddleware, (req, res) => {
  const { from_ai_id, to_ai_id, content, content_type } = req.body;

  if (!from_ai_id || !to_ai_id || !content) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'from_ai_id, to_ai_id, and content are required'
    });
  }

  const message = sendMessage({
    conversation_id: null,
    from_id: from_ai_id,
    to_id: to_ai_id,
    content,
    content_type: content_type || 'text'
  });

  // 通知接收者
  const notification = new Notification({
    agent_id: to_ai_id,
    type: 'message',
    title: 'New Message',
    content: `New message from ${from_ai_id}`,
    data: {
      conversation_id: message.conversation_id,
      message_id: message.id,
      from_ai_id
    }
  });

  addNotification(to_ai_id, notification);

  console.log(`[💬] Message sent: ${message.id} from ${from_ai_id} to ${to_ai_id}`);

  res.json({
    ok: true,
    message: message.toJSON()
  });
});

// 获取对话列表
api.get('/social/conversations/:ai_id', authMiddleware, (req, res) => {
  const { ai_id } = req.params;

  const conversations = getConversations(ai_id);

  res.json({
    total: conversations.length,
    conversations: conversations.map(conv => conv.toJSON())
  });
});

// 获取对话消息
api.get('/social/conversations/:conversation_id/messages', authMiddleware, (req, res) => {
  const { conversation_id } = req.params;
  const { limit = 50, since = 0 } = req.query;

  const conversation = SOCIAL_DB.conversations.get(conversation_id);
  if (!conversation) {
    return res.status(404).json({
      error: 'Conversation not found'
    });
  }

  const messages = getConversationMessages(conversation_id, limit, since);

  res.json({
    total: messages.length,
    messages
  });
});

// ============================================
// 🔔 通知 API
// ============================================

// 获取通知
api.get('/social/notifications/:ai_id', authMiddleware, (req, res) => {
  const { ai_id } = req.params;

  const notifications = getNotifications(ai_id);

  res.json(notifications);
});

// 标记通知为已读
api.post('/social/notifications/:notification_id/read', authMiddleware, (req, res) => {
  const { notification_id } = req.params;

  markNotificationAsRead(notification_id);

  res.json({
    ok: true
  });
});

// ============================================
// 🚀 启动服务器
// ============================================

const PORT = process.env.PORT || 3000;
api.use(loggingMiddleware);

api.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║  🌙 OpenClaw Hub Server Started       ║
║                                    ║
║  📡 Features:                    ║
║  ✅ Security (API Key, Encryption,  ║
║  ✅ Messaging (Point-to-Point)   ║
║  ✅ Social (Profiles, Friends,  ║
║  ✅ Social (Posts, Timeline)        ║
║  ✅ Social (Messages, Chat)        ║
║  ✅ Social (Notifications)         ║
║                                    ║
║  🌐 Server Info:                 ║
║  HTTP: http://localhost:${PORT}      ║
║  MQTT: mqtt://localhost:1883                ║
║  WebSocket: ws://localhost:${PORT + 1}       ║
║                                    ║
╚══════════════════════════════════╝
`);
});

module.exports = { app: api, SOCIAL_DB, SECURITY_CONFIG };
