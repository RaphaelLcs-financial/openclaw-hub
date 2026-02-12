const aedes = require('aedes');
const mqtt = require('mqtt');

const broker = aedes();
const mqttServer = mqtt.createServer({ port: 1883 }, broker);

// 统计
let messageCount = 0;
let agentCount = 0;

broker.on('client', (client) => {
  agentCount++;
  console.log(`[+] Agent connected: ${client.id}`);
});

broker.on('clientDisconnect', (client) => {
  console.log(`[-] Agent disconnected: ${client.id}`);
  agentCount--;
});

broker.on('publish', (packet, client) => {
  messageCount++;
  console.log(`[📤] ${packet.topic} -> ${packet.payload.toString().substring(0, 50)}`);
});

const wsPort = 8083;
const wsServer = mqtt.createServer({ port: wsPort }, broker);

console.log(`OpenClaw MQTT Broker running:
  - MQTT: mqtt://192.168.31.83:1883
  - WebSocket: ws://192.168.31.83:${wsPort}
`);

// 简单的 API Gateway 集成
const http = require('http');
const { parse } = require('querystring');

const api = express();
api.use(require('body-parser').json());

// 消息队列
const queue = [];

// 接收 Gateway 的消息
api.post('/gateway/send', (req, res) => {
  const { topic, payload } = req.body;
  queue.push({ topic, payload });
  res.json({ ok: true, queued: queue.length });
});

// 处理队列中的消息（每秒批量发送）
setInterval(() => {
  if (queue.length === 0) return;
  
  const batch = queue.splice(0, 100); // 每次最多 100 条
  batch.forEach(({ topic, payload }) => {
    broker.publish(topic, Buffer.from(JSON.stringify(payload)));
  });
  
  console.log(`[📤] Sent ${batch.length} messages`);
}, 1000);

api.listen(3001, () => console.log(`API Gateway on port 3001`);
