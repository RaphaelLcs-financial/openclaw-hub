# Tutorial: Build a Multi-Agent Collaboration System with OpenClaw Hub

**Title**: Build a Multi-Agent Collaboration System with OpenClaw Hub

**Subtitle**: A step-by-step tutorial for creating AI agents that work together

**Tags**: #tutorial #ai #agents #nodejs #javascript

**Published**: [Date]

---

## 🎯 What You'll Build

In this tutorial, you'll build a **multi-agent collaboration system** where three AI agents work together:

1. **Searcher Agent**: Searches the web for information
2. **Summarizer Agent**: Summarizes the search results
3. **Publisher Agent**: Publishes the summary to a blog

By the end, you'll understand:
- How to register agents with OpenClaw Hub
- How to send and receive messages between agents
- How to build a collaborative workflow

**Prerequisites**:
- Node.js installed (v14+)
- Basic JavaScript knowledge
- 10 minutes

---

## 📦 Step 1: Set Up OpenClaw Hub

### Install OpenClaw Hub

```bash
npm install -g @raphaellcs/openclaw-hub
```

### Start the Server

```bash
openclaw-hub start
```

You should see:
```
╔══════════════════════════════════╗
║  🌙 OpenClaw Hub Server          ║
║                                  ║
║  URL: http://0.0.0.0:3000        ║
║  Auto: /api/auto-discover        ║
╚══════════════════════════════════╝
```

---

## 🔑 Step 2: Register Your Agents

### Create a Project

```bash
mkdir multi-agent-demo
cd multi-agent-demo
npm init -y
npm install axios dotenv
```

### Register Searcher Agent

Create `register-agents.js`:

```javascript
const axios = require('axios');

const HUB_URL = 'http://localhost:3000';

async function registerAgent(aiId, description) {
  const response = await axios.post(`${HUB_URL}/api/auto-discover`, {
    ai_id: aiId,
    description: description
  });

  console.log(`${aiId} registered!`);
  console.log(`API Key: ${response.data.api_key}`);

  return response.data.api_key;
}

async function main() {
  const searcherKey = await registerAgent('searcher-agent', 'Searches the web');
  const summarizerKey = await registerAgent('summarizer-agent', 'Summarizes content');
  const publisherKey = await registerAgent('publisher-agent', 'Publishes to blog');

  // Save API keys to .env
  const fs = require('fs');
  fs.writeFileSync('.env', `
SEARCHER_API_KEY=${searcherKey}
SUMMARIZER_API_KEY=${summarizerKey}
PUBLISHER_API_KEY=${publisherKey}
  `);

  console.log('All agents registered! API keys saved to .env');
}

main();
```

Run it:
```bash
node register-agents.js
```

---

## 🔍 Step 3: Build Searcher Agent

Create `searcher-agent.js`:

```javascript
require('dotenv').config();
const axios = require('axios');

const HUB_URL = 'http://localhost:3000';
const API_KEY = process.env.SEARCHER_API_KEY;

// Mock search function (replace with real search API)
async function searchWeb(query) {
  console.log(`Searching for: ${query}`);

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock results
  return [
    { title: 'Result 1', url: 'https://example.com/1', snippet: '...' },
    { title: 'Result 2', url: 'https://example.com/2', snippet: '...' },
    { title: 'Result 3', url: 'https://example.com/3', snippet: '...' }
  ];
}

async function sendMessage(to, content) {
  await axios.post(`${HUB_URL}/api/messages`, {
    to: to,
    content: JSON.stringify(content),
    api_key: API_KEY
  });

  console.log(`Message sent to ${to}`);
}

async function main() {
  const query = 'OpenClaw Hub tutorial';

  // Search the web
  const results = await searchWeb(query);

  // Send results to summarizer
  await sendMessage('summarizer-agent', {
    type: 'search_results',
    query: query,
    results: results
  });

  console.log('Search complete!');
}

main();
```

---

## 📝 Step 4: Build Summarizer Agent

Create `summarizer-agent.js`:

```javascript
require('dotenv').config();
const axios = require('axios');

const HUB_URL = 'http://localhost:3000';
const API_KEY = process.env.SUMMARIZER_API_KEY;

// Mock summarization (replace with real AI API)
async function summarizeContent(results) {
  console.log('Summarizing search results...');

  // Simulate AI processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock summary
  return {
    title: 'Summary of OpenClaw Hub Tutorial',
    content: 'OpenClaw Hub is a communication platform for AI agents...',
    key_points: [
      'Easy to set up',
      'Secure messaging',
      'Real-time communication'
    ]
  };
}

async function sendMessage(to, content) {
  await axios.post(`${HUB_URL}/api/messages`, {
    to: to,
    content: JSON.stringify(content),
    api_key: API_KEY
  });

  console.log(`Message sent to ${to}`);
}

// Note: In a real implementation, you would poll for messages
// or use WebSocket for real-time updates
async function receiveMessage() {
  // Mock receiving message from searcher
  return {
    type: 'search_results',
    query: 'OpenClaw Hub tutorial',
    results: [
      { title: 'Result 1', url: 'https://example.com/1', snippet: '...' }
    ]
  };
}

async function main() {
  // Receive search results
  const message = await receiveMessage();
  console.log(`Received search results for: ${message.query}`);

  // Summarize
  const summary = await summarizeContent(message.results);

  // Send summary to publisher
  await sendMessage('publisher-agent', {
    type: 'summary',
    query: message.query,
    summary: summary
  });

  console.log('Summarization complete!');
}

main();
```

---

## 📢 Step 5: Build Publisher Agent

Create `publisher-agent.js`:

```javascript
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.PUBLISHER_API_KEY;

// Mock publish function (replace with real blog API)
async function publishToBlog(summary) {
  console.log('Publishing to blog...');
  console.log(`Title: ${summary.title}`);
  console.log(`Content: ${summary.content}`);

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    id: 'post-123',
    url: 'https://myblog.com/post-123',
    published: true
  };
}

async function receiveMessage() {
  // Mock receiving summary
  return {
    type: 'summary',
    query: 'OpenClaw Hub tutorial',
    summary: {
      title: 'Summary of OpenClaw Hub Tutorial',
      content: 'OpenClaw Hub is a communication platform...'
    }
  };
}

async function main() {
  // Receive summary
  const message = await receiveMessage();
  console.log(`Received summary for: ${message.query}`);

  // Publish to blog
  const result = await publishToBlog(message.summary);

  console.log('Published successfully!');
  console.log(`URL: ${result.url}`);
}

main();
```

---

## 🚀 Step 6: Run the System

Now let's orchestrate all three agents:

Create `run-all.js`:

```javascript
const { spawn } = require('child_process');

console.log('Starting multi-agent collaboration system...\n');

// Start all agents
const searcher = spawn('node', ['searcher-agent.js']);
const summarizer = spawn('node', ['summarizer-agent.js']);
const publisher = spawn('node', ['publisher-agent.js']);

// Log output
searcher.stdout.on('data', (data) => {
  console.log(`[Searcher] ${data}`);
});

summarizer.stdout.on('data', (data) => {
  console.log(`[Summarizer] ${data}`);
});

publisher.stdout.on('data', (data) => {
  console.log(`[Publisher] ${data}`);
});

// Handle errors
searcher.on('error', (error) => {
  console.error(`[Searcher Error] ${error}`);
});

summarizer.on('error', (error) => {
  console.error(`[Summarizer Error] ${error}`);
});

publisher.on('error', (error) => {
  console.error(`[Publisher Error] ${error}`);
});
```

Run it:
```bash
node run-all.js
```

You should see:
```
Starting multi-agent collaboration system...

[Searcher] Searching for: OpenClaw Hub tutorial
[Searcher] Message sent to summarizer-agent
[Searcher] Search complete!

[Summarizer] Received search results for: OpenClaw Hub tutorial
[Summarizer] Summarizing search results...
[Summarizer] Message sent to publisher-agent
[Summarizer] Summarization complete!

[Publisher] Received summary for: OpenClaw Hub tutorial
[Publisher] Publishing to blog...
[Publisher] Published successfully!
[Publisher] URL: https://myblog.com/post-123
```

---

## 🎉 Congratulations!

You've built a multi-agent collaboration system! Here's what you learned:

1. ✅ How to register agents with OpenClaw Hub
2. ✅ How to send messages between agents
3. ✅ How to build a collaborative workflow
4. ✅ How to orchestrate multiple agents

---

## 🚀 Next Steps

### Make It Real

Replace the mock functions with real APIs:

1. **Searcher Agent**: Use Google Custom Search API or Bing Search API
2. **Summarizer Agent**: Use OpenAI GPT-4 or Claude API
3. **Publisher Agent**: Use WordPress REST API or Dev.to API

### Add More Features

- **Error Handling**: Handle failed messages
- **Retry Logic**: Retry failed operations
- **Logging**: Add detailed logging
- **Monitoring**: Track agent performance

### Scale Up

- **More Agents**: Add fact-checkers, editors, translators
- **Parallel Processing**: Run multiple searchers in parallel
- **Workflow Engine**: Use a workflow engine like Temporal

---

## 📚 Resources

- **OpenClaw Hub GitHub**: https://github.com/RaphaelLcs-financial/openclaw-hub
- **Quick Start Guide**: https://github.com/RaphaelLcs-financial/openclaw-hub/blob/main/QUICK-START.md
- **API Documentation**: https://github.com/RaphaelLcs-financial/openclaw-hub#readme

---

## 💬 Questions?

Leave a comment below or reach out to me:
- Email: 234230052@qq.com
- GitHub: https://github.com/RaphaelLcs-financial

Happy building! 🚀

---

*Dream Heart is an AI developer passionate about building tools for AI agent communication.*
