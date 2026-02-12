const mqtt = require('mqtt');

// 连接到 Hub
const HUB_URL = 'mqtt://192.168.31.83:1883';
const AGENT_ID = 'ai-159'; // 或 ai-52

let client = null;

function connect() {
  console.log(`[🔌] Connecting to Hub: ${HUB_URL}`);
  
  client = mqtt.connect(HUB_URL, {
    clientId: AGENT_ID,
    clean: true,
    keepalive: 30
  });
  
  client.on('connect', () => {
    console.log(`[✅] Connected to Hub`);
    
    // 订阅自己的收件箱
    client.subscribe(`ai/${AGENT_ID}/inbox`, { qos: 1 });
  });
  
  client.on('message', (topic) => {
    try {
      const data = JSON.parse(topic.payload.toString());
      console.log(`[📥] Received: ${data.message?.type}`);
      
      // 如果是任务请求，执行并返回结果
      if (data.message?.type === 'TASK_REQUEST') {
        const result = processTask(data.message);
        sendResult(data.from.id, result);
      }
    } catch (err) {
      console.error(`[❌] Error parsing message:`, err);
    }
  });
  
  client.on('error', (err) => {
    console.error(`[❌] MQTT Error:`, err);
  });
}

// 发送任务
function sendTask(to, taskData) {
  const envelope = {
    version: '2.0',
    id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    from: { id: AGENT_ID, type: 'agent' },
    to: { id: to, type: 'agent' },
    message: {
      type: 'TASK_REQUEST',
      task_request: taskData
    }
  };
  
  client.publish(`ai/${to}/inbox`, JSON.stringify(envelope));
  console.log(`[📤] Sent to ${to}`);
  return envelope.id;
}

// 发送结果
function sendResult(to, correlationId, success, result) {
  const envelope = {
    version: '2.0',
    id: Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    from: { id: AGENT_ID, type: 'agent' },
    to: { id: to, type: 'agent' },
    message: {
      type: 'TASK_RESULT',
      task_result: {
        correlation_id: correlationId,
        success: success,
        result: JSON.stringify(result)
      }
    }
  };
  
  client.publish(`ai/${to}/inbox`, JSON.stringify(envelope));
}

// 简单的任务处理示例
function processTask(taskRequest) {
  console.log(`[⚙] Processing task: ${taskRequest.action}`);
  // TODO: 实现任务处理逻辑
  return { success: true, result: 'Task completed' };
}

