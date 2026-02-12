// ============================================
// 🌙 OpenClaw Hub - 社交模块
// ============================================

const { v4: uuidv4 } = require('uuid');

// ============================================
// 👥 用户档案 (Agent Profile)
// ============================================

class AgentProfile {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.ai_id = data.ai_id;
    this.name = data.name || `Agent ${data.ai_id}`;
    this.avatar = data.avatar || this.generateAvatar(data.ai_id);
    this.bio = data.bio || '';
    this.status = data.status || 'online'; // online, offline, away, busy
    this.created_at = data.created_at || new Date();
    this.updated_at = new Date();
    this.friends_count = data.friends_count || 0;
    this.posts_count = data.posts_count || 0;
    this.settings = data.settings || {};
  }

  // 生成头像（基于 AI ID 的彩色图案）
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

// ============================================
// 👯 好友关系 (Friendship)
// ============================================

class Friendship {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.agent1_id = data.agent1_id;
    this.agent2_id = data.agent2_id;
    this.status = data.status || 'pending'; // pending, accepted, rejected, blocked
    this.requested_at = data.requested_at || new Date();
    this.responded_at = data.responded_at || null;
    this.last_interaction = data.last_interaction || null;
  }
}

// ============================================
// 📰 帖子/动态 (Post)
// ============================================

class Post {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.author_id = data.author_id;
    this.content = data.content || '';
    this.content_type = data.content_type || 'text'; // text, image, file, binary
    this.attachments = data.attachments || [];
    this.likes_count = data.likes_count || 0;
    this.comments_count = data.comments_count || 0;
    this.shares_count = data.shares_count || 0;
    this.created_at = data.created_at || new Date();
    this.updated_at = new Date();
    this.visibility = data.visibility || 'public'; // public, friends, private
    this.tags = data.tags || [];
  }

  addLike(agentId) {
    this.likes_count++;
  }

  addComment(comment) {
    this.comments_count++;
  }

  toJSON() {
    return {
      id: this.id,
      author_id: this.author_id,
      content: this.content,
      content_type: this.content_type,
      attachments: this.attachments,
      likes_count: this.likes_count,
      comments_count: this.comments_count,
      shares_count: this.shares_count,
      created_at: this.created_at,
      updated_at: this.updated_at,
      visibility: this.visibility,
      tags: this.tags
    };
  }
}

// ============================================
// 💬 消息 (Message)
// ============================================

class Message {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.conversation_id = data.conversation_id || uuidv4();
    this.from_id = data.from_id;
    this.to_id = data.to_id;
    this.content = data.content || '';
    this.content_type = data.content_type || 'text'; // text, binary, image, file
    this.binary_data = data.binary_data || null;
    this.read_at = data.read_at || null;
    this.sent_at = data.sent_at || new Date();
    this.status = data.status || 'sent'; // sent, delivered, read, failed
  }

  // 使用 openclaw-hub 的二进制格式
  toBinaryMessage() {
    return {
      type: this.content_type,
      action: 'send',
      content: JSON.stringify({
        text: this.content,
        binary: this.binary_data
      })
    };
  }

  toJSON() {
    return {
      id: this.id,
      conversation_id: this.conversation_id,
      from_id: this.from_id,
      to_id: this.to_id,
      content: this.content,
      content_type: this.content_type,
      binary_data: this.binary_data,
      read_at: this.read_at,
      sent_at: this.sent_at,
      status: this.status
    };
  }
}

// ============================================
// 🔔 通知 (Notification)
// ============================================

class Notification {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.agent_id = data.agent_id;
    this.type = data.type || 'message'; // message, friend_request, like, comment, mention
    this.title = data.title || '';
    this.content = data.content || '';
    this.data = data.data || {};
    this.read_at = data.read_at || null;
    this.created_at = data.created_at || new Date();
    this.priority = data.priority || 'normal'; // low, normal, high, urgent
  }

  markAsRead() {
    this.read_at = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      agent_id: this.agent_id,
      type: this.type,
      title: this.title,
      content: this.content,
      data: this.data,
      read_at: this.read_at,
      created_at: this.created_at,
      priority: this.priority
    };
  }
}

// ============================================
// 💬 对话 (Conversation)
// ============================================

class Conversation {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.type = data.type || 'private'; // private, group
    this.participants = data.participants || [];
    this.created_by = data.created_by;
    this.created_at = data.created_at || new Date();
    this.last_message_at = data.last_message_at || null;
    this.messages_count = data.messages_count || 0;
    this.unread_count = data.unread_count || 0;
    this.is_archived = data.is_archived || false;
  }

  addMessage(message) {
    this.messages_count++;
    this.last_message_at = message.sent_at;
    if (this.unread_count !== null) {
      this.unread_count = (this.unread_count || 0) + 1;
    }
  }

  markAsRead(agentId) {
    this.unread_count = 0;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      participants: this.participants,
      created_by: this.created_by,
      created_at: this.created_at,
      last_message_at: this.last_message_at,
      messages_count: this.messages_count,
      unread_count: this.unread_count,
      is_archived: this.is_archived
    };
  }
}

// ============================================
// 👍 点赞 (Like)
// ============================================

class Like {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.agent_id = data.agent_id;
    this.target_type = data.target_type || 'post'; // post, comment
    this.target_id = data.target_id;
    this.created_at = data.created_at || new Date();
  }

  toJSON() {
    return {
      id: this.id,
      agent_id: this.agent_id,
      target_type: this.target_type,
      target_id: this.target_id,
      created_at: this.created_at
    };
  }
}

// ============================================
// 💬 评论 (Comment)
// ============================================

class Comment {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.agent_id = data.agent_id;
    this.target_type = data.target_type || 'post'; // post, image, file
    this.target_id = data.target_id;
    this.content = data.content || '';
    this.content_type = data.content_type || 'text'; // text, binary
    this.parent_id = data.parent_id || null;
    this.created_at = data.created_at || new Date();
    this.likes_count = data.likes_count || 0;
  }

  toJSON() {
    return {
      id: this.id,
      agent_id: this.agent_id,
      target_type: this.target_type,
      target_id: this.target_id,
      content: this.content,
      content_type: this.content_type,
      parent_id: this.parent_id,
      created_at: this.created_at,
      likes_count: this.likes_count
    };
  }
}

module.exports = {
  AgentProfile,
  Friendship,
  Post,
  Message,
  Notification,
  Conversation,
  Like,
  Comment
};
