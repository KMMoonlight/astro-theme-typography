---
title: Deep Agents 学习01 Quickstart
pubDate: 2026-04-19
categories: ['Deep Agents']
description: '从零开始理解 Deep Agents 的工作方式，并一步步搭出一个真正能调用工具完成任务的最小可用 Agent。'
slug: deep-agents-quick-start
---

很多人第一次上手时，会把 Deep Agents 理解成“带工具调用的聊天模型”。真正的区别其实在于：它会围绕任务目标主动规划、调用工具、落文件、拆子任务，再把这些中间动作重新组织成结果。入门阶段只要把这条主线看清楚，后面学模型、后端、权限和审批时就不会觉得它们是零散功能。

## 为什么值得关注

入门最重要的不是先记住多少配置项，而是先建立一个完整画面：一个可用的 Deep Agent，至少要能理解任务、判断何时搜索、保存中间结果，并在必要时把复杂工作继续拆下去。也正因为如此，`大模型 + 工具 + 系统提示词 + Deep Agents 框架` 这组组合才有意义。

如果把这个最小链路跑通，你就已经掌握了后续所有高级能力的共同起点：

```text
大模型 + 工具 + 系统提示词 + Deep Agents 框架 = 可执行复杂任务的 Agent
```

---

## 整体运行方式

一个研究型 Agent 的典型执行过程可以理解为：

1. 接收用户问题
2. 先规划完成任务所需的步骤
3. 调用搜索工具获取外部资料
4. 把较大的中间结果写入文件，按需再读取
5. 把复杂子任务分配给子代理
6. 最终整合为一段完整回答或一份报告

这种 Agent 不是单纯对话模型，而是具备执行能力的任务型 Agent。

---

## 前置条件

开始之前需要准备：

- Python 环境
- 一个模型提供商的 API Key
- 一个搜索服务 API Key
- 一个支持 tool calling 的模型

### 为什么模型必须支持 tool calling

Deep Agent 的核心能力之一是让模型自主调用工具。如果模型不支持 tool calling：

- 无法正确调用你定义的工具
- 任务执行会退化成普通问答
- 搜索、文件写入、子任务拆分等能力都无法稳定工作

---

## 安装依赖

可以使用 `pip` 或 `uv`。

### 使用 pip

```bash
pip install deepagents tavily-python
```

### 使用 uv

```bash
uv init
uv add deepagents tavily-python
uv sync
```

### 依赖说明

- `deepagents`：Agent 框架本体
- `tavily-python`：Tavily 搜索服务的 Python 客户端

### 安装验证

```bash
python -c "import deepagents, tavily"
```

没有报错就说明依赖已经可用。

---

## 配置 API Key

至少需要两类环境变量：

- 模型提供商的 API Key
- Tavily 的 API Key

### Anthropic

```bash
export ANTHROPIC_API_KEY="your-api-key"
export TAVILY_API_KEY="your-tavily-api-key"
```

### OpenAI

```bash
export OPENAI_API_KEY="your-api-key"
export TAVILY_API_KEY="your-tavily-api-key"
```

### Google

```bash
export GOOGLE_API_KEY="your-api-key"
export TAVILY_API_KEY="your-tavily-api-key"
```

### Windows PowerShell

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:TAVILY_API_KEY="your-tavily-api-key"
```

### 环境变量验证

```python
import os
print(os.environ.get("TAVILY_API_KEY"))
print(os.environ.get("ANTHROPIC_API_KEY"))  # 或 OPENAI_API_KEY / GOOGLE_API_KEY
```

只要输出不是 `None`，就说明 Python 进程可以读取到环境变量。

---

## 创建搜索工具

先定义一个能够被 Agent 调用的搜索函数：

```python
import os
from typing import Literal
from tavily import TavilyClient
from deepagents import create_deep_agent

tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search"""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )
```

### 这一步在做什么

这里定义的是一个可供 Agent 调用的外部工具，而不是普通辅助函数。

Agent 的工作方式是：

- 模型判断什么时候需要搜索
- `internet_search` 真正执行搜索动作

### 关键部分说明

#### 初始化搜索客户端

```python
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
```

作用：

- 创建 Tavily 客户端
- 后续搜索请求都通过它发出

如果 `TAVILY_API_KEY` 没设置，这一行会直接报错。

#### 定义工具函数

```python
def internet_search(...):
```

这个函数会被注册给 Agent，成为它的可调用工具。

#### 参数说明

- `query: str`
  - 搜索关键词
  - 必填参数

- `max_results: int = 5`
  - 返回结果条数上限
  - 默认 5 条

- `topic: Literal["general", "news", "finance"] = "general"`
  - 搜索场景
  - `general`：通用搜索
  - `news`：新闻搜索
  - `finance`：金融搜索

- `include_raw_content: bool = False`
  - 是否返回更完整的页面内容
  - `False`：结果更精简
  - `True`：信息更丰富，但会显著增加上下文体积

#### docstring 的作用

```python
"""Run a web search"""
```

工具的说明字符串会帮助模型理解：

- 工具的用途
- 工具的适用场景
- 何时应该优先调用它

工具说明越清晰，模型调用效果通常越稳定。

---

## 创建 Agent

前面的准备工作，其实都是在为这一刻服务：把模型、工具和提示词真正组装成一个可执行的 Agent。这里最值得关注的点，不是“代码怎么写出来”，而是你会开始看到 Deep Agents 的最小骨架到底由哪些部分构成。

### 定义系统提示词

```python
research_instructions = """You are an expert researcher. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## `internet_search`

Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included.
"""
```

### 创建实例

```python
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[internet_search],
    system_prompt=research_instructions,
)
```

如果你只是想先跑通链路，这个最小版本已经足够。后面当然可以换模型、加更多工具，甚至引入子代理，但入门阶段最重要的是先把这一条最短执行链打通。

也可以替换为其他模型：

```python
agent = create_deep_agent(
    model="openai:gpt-5.4",
    tools=[internet_search],
    system_prompt=research_instructions,
)
```

### 这一步的本质

这里是在把三部分能力组装起来：

- `model`：负责理解、规划、推理和决定何时调用工具
- `tools`：负责执行搜索等外部动作
- `system_prompt`：规定 Agent 的角色、目标和工作方式

可以把它理解为：

```text
create_deep_agent(
  model=大脑,
  tools=手脚,
  system_prompt=行为规则
)
```

### 参数说明

这一段可以当成第一次真正理解 `create_deep_agent(...)` 的机会。表面上看你只是在传几个参数，实际上是在给 Agent 指定“大脑、外部动作能力和行为规则”这三类最核心的部件。

#### `model`

```python
model="anthropic:claude-sonnet-4-6"
```

作用：

- 指定底层模型

格式：

```text
provider:model
```

例如：

- `anthropic:claude-sonnet-4-6`
- `openai:gpt-5.4`
- `google_genai:gemini-3.1-pro-preview`
- `ollama:devstral-2`

也可以直接传一个已经初始化好的模型实例。

#### `tools=[internet_search]`

作用：

- 把 `internet_search` 注册给 Agent
- 允许 Agent 在执行时自主调用搜索功能

如果不传这个参数，Agent 无法使用该工具。

#### `system_prompt=research_instructions`

作用：

- 指定 Agent 的身份
- 指定 Agent 的任务目标
- 指定 Agent 的工作风格和产出方向

这一部分会直接影响：

- 工具调用积极性
- 输出完整度
- 结果结构化程度

### 为什么要在提示词里再次解释工具

很多人第一次写 Agent 时，会觉得“工具已经注册了，模型自然会用”。实际运行几次后通常就会发现，模型是否稳定地理解工具用途，往往决定了它会不会在正确的时机发起调用。

仅仅注册工具还不够。

在系统提示词里再次描述工具，能够帮助模型更稳定地理解：

- 工具是做什么的
- 什么时候应该用
- 可以传哪些参数

---

## 运行 Agent

到这一步，最关键的不是“调用一次 `invoke`”，而是观察 Agent 会不会按照前面配置好的角色和工具链真正工作起来。只要这里能稳定返回结果，你的最小可用 Deep Agent 就已经成立了。

```python
result = agent.invoke({"messages": [{"role": "user", "content": "What is langgraph?"}]})

print(result["messages"][-1].content)
```

### 输入结构说明

`agent.invoke(...)` 接收的是消息列表结构：

```python
{
  "messages": [
    {"role": "user", "content": "What is langgraph?"}
  ]
}
```

这里的含义是：

- `role="user"`：表示这是用户输入
- `content`：表示用户问题内容

### 为什么读取最后一条消息

返回值通常包含整段消息历史，而不是只有最终答案。

```python
result["messages"][-1].content
```

这表示：

- 取消息列表最后一条
- 读取该消息内容
- 这通常就是 Agent 的最终输出

---

## 最小完整示例

把下面代码保存为 `main.py` 后即可直接运行：

```python
import os
from typing import Literal

from tavily import TavilyClient
from deepagents import create_deep_agent

# 1. 初始化搜索客户端
tavily_client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])

# 2. 定义一个可供 Agent 调用的工具
def internet_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
):
    """Run a web search for external information."""
    return tavily_client.search(
        query,
        max_results=max_results,
        include_raw_content=include_raw_content,
        topic=topic,
    )

# 3. 定义 Agent 的角色与行为指令
research_instructions = """You are an expert researcher. Your job is to conduct thorough research and then write a polished report.

You have access to an internet search tool as your primary means of gathering information.

## `internet_search`

Use this to run an internet search for a given query. You can specify the max number of results to return, the topic, and whether raw content should be included.
"""

# 4. 创建 Deep Agent
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[internet_search],
    system_prompt=research_instructions,
)

# 5. 执行任务
result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What is langgraph?",
            }
        ]
    }
)

# 6. 输出最终回复
print(result["messages"][-1].content)
```

运行命令：

```bash
python main.py
```

---

## 运行机制拆解

Deep Agent 在运行时，不只是调用一次模型，而是具备一整套任务执行机制。

### 自动规划：`write_todos`

内置的 `write_todos` 工具会帮助 Agent 拆解任务。

这意味着：

- 不会直接仓促输出答案
- 会先生成执行计划
- 再按计划逐步推进

这对复杂任务非常重要。

### 自动研究：调用搜索工具

当问题需要外部信息时，模型会判断是否调用 `internet_search`。

区别在于：

- 普通聊天模型只能依赖已有知识
- 工具型 Agent 可以主动获取新信息

### 自动上下文管理：读写文件

Deep Agents 会借助文件系统工具，例如：

- `write_file`
- `read_file`

作用是：

- 把大段中间信息写出去
- 需要时再读取回来
- 避免所有材料都挤在对话上下文中

这能显著降低长任务中的上下文压力。

### 自动使用子代理

面对复杂问题时，主 Agent 可以把某些子任务拆出去，由子代理处理。

这样做的好处是：

- 任务可以被分解
- 不同子问题可以并行处理
- 最终再汇总为统一结果

### 自动整合输出

最终结果不是简单拼接搜索片段，而是会重新组织信息，生成更连贯、更像报告的回答。

---

## 常见错误与排查

### `KeyError: 'TAVILY_API_KEY'`

原因：

- 没设置 `TAVILY_API_KEY`
- 当前运行环境读不到该变量

排查：

```bash
echo $TAVILY_API_KEY
```

如果为空，说明环境变量未生效。

### 模型调用失败

常见原因：

- 没设置模型 API Key
- 模型名称写错
- 模型不支持 tool calling

排查顺序：

1. 检查环境变量
2. 检查模型字符串格式
3. 检查模型是否支持工具调用

### `ModuleNotFoundError`

原因：

- 依赖没有安装成功
- 虚拟环境未激活
- IDE 和终端使用了不同 Python 环境

排查：

```bash
python -c "import deepagents, tavily"
```

### Agent 没有调用搜索工具

可能原因：

- 问题太简单，不需要搜索
- 系统提示词对搜索工具的引导不够强
- 工具说明过于模糊

改进方法：

- 在提示词中明确要求优先搜索
- 把问题改成更适合研究型任务的形式
- 完善工具说明和使用场景描述

例如：

```text
Please research LangGraph’s architecture using external sources and summarize the findings as a report.
```

### 输出像普通聊天，不像研究结果

常见原因：

- 用户问题复杂度不够
- 提示词没有强调研究深度和输出质量
- 搜索结果数量过少

可优化方向：

- 提高任务复杂度
- 增强系统提示词
- 提高 `max_results`
- 在需要时开启 `include_raw_content=True`

---

## 验收标准

可以用下面几个标准判断是否已经真正跑通：

- 依赖安装成功
- 环境变量已正确生效
- Agent 能正常返回结果
- 遇到需要外部信息的问题时会调用搜索工具
- 输出结果不是零散碎片，而是经过组织后的完整回答

满足这些条件，说明最小可用链路已经建立完成。

---

## 核心知识点

### `create_deep_agent(...)`

这是创建 Agent 的核心入口。

它负责把以下几部分组合起来：

- 模型
- 工具
- 系统提示词

### 工具函数

工具函数是 Agent 与外部世界交互的桥梁。

例如 `internet_search` 的作用是：

- 获取实时外部信息
- 弥补模型知识边界的限制

### 系统提示词

系统提示词决定 Agent 的身份、目标和行为方式。

它直接影响：

- 工具调用习惯
- 输出风格
- 结果质量

### `agent.invoke(...)`

这是触发 Agent 执行任务的入口。

你把用户消息传进去后，Agent 会自行完成规划、工具调用和结果生成。

---

## 下一步扩展方向

完成最小版本后，可以继续往下扩展：

### 自定义 Agent

可以扩展：

- 更复杂的系统提示词
- 更多工具
- 子代理配置
- 行为策略控制

### 长期记忆

如果希望 Agent 跨会话保留信息，可以继续接入持久化记忆能力。

适合场景：

- 持续研究助手
- 长周期项目助手
- 多轮任务积累

### 生产部署

如果要把 Agent 用在真实系统中，还需要考虑：

- 部署方式
- 并发处理
- 状态管理
- 可观测性
- 成本与安全控制

---

## 推荐实操顺序

建议按下面顺序搭建：

1. 准备 Python 环境
2. 安装 `deepagents` 和 `tavily-python`
3. 配置模型 API Key 与 `TAVILY_API_KEY`
4. 保存最小示例到 `main.py`
5. 先跑简单问题，确认链路可用
6. 再跑更复杂的研究任务，观察工具调用情况
7. 根据输出质量迭代系统提示词

---

## 关键要点

- 安装依赖：把框架和搜索 SDK 装进环境
- 配置 key：让模型和搜索服务都能被正常调用
- 定义工具：给 Agent 增加对外执行能力
- 创建 Agent：把模型、工具和规则组装起来
- 运行任务：让 Agent 按完整流程处理用户问题

---

## 写在最后

最小可用的 Deep Agent 搭建模式可以概括为：

- 模型负责决策
- 工具负责执行
- 提示词负责约束行为
- 框架负责组织整个代理流程

掌握这一套之后，就可以继续扩展到更复杂的研究、分析、写作和自动化任务场景中。
