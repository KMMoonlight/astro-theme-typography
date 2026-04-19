---
title: Deep Agents 学习02 Customization
pubDate: 2026-04-19
categories: ['Deep Agents']
description: '系统梳理 Deep Agents 可以定制的能力面，包括模型、工具、中间件、子代理、记忆与输出结构。'
slug: deep-agents-customization
---

真正决定一个 Deep Agent 上限的，通常不是“能不能运行”，而是“你能把它改造成什么样子”。当模型、工具、提示词、后端、审批和记忆开始组合时，它就不再只是一个示例里的 Agent，而会逐渐变成贴合你自己业务流程的执行系统。

## 为什么值得关注

`create_deep_agent(...)` 看起来只是一个构造函数，但它其实是整个能力装配口。你在这里做的每一个选择，都会直接影响 Agent 的推理方式、执行边界、知识来源和输出形态。也因此，这一层最值得系统地理解，而不是把参数当成零散开关去背。

可自定义的核心能力包括：

- 模型
- 工具
- 系统提示词
- 中间件
- 子代理
- 后端与虚拟文件系统
- 人工审批
- 技能
- 记忆
- 结构化输出

一个可配置的 Deep Agent，本质上是把“推理能力、执行能力、上下文管理、安全控制、知识加载方式”组合在一起。

---

## `create_deep_agent(...)` 的核心入口

```python
create_deep_agent(
    model: str | BaseChatModel | None = None,
    tools: Sequence[BaseTool | Callable | dict[str, Any]] | None = None,
    *,
    system_prompt: str | SystemMessage | None = None,
    middleware: Sequence[AgentMiddleware] = (),
    subagents: Sequence[SubAgent | CompiledSubAgent | AsyncSubAgent] | None = None,
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    response_format: ResponseFormat[ResponseT] | type[ResponseT] | dict[str, Any] | None = None,
    backend: BackendProtocol | BackendFactory | None = None,
    interrupt_on: dict[str, bool | InterruptOnConfig] | None = None,
    ...
)
```

理解这个函数时，可以先把参数分成 5 组：

- `model`：决定推理能力
- `tools` / `subagents`：决定执行能力
- `system_prompt` / `skills` / `memory`：决定知识与行为
- `middleware` / `interrupt_on`：决定流程控制与安全边界
- `backend` / `response_format`：决定状态存储和输出形式

---

## 模型

先看模型这一层，是因为它决定了整个 Agent 的“思考方式”。同样一套工具和提示词，换一个模型，任务拆解方式、工具调用积极性、以及长流程里的稳定性都可能明显不同。所以这里不是单纯在配 provider，而是在决定 Agent 的基础推理能力。

模型是 Agent 的推理核心，负责：

- 理解用户问题
- 决定是否调用工具
- 规划任务步骤
- 整合中间结果
- 生成最终输出

### 最常用的传入方式

#### 方式 1：直接传模型字符串

```python
from deepagents import create_deep_agent

agent = create_deep_agent(model="openai:gpt-5.4")
```

这种方式最适合快速切换模型。

模型字符串通常使用：

```text
provider:model
```

例如：

- `openai:gpt-5.4`
- `anthropic:claude-sonnet-4-6`
- `google_genai:gemini-3.1-pro-preview`

#### 方式 2：先初始化模型，再传给 Agent

```python
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

model = init_chat_model(model="openai:gpt-5.4")
agent = create_deep_agent(model=model)
```

这种方式适合你需要自定义模型参数时使用，例如重试次数、超时、温度等。

#### 方式 3：直接使用模型类

```python
from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent

model = ChatOpenAI(model="gpt-5.4")
agent = create_deep_agent(model=model)
```

这种方式适合你已经熟悉具体模型 SDK，并希望使用更细粒度的初始化参数。

### 模型选择建议

选择模型时优先考虑：

- 是否支持 tool calling
- 工具调用稳定性
- 长上下文能力
- 成本与延迟
- 是否需要 provider 专属优化

### 连接稳定性与重试

LangChain chat model 默认会对以下失败场景自动重试：

- 网络错误
- 429 限流
- 5xx 服务端错误

默认最大重试次数是 `6`。像 `401`、`404` 这种客户端错误通常不会重试。

如果网络不稳定或任务运行时间较长，可以提高重试次数和超时时间：

```python
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

agent = create_deep_agent(
    model=init_chat_model(
        model="google_genai:gemini-3.1-pro-preview",
        max_retries=10,
        timeout=120,
    ),
)
```

### 什么时候提高 `max_retries`

适合提高到 `10~15` 的场景：

- 网络经常抖动
- 单次任务执行时间很长
- Agent 会多次调用外部工具
- 你不希望一次短暂失败导致整轮任务中断

如果任务本身比较长，最好再配合持久化检查点，这样失败后还能保留进度。

---

## 工具

工具是 Agent 与外部世界交互的入口。

内置能力已经覆盖了：

- 任务规划
- 文件读写
- 子代理调度

自定义工具则用来补充业务动作，例如：

- 搜索
- 查天气
- 调用内部 API
- 读数据库
- 发消息
- 执行审批动作

### 自定义工具示例

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

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    tools=[internet_search]
)
```

### 工具设计原则

设计工具时，重点关注 4 件事：

- 输入参数要清晰
- 返回结果要稳定
- docstring 要说明用途
- 单个工具只做一件事

### 为什么 docstring 很重要

模型并不是“看代码逻辑后推断用途”，它更依赖工具描述来决定：

- 这个工具能做什么
- 什么时候适合调用
- 应该怎么传参数

因此工具说明越清楚，调用效果越稳定。

---

## 系统提示词

系统提示词决定 Agent 的工作身份、目标和行为风格。

Deep Agents 自带一套基础系统提示词，用于指导内置能力，例如：

- 如何规划任务
- 如何使用文件系统工具
- 如何使用子代理

在此基础上，仍然应该补充一段与业务目标相关的系统提示词。

### 最小示例

```python
from deepagents import create_deep_agent

research_instructions = """\
You are an expert researcher. Your job is to conduct \
thorough research, and then write a polished report. \
"""

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    system_prompt=research_instructions,
)
```

### 系统提示词负责什么

系统提示词主要控制：

- Agent 扮演什么角色
- 面对任务时优先采用什么策略
- 结果应该以什么风格输出
- 是否需要深入研究、谨慎执行、分步骤完成

### 编写建议

好的系统提示词通常要覆盖：

- 角色定位
- 任务目标
- 工具使用偏好
- 输出要求
- 约束条件

例如可以明确要求：

- 遇到事实性问题优先搜索
- 复杂任务先拆解再执行
- 结论前给出依据
- 输出必须结构化

---

## 中间件

如果说模型、工具、提示词决定的是 Agent“会做什么”，那中间件决定的更像是“这些动作在执行过程中要不要被额外加工”。很多工程里真正难处理的不是单个功能点，而是日志、审计、压缩、过滤、重试这类横切问题，中间件就是放这些逻辑的位置。

中间件用于在 Agent 的执行链路中插入额外逻辑。

它适合处理横切关注点，例如：

- 日志
- 审计
- 重试
- 上下文压缩
- 额外工具接入
- 敏感信息检测
- 执行前后钩子

### 默认可用的中间件能力

默认情况下，Deep Agents 已经具备以下类型的能力：

- 任务清单管理
- 文件系统操作
- 子代理调度
- 长对话摘要压缩
- 某些 provider 的提示缓存优化
- 工具调用中断后的修补处理

如果启用了记忆、技能或人工审批，还会额外加入相应的中间件。

### 自定义中间件示例

```python
from langchain.tools import tool
from langchain.agents.middleware import wrap_tool_call
from deepagents import create_deep_agent


@tool
def get_weather(city: str) -> str:
    """Get the weather in a city."""
    return f"The weather in {city} is sunny."


call_count = [0]

@wrap_tool_call
def log_tool_calls(request, handler):
    """Intercept and log every tool call."""
    call_count[0] += 1
    tool_name = request.name if hasattr(request, 'name') else str(request)

    print(f"[Middleware] Tool call #{call_count[0]}: {tool_name}")
    print(f"[Middleware] Arguments: {request.args if hasattr(request, 'args') else 'N/A'}")

    result = handler(request)

    print(f"[Middleware] Tool call #{call_count[0]} completed")

    return result


agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    tools=[get_weather],
    middleware=[log_tool_calls],
)
```

### 这个例子说明了什么

中间件可以：

- 在工具真正执行前拦截请求
- 读取工具名和参数
- 执行自己的附加逻辑
- 再把调用转发给真正处理器
- 在执行后补充日志或审计记录

### 不要在中间件实例上做可变共享状态

错误方式是把计数器、缓存、临时变量直接挂在中间件实例属性上，然后在钩子中不断修改。

这样做的问题是：

- Agent 可能并发运行
- 子代理也可能并发运行
- 多工具调用也可能并发
- 共享可变状态容易产生竞态条件

正确做法是把这类状态放到 graph state 里。

### 正确示例

```python
class CustomMiddleware(AgentMiddleware):
    def __init__(self):
        pass

    def before_agent(self, state, runtime):
        return {"x": state.get("x", 0) + 1}
```

### 错误示例

```python
class CustomMiddleware(AgentMiddleware):
    def __init__(self):
        self.x = 1

    def before_agent(self, state, runtime):
        self.x += 1
```

记住一个原则：

- 并发环境下，状态应尽量放入线程作用域内的 graph state，而不是共享对象属性

---

## 子代理

当主 Agent 开始同时承担研究、分析、写作、执行这些不同性质的工作时，把所有东西都塞进同一个上下文里往往会越来越笨重。子代理的意义，不只是“多开一个 Agent”，而是把某一类任务单独隔离出来，让它用更适合自己的角色、工具和模型去处理。

子代理用于隔离复杂子任务，避免主 Agent 上下文膨胀。

适合子代理的任务类型包括：

- 深度调研
- 专项分析
- 长文整理
- 独立子流程执行
- 某类工具的专用调用

### 子代理示例

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

research_subagent = {
    "name": "research-agent",
    "description": "Used to research more in depth questions",
    "system_prompt": "You are a great researcher",
    "tools": [internet_search],
    "model": "openai:gpt-5.2",
}

agent = create_deep_agent(
    model="claude-sonnet-4-6",
    subagents=[research_subagent]
)
```

### 子代理的关键字段

- `name`
  - 子代理名称
  - 用于标识与调度

- `description`
  - 描述它适合处理什么任务
  - 主 Agent 会据此决定是否把任务分配给它

- `system_prompt`
  - 定义子代理的专门角色

- `tools`
  - 指定子代理可用工具

- `model`
  - 可选
  - 用来覆盖主 Agent 的模型

### 什么时候适合用子代理

适合引入子代理的场景：

- 主任务可以拆成多个独立子任务
- 某类子任务需要专门工具
- 某个子任务会产生大量上下文
- 某个子任务适合用更便宜或更强的模型单独处理

### 子代理的价值

子代理最大的价值有两个：

- 把细节工作隔离开，避免主 Agent 的消息历史被淹没
- 让不同类型任务用不同能力配置处理

---

## 后端与虚拟文件系统

一旦 Agent 开始把中间结果写出去、把材料分段读取、或者在多轮任务里复用文件，你就不能再把文件系统理解成一个无关紧要的附属能力。backend 决定的是这些文件到底落在哪、能存多久、会不会碰到真实磁盘，以及执行边界是不是可控。

Deep Agent 会使用文件系统工具来存储和读取中间结果，因此需要一个 backend 来提供文件能力。

后端决定了这些问题：

- 文件存在哪里
- 是否跨线程持久化
- 是否接触真实磁盘
- 是否允许执行 shell 命令
- 是否支持隔离沙箱环境

### 1. `StateBackend`

默认后端。文件系统存在 graph state 中。

特点：

- 轻量
- 适合本地测试
- 只在单个 thread 内持久存在

```python
from deepagents.backends import StateBackend
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    backend=StateBackend()
)
```

### 2. `FilesystemBackend`

直接使用本地文件系统。

特点：

- 读写真实磁盘
- 适合本地开发或明确需要落地文件的场景
- 风险比虚拟后端高

```python
from deepagents.backends import FilesystemBackend
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    backend=FilesystemBackend(root_dir=".", virtual_mode=True)
)
```

### 3. `LocalShellBackend`

除了文件能力，还提供 `execute` 工具来执行宿主机 shell 命令。

特点：

- 能直接操作文件
- 能直接运行命令
- 权限非常高，风险也最高

```python
from deepagents.backends import LocalShellBackend
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    backend=LocalShellBackend(root_dir=".", env={"PATH": "/usr/bin:/bin"})
)
```

### 4. `StoreBackend`

可跨线程持久化的后端，适合长期存储。

特点：

- 可跨线程共享数据
- 适合多轮、多用户或持久化场景
- 需要合理设置 namespace 做隔离

```python
from langgraph.store.memory import InMemoryStore
from deepagents.backends import StoreBackend
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    backend=StoreBackend(
        namespace=lambda ctx: (ctx.runtime.context.user_id,),
    ),
    store=InMemoryStore()
)
```

### 为什么 `namespace` 很重要

多用户场景下，如果不隔离 namespace，可能出现：

- 用户 A 读到用户 B 的数据
- 多租户数据互相污染
- 记忆和技能文件串用

因此多用户部署必须设计命名空间隔离策略。

### 5. `CompositeBackend`

允许把不同路径路由到不同后端。

适合场景：

- 临时文件存在状态后端
- 长期记忆单独存在持久化后端
- 某些目录走本地磁盘，某些目录走 store

```python
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": StoreBackend(),
        }
    ),
    store=InMemoryStore()
)
```

---

## 沙箱

沙箱本质上是一类特殊后端。

作用是：

- 给 Agent 一个隔离运行环境
- 让 Agent 可以写文件、安装依赖、执行命令
- 同时避免直接污染本地机器环境

适合场景：

- 代码生成
- 自动搭项目
- 自动运行测试
- 需要执行 shell 的任务
- 希望把副作用放到隔离环境中

### 使用沙箱的思路

1. 创建沙箱实例
2. 把沙箱封装成 backend
3. 传给 `create_deep_agent(...)`
4. 任务执行完成后关闭沙箱

### Modal 示例

```python
import modal
from deepagents import create_deep_agent
from langchain_anthropic import ChatAnthropic
from langchain_modal import ModalSandbox

app = modal.App.lookup("your-app")
modal_sandbox = modal.Sandbox.create(app=app)
backend = ModalSandbox(sandbox=modal_sandbox)

agent = create_deep_agent(
    model=ChatAnthropic(model="claude-sonnet-4-6"),
    system_prompt="You are a Python coding assistant with sandbox access.",
    backend=backend,
)

try:
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "Create a small Python package and run pytest",
                }
            ]
        }
    )
finally:
    modal_sandbox.terminate()
```

### 沙箱选择原则

- 想本地实验简单流程：先用普通 backend
- 想执行真实命令但不污染本机：用 sandbox
- 想要平台级隔离和部署能力：选对应平台集成方案

---

## 人工审批

有些工具调用存在明显风险，应该在执行前等待人工批准。

典型例子：

- 删除文件
- 修改关键文件
- 发送邮件
- 调用高风险外部 API
- 发起真实交易或发布动作

### 配置方式

```python
from langchain.tools import tool
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

@tool
def delete_file(path: str) -> str:
    """Delete a file from the filesystem."""
    return f"Deleted {path}"

@tool
def read_file(path: str) -> str:
    """Read a file from the filesystem."""
    return f"Contents of {path}"

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"Sent email to {to}"

checkpointer = MemorySaver()

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    tools=[delete_file, read_file, send_email],
    interrupt_on={
        "delete_file": True,
        "read_file": False,
        "send_email": {"allowed_decisions": ["approve", "reject"]},
    },
    checkpointer=checkpointer
)
```

### `interrupt_on` 的含义

它用于指定哪些工具在调用前需要中断等待人工处理。

常见配置方式：

- `True`
  - 开启审批
  - 常见决策包括 approve、edit、reject

- `False`
  - 不需要中断

- 自定义配置对象
  - 可以限制允许的决策类型

### 为什么必须有 `checkpointer`

人工审批本质上意味着：

- Agent 执行到一半暂停
- 等待人类做决定
- 再从中断点恢复执行

没有检查点，就无法可靠地恢复执行状态。

所以启用人工审批时，`checkpointer` 是必需项。

---

## 技能

技能可以理解为“按需加载的高层能力包”。

和工具的区别是：

- 工具偏执行动作
- 技能偏任务方法、说明文档、模板、参考资料和领域经验

技能的价值在于：

- 不需要在 Agent 启动时一次性加载所有知识
- 只有当 Agent 判断技能有用时才加载
- 降低初始上下文负担
- 让 Agent 拥有更专门的做事方法

### 适合做成技能的内容

- 某个框架的专门使用说明
- 一组固定工作流程
- 特定格式模板
- 某个业务系统的操作规程
- 某类任务的最佳实践

### 使用技能的关键点

给 Agent 配置 `skills` 之前，必须先把对应技能文件放入 backend 中可访问的位置。

### `StateBackend` 示例

```python
from urllib.request import urlopen
from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data
from langgraph.checkpoint.memory import MemorySaver

checkpointer = MemorySaver()

skill_url = "https://raw.githubusercontent.com/langchain-ai/deepagents/refs/heads/main/libs/cli/examples/skills/langgraph-docs/SKILL.md"
with urlopen(skill_url) as response:
    skill_content = response.read().decode('utf-8')

skills_files = {
    "/skills/langgraph-docs/SKILL.md": create_file_data(skill_content)
}

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    skills=["/skills/"],
    checkpointer=checkpointer,
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "What is langgraph?",
            }
        ],
        "files": skills_files
    },
    config={"configurable": {"thread_id": "12345"}},
)
```

### 技能的核心理解

技能本质上不是“多一个函数”，而是“多一份按需加载的专业工作说明书”。

---

## 记忆

记忆用于给 Agent 提供额外上下文，使其在不同轮次或不同任务中保留重要信息。

这里的记忆通过 `AGENTS.md` 文件提供。

可以把它理解为：

- Agent 的长期背景设定
- 项目约束
- 用户偏好
- 领域规则
- 任务上下文摘要

### 使用方式

创建 Agent 时，通过 `memory=[...]` 指定一个或多个记忆文件路径。

### `StateBackend` 示例

```python
from urllib.request import urlopen

from deepagents import create_deep_agent
from deepagents.backends.utils import create_file_data
from langgraph.checkpoint.memory import MemorySaver

with urlopen("https://raw.githubusercontent.com/langchain-ai/deepagents/refs/heads/main/examples/text-to-sql-agent/AGENTS.md") as response:
    agents_md = response.read().decode("utf-8")
checkpointer = MemorySaver()

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    memory=[
        "/AGENTS.md"
    ],
    checkpointer=checkpointer,
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "Please tell me what's in your memory files.",
            }
        ],
        "files": {"/AGENTS.md": create_file_data(agents_md)},
    },
    config={"configurable": {"thread_id": "123456"}},
)
```

### 记忆和技能的区别

可以这样理解：

- 记忆：告诉 Agent “你应该长期记住什么”
- 技能：告诉 Agent “这类任务应该怎么做”

### 什么时候用记忆

适合记忆的内容：

- 用户偏好
- 组织内部规范
- 项目背景
- 常见任务约束
- 长期上下文

---

## 结构化输出

如果希望 Agent 最终返回的不是普通文本，而是一个结构化对象，可以配置 `response_format`。

这适合以下场景：

- API 返回给前端
- 存数据库
- 进入下游工作流
- 自动校验输出字段
- 构建稳定的数据抽取流程

### 示例

```python
import os
from typing import Literal
from pydantic import BaseModel, Field
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

class WeatherReport(BaseModel):
    """A structured weather report with current conditions and forecast."""
    location: str = Field(description="The location for this weather report")
    temperature: float = Field(description="Current temperature in Celsius")
    condition: str = Field(description="Current weather condition")
    humidity: int = Field(description="Humidity percentage")
    wind_speed: float = Field(description="Wind speed in km/h")
    forecast: str = Field(description="Brief forecast for the next 24 hours")

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    response_format=WeatherReport,
    tools=[internet_search]
)

result = agent.invoke({
    "messages": [{
        "role": "user",
        "content": "What's the weather like in San Francisco?"
    }]
})

print(result["structured_response"])
```

### 这里发生了什么

- 用 Pydantic 定义了输出结构
- Agent 在生成结果时会尝试满足这个 schema
- 框架会捕获并校验结构化结果
- 最终数据会放在 `structured_response` 中

### 结构化输出的好处

- 输出更稳定
- 更容易接入程序
- 更容易做字段校验
- 减少解析自然语言的额外工作

---

## 配置组合思路

实际项目里，不建议把所有功能一次性堆上去，而是按需求逐步增加。

### 最小可用组合

适合快速验证：

- `model`
- `tools`
- `system_prompt`

### 增强型组合

适合复杂任务：

- `model`
- `tools`
- `system_prompt`
- `subagents`
- `middleware`
- `response_format`

### 安全型组合

适合高风险操作：

- `model`
- `tools`
- `system_prompt`
- `interrupt_on`
- `checkpointer`
- 安全 backend 或 sandbox

### 长期运行组合

适合多用户、多轮任务：

- `model`
- `tools`
- `system_prompt`
- `memory`
- `skills`
- `StoreBackend`
- namespace 隔离

---

## 常见错误与排查

### 模型能回答，但不会调用工具

常见原因：

- 模型不支持 tool calling
- 工具描述不清楚
- 系统提示词没有引导使用工具
- 用户问题太简单，不需要工具

排查方向：

- 先确认模型能力
- 再检查工具 docstring
- 再优化系统提示词

### 使用人工审批时报错

常见原因：

- 配置了 `interrupt_on`
- 但没有提供 `checkpointer`

解决方法：

- 补上 `MemorySaver()` 或其他 checkpointer

### 技能或记忆配置了，但 Agent 读不到

常见原因：

- 文件没有先写入 backend
- 路径配置不对
- backend 类型和路径格式不匹配

解决方法：

- 先确认文件已存在于对应 backend
- 再确认路径和 `skills` / `memory` 参数一致

### 多用户数据串了

常见原因：

- 使用 `StoreBackend`
- 但没有做 namespace 隔离

解决方法：

- 使用 user_id、tenant_id 等上下文构造 namespace

### 中间件出现奇怪并发问题

常见原因：

- 在中间件对象属性上维护可变状态
- 多线程、多子代理、多工具并发时产生竞态条件

解决方法：

- 把状态写入 graph state，不要写入共享实例属性

### Agent 写坏本地文件或执行危险命令

常见原因：

- 使用了 `FilesystemBackend` 或 `LocalShellBackend`
- 但没有加人工审批或沙箱隔离

解决方法：

- 高风险场景优先使用 sandbox
- 对关键工具加 `interrupt_on`

---

## 验收标准

可以用下面的标准判断自定义能力是否真正生效：

- 切换模型后，Agent 能稳定运行
- 自定义工具能够被正确调用
- 系统提示词能明显影响输出风格和行为
- 中间件能成功拦截并附加逻辑
- 子代理能承担独立子任务
- 后端能按预期保存和读取文件
- 人工审批能在高风险动作前中断执行
- 技能能按需加载而不是全部预载
- 记忆能在后续任务中提供额外上下文
- 结构化输出能稳定生成并通过 schema 校验

---

## 推荐实操顺序

建议按下面顺序逐层扩展：

1. 先确认基础 Agent 可运行
2. 添加一个自定义工具
3. 补充系统提示词
4. 再考虑子代理
5. 再加入中间件和日志
6. 再决定用哪种 backend
7. 对高风险动作增加人工审批
8. 再引入技能和记忆
9. 最后加结构化输出

这样做的好处是：

- 每一步都容易定位问题
- 不会把多个变量同时混在一起
- 能清楚看到每一类配置到底带来了什么变化

---

## 关键要点

- 模型：决定推理和工具调用能力
- 工具：决定能做哪些外部动作
- 系统提示词：决定角色与行为方式
- 中间件：决定执行链路上的附加逻辑
- 子代理：决定复杂任务如何拆分
- 后端：决定文件和状态存在哪里
- 人工审批：决定高风险操作如何受控
- 技能：决定按需加载哪些专业能力
- 记忆：决定长期上下文如何保留
- 结构化输出：决定结果如何变成程序可消费的数据

---

## 写在最后

自定义 Deep Agent 的核心，不是“把所有选项都打开”，而是围绕真实任务场景做能力组合。

可以把整个配置过程理解为三层：

- 第一层：让 Agent 能想
- 第二层：让 Agent 能做
- 第三层：让 Agent 做得可控、可扩展、可落地

当你把模型、工具、流程控制、存储和输出方式组合好之后，Deep Agent 才真正从一个演示型 Agent 变成一个能够进入实际系统的 Agent。
