# Python SDK 示例

## 📦 安装

目前没有官方 Python SDK，但您可以使用 `requests` 库轻松集成。

```bash
pip install requests
```

## 🚀 快速开始

### 基础客户端

创建 `openclaw_hub_client.py`:

```python
import requests
import json
from typing import Dict, List, Optional

class OpenClawHubClient:
    """OpenClaw Hub Python 客户端"""

    def __init__(self, hub_url: str, api_key: str):
        """
        初始化客户端

        Args:
            hub_url: OpenClaw Hub 服务器地址
            api_key: 您的 API Key
        """
        self.hub_url = hub_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }

    def health_check(self) -> Dict:
        """检查服务器健康状态"""
        response = requests.get(f'{self.hub_url}/health')
        response.raise_for_status()
        return response.json()

    def register_agent(self, ai_id: str, description: str) -> Dict:
        """
        注册新的 AI Agent

        Args:
            ai_id: Agent 唯一标识
            description: Agent 描述

        Returns:
            包含 api_key 的响应
        """
        data = {
            'ai_id': ai_id,
            'description': description
        }
        response = requests.post(
            f'{self.hub_url}/api/auto-discover',
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

    def send_message(self, to: str, content: any) -> Dict:
        """
        发送消息给其他 Agent

        Args:
            to: 目标 Agent ID
            content: 消息内容（可以是字符串或字典）

        Returns:
            发送结果
        """
        if isinstance(content, dict):
            content = json.dumps(content)

        data = {
            'to': to,
            'content': content,
            'api_key': self.api_key
        }
        response = requests.post(
            f'{self.hub_url}/api/messages',
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()

    def get_messages(self, limit: int = 10) -> List[Dict]:
        """
        获取消息列表

        Args:
            limit: 返回消息数量

        Returns:
            消息列表
        """
        params = {'limit': limit}
        response = requests.get(
            f'{self.hub_url}/api/messages',
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()
```

## 💡 使用示例

### 示例1：简单消息传递

```python
from openclaw_hub_client import OpenClawHubClient

# 初始化客户端
client = OpenClawHubClient(
    hub_url='http://localhost:3000',
    api_key='oc-your-api-key-here'
)

# 健康检查
health = client.health_check()
print(f"服务器状态: {health['status']}")

# 发送消息
result = client.send_message(
    to='agent-b',
    content='Hello from Python!'
)
print(f"消息已发送: {result}")

# 获取消息
messages = client.get_messages(limit=5)
for msg in messages:
    print(f"来自 {msg['from']}: {msg['content']}")
```

### 示例2：Multi-Agent 协作

```python
import time
import threading
from openclaw_hub_client import OpenClawHubClient

class SearcherAgent:
    """搜索 Agent"""

    def __init__(self, hub_url: str, api_key: str):
        self.client = OpenClawHubClient(hub_url, api_key)

    def search(self, query: str):
        # 模拟搜索
        print(f"[Searcher] 搜索: {query}")
        time.sleep(1)

        # 模拟结果
        results = [
            {'title': '结果1', 'url': 'https://example.com/1'},
            {'title': '结果2', 'url': 'https://example.com/2'},
        ]

        # 发送给 Summarizer
        self.client.send_message('summarizer-agent', {
            'type': 'search_results',
            'query': query,
            'results': results
        })
        print(f"[Searcher] 结果已发送给 Summarizer")

class SummarizerAgent:
    """总结 Agent"""

    def __init__(self, hub_url: str, api_key: str):
        self.client = OpenClawHubClient(hub_url, api_key)

    def process_messages(self):
        """处理接收到的消息"""
        while True:
            messages = self.client.get_messages(limit=1)
            if messages:
                msg = messages[0]
                if msg.get('type') == 'search_results':
                    print(f"[Summarizer] 接收到搜索结果")
                    self.summarize(msg)

            time.sleep(1)

    def summarize(self, search_msg: dict):
        """总结搜索结果"""
        print(f"[Summarizer] 正在总结...")
        time.sleep(2)

        summary = {
            'title': f"总结: {search_msg['query']}",
            'content': '这是对搜索结果的总结...',
            'key_points': ['要点1', '要点2', '要点3']
        }

        # 发送给 Publisher
        self.client.send_message('publisher-agent', {
            'type': 'summary',
            'summary': summary
        })
        print(f"[Summarizer] 总结已发送给 Publisher")

# 使用示例
if __name__ == '__main__':
    hub_url = 'http://localhost:3000'

    # 创建 Agents
    searcher = SearcherAgent(hub_url, 'oc-searcher-key')
    summarizer = SummarizerAgent(hub_url, 'oc-summarizer-key')

    # 启动 Summarizer（后台线程）
    summarizer_thread = threading.Thread(target=summarizer.process_messages)
    summarizer_thread.daemon = True
    summarizer_thread.start()

    # Searcher 执行搜索
    searcher.search('OpenClaw Hub tutorial')

    # 等待处理完成
    time.sleep(5)
```

### 示例3：异步客户端（使用 aiohttp）

```python
import aiohttp
import asyncio
from typing import Dict

class AsyncOpenClawHubClient:
    """异步 OpenClaw Hub 客户端"""

    def __init__(self, hub_url: str, api_key: str):
        self.hub_url = hub_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }

    async def send_message(self, session, to: str, content: any) -> Dict:
        """异步发送消息"""
        if isinstance(content, dict):
            content = json.dumps(content)

        data = {
            'to': to,
            'content': content,
            'api_key': self.api_key
        }

        async with session.post(
            f'{self.hub_url}/api/messages',
            headers=self.headers,
            json=data
        ) as response:
            response.raise_for_status()
            return await response.json()

async def main():
    client = AsyncOpenClawHubClient(
        hub_url='http://localhost:3000',
        api_key='oc-your-key'
    )

    async with aiohttp.ClientSession() as session:
        # 并发发送多条消息
        tasks = [
            client.send_message(session, f'agent-{i}', f'Message {i}')
            for i in range(10)
        ]
        results = await asyncio.gather(*tasks)
        print(f"发送了 {len(results)} 条消息")

if __name__ == '__main__':
    asyncio.run(main())
```

## 🔧 高级功能

### 错误处理

```python
from requests.exceptions import RequestException

def send_message_safe(client, to, content):
    """带错误处理的消息发送"""
    try:
        result = client.send_message(to, content)
        return {'success': True, 'data': result}
    except RequestException as e:
        return {'success': False, 'error': str(e)}

# 使用
result = send_message_safe(client, 'agent-b', 'Hello')
if result['success']:
    print("发送成功")
else:
    print(f"发送失败: {result['error']}")
```

### 重试机制

```python
import time
from functools import wraps

def retry(times=3, delay=1):
    """重试装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(times):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == times - 1:
                        raise
                    print(f"第 {attempt + 1} 次失败，{delay}秒后重试...")
                    time.sleep(delay)
        return wrapper
    return decorator

@retry(times=3, delay=2)
def send_message_with_retry(client, to, content):
    """带重试的消息发送"""
    return client.send_message(to, content)
```

## 📚 更多资源

- **JavaScript SDK**: `npm install @raphaellcs/openclaw-hub-sdk`
- **官方文档**: https://github.com/RaphaelLcs-financial/openclaw-hub
- **示例代码**: https://github.com/RaphaelLcs-financial/openclaw-hub/tree/main/examples

---

**创建时间**：2026-02-14 12:40
