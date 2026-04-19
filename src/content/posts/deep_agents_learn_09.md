---
title: Deep Agents 学习09 ACP
pubDate: 2026-04-11
categories: ['Deep Agents']
description: '讲清如何把 Deep Agent 包装成 ACP 服务接入 IDE，包括 `AgentServerACP`、stdio 运行方式与编辑器集成思路。'
slug: deep-agents-acp
---

当一个 Deep Agent 只能在终端里运行时，它的能力边界往往还停留在“脚本助手”阶段。ACP 的价值在于，它给编辑器和 Agent 之间补上了一层标准连接方式，让你已经定制好的模型、工具、记忆和审批逻辑，能够真正进入 IDE 工作流，而不是孤立在单独进程里。

## 为什么值得关注

一旦把 Deep Agent 暴露成 ACP 服务，编辑器就不再只是和它“聊天”，而是可以把项目上下文、会话状态和交互入口一起交给它。这意味着你不需要为了 IDE 集成重新造一套 Agent，只需要把已有能力接到一条标准协议上。

这项能力的核心价值是：

- 让自定义 Deep Agent 进入编辑器生态
- 把 Agent 从终端或脚本环境扩展到 IDE 工作流
- 让编辑器与 Agent 之间有一套标准通信协议

---

## ACP 是什么

ACP 是 Agent Client Protocol，也就是“Agent 客户端协议”。

它解决的问题是：

- 编辑器怎么和外部 Agent 对接
- 双方用什么格式通信
- 编辑器如何把上下文传给 Agent
- Agent 如何把执行状态和结果回传给编辑器

可以把 ACP 理解成：

- 编辑器和 coding agent 之间的标准连接层

如果没有 ACP，不同编辑器和不同 Agent 往往需要各写各的私有集成。  
有了 ACP，就可以让“兼容 ACP 的编辑器”和“兼容 ACP 的 Agent”互相接通。

---

## ACP 和 MCP 的区别

ACP 和 MCP 经常会在同一类讨论里一起出现，所以第一次接触时很容易把它们当成一组平行替代方案。实际上它们处理的是两条完全不同的连接关系：一个负责把 Agent 接进编辑器，一个负责把工具接进 Agent。先把这层关系分清，后面做架构设计时就不容易混线。

这两个概念很容易混淆，但关注方向完全不同。

### ACP

ACP 关注的是：

- Agent 和编辑器 / IDE 怎么通信

也就是说，ACP 解决的是“Agent 接到编辑器里”这件事。

### MCP

MCP 关注的是：

- Agent 怎么调用外部工具或外部服务器提供的能力

也就是说，MCP 解决的是“Agent 接工具”这件事。

### 一句话区分

- ACP：让编辑器接入 Agent
- MCP：让 Agent 接入工具

---

## 使用 ACP 能得到什么

把 Deep Agent 暴露成 ACP 服务后，通常可以获得这些能力：

- 编辑器把当前项目上下文传给 Agent
- Agent 在编辑器内作为可用外部智能体出现
- 编辑器能展示 Agent 的执行状态和结果
- 可以复用你自己定制的 Deep Agent，而不是只能用编辑器内置 Agent

如果你已经有：

- 自定义 prompt
- 自定义工具
- 自定义 memory
- 自定义 subagent
- 自定义审批逻辑

那么 ACP 的价值就是把这些能力带进 IDE，而不是只能停留在 CLI 或服务端。

---

## 最小接入流程

把 Deep Agent 暴露给 ACP，最小只需要两步：

1. 安装 `deepagents-acp`
2. 用 `AgentServerACP` 包装你的 Deep Agent，并通过 stdio 启动 ACP server

---

## 第一步：安装依赖

### pip

```bash
pip install deepagents-acp
```

### uv

```bash
uv add deepagents-acp
```

### 这一步在做什么

你安装的是 ACP 集成层，而不是重新安装 Deep Agents 核心框架。

它的作用是：

- 把 Deep Agent 封装成 ACP server
- 让编辑器能通过 ACP 协议和这个 Agent 通信

---

## 第二步：把 Deep Agent 包装成 ACP 服务

安装完依赖之后，真正关键的动作其实只有一个：把你已经写好的 Deep Agent 变成一个“会说 ACP 协议”的服务入口。下面这段代码看起来很短，但它已经把 Agent 本体、协议适配和启动方式连到了一起。

下面是一份最小可运行示例：

```python
import asyncio

from acp import run_agent
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

from deepagents_acp.server import AgentServerACP


async def main() -> None:
    agent = create_deep_agent(
        model="google_genai:gemini-3.1-pro-preview",
        system_prompt="You are a helpful coding assistant",
        checkpointer=MemorySaver(),
    )

    server = AgentServerACP(agent)
    await run_agent(server)


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 这段代码在做什么

可以把它拆成四层理解。

### 1. 先创建一个普通 Deep Agent

```python
agent = create_deep_agent(...)
```

这里和你平时创建 Deep Agent 没有本质区别。

你仍然可以自定义：

- 模型
- 系统提示词
- 工具
- 中间件
- 子代理
- memory
- 审批机制

也就是说：

- ACP 不改变 Agent 本体的能力定义
- ACP 只是改变 Agent 的对外暴露方式

### 2. 用 `AgentServerACP` 做协议适配

```python
server = AgentServerACP(agent)
```

这一步相当于：

- 把 Deep Agent 包装成一个“会说 ACP 协议”的服务对象

### 3. 用 `run_agent(server)` 启动协议服务

```python
await run_agent(server)
```

这一步会启动 ACP server。

它默认通过：

- stdin 读取请求
- stdout 输出响应

这是一种非常典型的本地协议通信方式，尤其适合被编辑器或 IDE 当作子进程拉起。

### 4. 用 `asyncio.run(main())` 启动整个异步服务

ACP server 是异步运行的，因此主入口也使用异步方式启动。

---

## 为什么这里是 stdio 模式

ACP 服务通常不是你手工在终端里直接操作的网络服务，而更像：

- 被编辑器拉起的本地子进程
- 通过标准输入输出和编辑器通信

这种方式的好处是：

- 不需要单独起 HTTP 服务
- 不需要自己管理端口
- 更适合本地 IDE 集成
- 生命周期通常由编辑器托管

你可以把它理解成：

- 编辑器启动 Agent 进程
- 编辑器往 stdin 发消息
- Agent 从 stdout 回消息

---

## 一个关键认知：ACP 只是“接入层”

很多人第一次看到 ACP，会误以为：

- 它会替你定义 Agent 能力
- 它会限制 Agent 的配置方式

其实不是。

ACP 的角色只是：

- 让你的 Deep Agent 可以被 ACP 客户端识别和调用

因此：

- Agent 本身的能力设计，仍然由 `create_deep_agent(...)` 决定
- ACP 并不替代 Deep Agents SDK
- ACP 只是把 SDK 构建好的 Agent 暴露给编辑器

---

## 哪些编辑器或客户端可以使用

只要某个客户端兼容 ACP，它就有机会接入你的 Deep Agent。

常见可用客户端包括：

- Zed
- JetBrains IDEs
- Visual Studio Code（通过 `vscode-acp`）
- Neovim（通过 ACP 兼容插件）

这意味着：

- 你的 Agent 不需要为每个编辑器重写一套集成层
- 只要大家都遵守 ACP，就能复用同一个服务入口

---

## Zed 集成思路

把 ACP server 写出来之后，下一步通常不是继续改 Python 代码，而是把它真正接进一个客户端环境里。Zed 是比较典型的例子，因为它能很好地体现“编辑器只关心怎么启动这个 Agent 服务，而不关心你的 Agent 内部怎么实现”这件事。

Zed 是一个比较典型的 ACP client。

接入流程可以理解为四步：

1. 准备一个可运行的 ACP agent 启动命令
2. 配置模型和环境变量
3. 在 Zed 的 `settings.json` 中注册这个命令
4. 在 Zed 里启动对应 agent thread

### 一个典型注册方式

```json
{
  "agent_servers": {
    "DeepAgents": {
      "type": "custom",
      "command": "/your/absolute/path/to/deepagents/libs/acp/run_demo_agent.sh"
    }
  }
}
```

### 这里的关键点

- Zed 并不是直接“知道你的 Python 脚本”
- 它只需要一个可执行命令
- 这个命令启动后，会以 ACP server 方式工作

因此对于编辑器来说，最重要的是：

- 你能给它一个稳定、可执行的 ACP 启动入口

---

## Toad 的定位

如果你想把 ACP agent server 作为本地开发工具运行，可以借助 Toad 这类工具管理进程。

例如：

```bash
uv tool install -U batrachian-toad

toad acp "python path/to/your_server.py" .
# or
toad acp "uv run python path/to/your_server.py" .
```

### 适合什么场景

适合：

- 本地调试 ACP server
- 开发期验证 Agent 与 ACP client 的联通性
- 不想每次都手工管理服务进程

---

## 什么时候适合接入 ACP

ACP 不是所有场景都必须用，但在以下场景特别有价值。

### 1. 你已经有自己的 Deep Agent

例如你已经配置了：

- 专门的系统提示词
- 一组私有工具
- 一套记忆与技能机制
- 特定的审批流程

这时 ACP 的价值是：

- 把已有 Agent 直接带进编辑器

### 2. 你希望编辑器能提供更强项目上下文

编辑器通常更容易提供：

- 当前打开文件
- 项目结构
- 代码位置
- 用户当前操作焦点

ACP 可以成为这个上下文输入的协议层。

### 3. 你要做团队内部的 Agent IDE 集成

如果你在做：

- 企业内定制开发助手
- 某个团队专用 coding agent
- IDE 内协作式工作流

那 ACP 是非常自然的接入方式。

---

## 什么时候不一定要用 ACP

如果你的需求只是：

- 在终端里使用 Agent
- 通过脚本调用 Agent
- 在服务端跑 Agent API

那 ACP 不是必需组件。

因为 ACP 的主要价值是：

- 编辑器 / IDE 集成

如果没有这个需求，直接用 CLI 或 SDK 往往更简单。

---

## 实践中的架构理解

如果你准备把 ACP 真正接进团队工作流，这里最好建立一个稳定的分层视角：哪些事情属于 Agent 本体，哪些属于协议适配，哪些又属于编辑器客户端。这个边界一旦清楚，后续排错和扩展都会轻松很多。

把 ACP 放到整体系统里，可以这样看：

### Deep Agents SDK

负责：

- 定义 Agent 本体
- 定义模型、工具、提示词、memory、subagent 等

### ACP 适配层

负责：

- 把 Agent 包装成 ACP server
- 用标准协议暴露出来

### 编辑器 / IDE

负责：

- 作为 ACP client 连接 Agent
- 发送上下文和用户请求
- 展示 Agent 返回的状态和结果

这个分层非常重要，因为它意味着：

- 你可以独立迭代 Agent 能力
- 也可以独立更换 ACP client
- 两边通过协议解耦

---

## 设计上的几个关键点

### 1. 记忆与状态仍然由 Agent 自己管理

ACP 不会替你处理：

- 记忆存储
- thread 状态
- checkpoint 持久化

这些仍然是 Agent 构建层要负责的事情。

例如示例里加 `MemorySaver()`，就是为了给 Agent 提供基础状态持久化。

### 2. ACP server 更像“入口”而不是“业务逻辑层”

真正的业务逻辑最好仍然放在：

- Agent 配置
- tools
- middleware
- memory
- subagent

不要把核心工作流都堆到 ACP 启动脚本里。

### 3. 启动命令要稳定

既然编辑器通常通过 command 启动 ACP server，那么你的启动入口应该：

- 路径稳定
- 环境变量明确
- 依赖可复现
- 启动流程尽量简单

---

## 最小可用落地方式

如果你想最快把自己的 Deep Agent 接到编辑器里，建议按这个路径走：

1. 先写一个最小版 ACP server 脚本
2. 先在终端本地跑通这个脚本
3. 确认模型 API key 和依赖都正常
4. 再把这个脚本注册到你的 ACP client（如 Zed）
5. 再逐步把自定义工具、记忆、子代理加进去

这样排查成本最低。

---

## 常见错误与排查

### 启动脚本能跑，但编辑器连不上

常见原因：

- 启动命令路径错了
- 编辑器配置文件里 command 写错
- 启动脚本没有执行权限
- 环境变量在编辑器子进程里不可见

解决：

- 先单独在终端跑命令
- 再检查编辑器配置
- 确认脚本可执行
- 确认 API key 在编辑器进程环境里可用

### ACP server 启动后没有响应

常见原因：

- 脚本内部异常退出
- 模型配置错误
- 缺少依赖
- stdio 通信没有正确建立

解决：

- 先本地手工执行脚本观察报错
- 确认 `deepagents-acp` 已安装
- 确认 `create_deep_agent(...)` 本身可正常运行

### 编辑器接入了 Agent，但能力不完整

常见原因：

- 你暴露的是一个最小 Agent，只配置了基础 prompt
- 没有把自定义工具、memory、subagent 等加进去

解决：

- 回到 `create_deep_agent(...)` 层补能力
- 记住 ACP 只是接入层，不会自动帮你补完整能力

### 以为 ACP 能替代 MCP

这是理解错误。

实际情况是：

- ACP 负责“Agent 接编辑器”
- MCP 负责“Agent 接工具”

解决：

- 如果你要扩展工具能力，继续看 MCP 路线
- 如果你要接 IDE，就走 ACP 路线

### 记忆或线程状态不稳定

常见原因：

- 没有配置 checkpointer
- 启动方式导致状态没有被正确持久化

解决：

- 为 Agent 提供合适的 checkpoint / memory 配置
- 明确你希望状态是进程内、会话级还是长期持久化

---

## 验收标准

可以用下面的标准判断 ACP 集成是否真正跑通：

- ACP server 能正常启动
- 编辑器或 ACP client 能成功连接到 Agent
- 用户请求能从编辑器传入 Agent
- Agent 返回的结果能在编辑器中展示
- Agent 的自定义能力（prompt、工具、记忆等）确实生效
- 启动脚本和依赖链可重复运行

---

## 推荐实操顺序

建议按这个顺序落地：

1. 先安装 `deepagents-acp`
2. 写一个最小 ACP server 脚本
3. 本地验证脚本能启动并运行
4. 再在编辑器中注册该命令
5. 验证编辑器与 Agent 的基本通信
6. 再逐步叠加工具、memory、subagents 等能力
7. 最后再做团队级或产品级的 IDE 集成封装

---

## 关键要点

- ACP 是编辑器与 Agent 的标准通信协议
- 它解决的是“编辑器怎么接入 Agent”，不是“Agent 怎么接工具”
- Deep Agent 本体仍由 SDK 配置，ACP 只负责暴露协议服务
- 最小实现方式是 `AgentServerACP(agent)` 加 `run_agent(server)`
- stdio 是最常见的运行方式，适合被编辑器当作子进程拉起
- 只要 ACP client 兼容，就能复用你的自定义 Deep Agent

---

## 写在最后

ACP 的本质，是把一个已经具备实际能力的 Deep Agent，变成一个可以被编辑器标准化接入的外部智能体服务。

可以把它理解成三层：

- 第一层：用 SDK 定义好 Agent 自身能力
- 第二层：用 ACP 把这个 Agent 包装成协议服务
- 第三层：让编辑器作为 client 接入并使用这个 Agent

当这三层打通之后，你的 Deep Agent 就不再只是终端或脚本里的能力，而是可以真正进入 IDE 工作流的智能体。
