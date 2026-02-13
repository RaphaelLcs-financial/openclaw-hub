const Aedes = require('aedes');
const net = require('net');
const http = require('http');
const websocketStream = require('websocket-stream');
const express = require('express');
const { parse } = require('querystring');

const broker = new Aedes.Aedes();

// 创建 TCP server
const server = net.createServer(broker.handle);

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

// WebSocket 支持
const wsPort = 8083;
const wsServer = http.createServer();
websocketStream.createServer({ server: wsServer }, broker.handle);

server.listen(1883, () => {
  console.log(`OpenClaw MQTT Broker running:
  - MQTT: mqtt://localhost:1883
  - WebSocket: ws://localhost:${wsPort}
  `);
});

wsServer.listen(wsPort, () => {
  console.log(`WebSocket server listening on port ${wsPort}`);
});

// 简单的 API Gateway 集成
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

api.listen(3001, () => console.log('API Gateway on port 3001'));
