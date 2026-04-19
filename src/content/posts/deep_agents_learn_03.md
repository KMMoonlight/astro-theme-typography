---
title: Deep Agents 学习03 Models
pubDate: 2026-04-19
categories: ['Deep Agents']
description: '讲清 Deep Agents 的模型选型逻辑、provider:model 写法、参数控制方式，以及运行时动态换模的实践路径。'
slug: deep-agents-models
---

在 Deep Agents 里，模型不只是“回答问题的引擎”，它还决定了 Agent 会不会稳定调工具、能不能扛住长流程、以及在复杂任务里是否容易跑偏。很多看起来像框架问题的现象，最后追根溯源，往往都落回模型选择和参数策略本身。

## 为什么值得关注

如果模型选错了，Agent 往往不是单纯“回答差一点”，而是会在规划、工具调用、长上下文处理和结构化输出上整体失稳。所以模型配置不该只停留在“换个名字试试”，而应该被看成一条完整的工程决策链：选型、调参、重试、超时，以及必要时的动态切换。

模型配置会直接影响：

- 工具调用稳定性
- 复杂任务规划能力
- 长上下文处理效果
- 响应速度
- 成本
- 结构化输出质量

---

## 模型的基本要求

Deep Agents 可以和任意 LangChain chat model 配合使用，但前提是模型必须支持 tool calling。

这是硬性条件，因为 Agent 的关键能力依赖模型主动决定并发起工具调用，例如：

- 搜索
- 文件读写
- 子代理调度
- 结构化输出

如果模型不支持 tool calling，会出现这些问题：

- 工具无法被稳定调用
- 任务拆解和执行流程会失效
- Agent 会退化成普通问答模型

---

## 模型标识格式

最常见的写法是直接传模型字符串，格式为：

```text
provider:model
```

例如：

- `google_genai:gemini-3.1-pro-preview`
- `openai:gpt-5.4`
- `anthropic:claude-sonnet-4-6`

这种格式的好处是：

- 写法统一
- 便于快速切换 provider
- 适合在配置层做模型替换

---

## 推荐模型选择思路

并不是所有支持工具调用的模型都同样适合 Deep Agent。真正做选型时，最好不要一上来就问“哪个模型最强”，而是先问“我的 Agent 最容易在哪个环节失稳”：是工具调用不稳、长流程容易跑偏，还是成本压不下来。把这个判断顺序理清后，模型选择才会变成有依据的工程决策，而不是反复试错。

选择模型时，建议按下面几个维度综合判断：

- 工具调用稳定性
- 长任务执行能力
- 多步规划能力
- 成本
- 延迟
- 上下文长度
- 是否需要 provider 专属能力

### 一组表现较好的模型选择

#### Google

适合在速度和能力之间做平衡：

- `gemini-3.1-pro-preview`
- `gemini-3-flash-preview`

#### OpenAI

适合多种通用 Agent 场景：

- `gpt-5.4`
- `gpt-4o`
- `gpt-4.1`
- `o4-mini`
- `gpt-5.2-codex`
- `gpt-4o-mini`
- `o3`

#### Anthropic

适合复杂规划、稳健输出和高质量任务执行：

- `claude-opus-4-6`
- `claude-opus-4-5`
- `claude-sonnet-4-6`
- `claude-sonnet-4`
- `claude-sonnet-4-5`
- `claude-haiku-4-5`
- `claude-opus-4-1`

#### Open-weight 模型

适合需要开放权重模型或通过其他平台托管时使用：

- `GLM-5`
- `Kimi-K2.5`
- `MiniMax-M2.5`
- `qwen3.5-397B-A17B`
- `devstral-2-123B`

这些模型通常可以通过以下 provider 接入：

- Baseten
- Fireworks
- OpenRouter
- Ollama

### 选型建议

#### 优先追求稳定和综合表现

优先考虑：

- `anthropic:claude-sonnet-4-6`
- `openai:gpt-5.4`
- `google_genai:gemini-3.1-pro-preview`

#### 优先控制成本

优先考虑：

- `gpt-4o-mini`
- `o4-mini`
- `gemini-3-flash-preview`

#### 优先本地化或开放权重路线

优先考虑：

- `ollama:devstral-2`
- 其他通过 OpenRouter / Fireworks / Baseten 提供的 open-weight 模型

---

## 最简单的模型配置方式

### 方式 1：直接传模型字符串

```python
from deepagents import create_deep_agent

agent = create_deep_agent(model="openai:gpt-5.4")
```

这是最快的配置方式，适合：

- 快速验证
- 原型开发
- 只需要默认参数

### 这种方式背后发生了什么

当传入模型字符串时，底层会自动通过 `init_chat_model(...)` 去解析并初始化模型。

这意味着：

- 你不需要自己手动实例化 provider SDK
- 但可控参数也相对少一些

---

## 需要精细参数控制时的做法

到了真正要落地的时候，你很快会发现，“能跑起来”和“跑得稳”之间往往隔着一层参数控制。很多问题并不是换模型才能解决，而是要把超时、重试、输出长度和 provider 专属参数调到合适区间。

如果你希望控制模型的专属参数，例如：

- 推理强度
- 超时时间
- 重试次数
- 温度
- 最大 token
- provider 特定参数

就应该先初始化模型，再传给 Agent。

### 方式 2：使用 `init_chat_model(...)`

```python
from langchain.chat_models import init_chat_model
from deepagents import create_deep_agent

model = init_chat_model(
    model="google_genai:gemini-3.1-pro-preview",
    thinking_level="medium",
)
agent = create_deep_agent(model=model)
```

### 这适合什么场景

适合以下情况：

- 同一个 provider 下只想微调参数
- 想保留统一初始化方式
- 希望避免直接依赖 provider 的模型类

---

## 使用 provider 模型类直接初始化

如果你已经明确知道要使用某个 provider 的高级参数，可以直接使用对应模型类。

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from deepagents import create_deep_agent

model = ChatGoogleGenerativeAI(
    model="gemini-3.1-pro-preview",
    thinking_level="medium",
)
agent = create_deep_agent(model=model)
```

### 这适合什么场景

适合以下情况：

- 需要 provider 专有参数
- 你已经熟悉对应模型 SDK
- 需要更细粒度的配置控制

### 两种初始化方式怎么选

#### 优先简洁

用 `init_chat_model(...)`

#### 优先 provider 专属能力

用具体模型类，例如：

- `ChatOpenAI`
- `ChatAnthropic`
- `ChatGoogleGenerativeAI`
- `AzureChatOpenAI`

---

## 模型参数配置思路

不同 provider 支持的参数并不完全相同，但常见可调方向包括：

- `temperature`
- `max_tokens`
- `timeout`
- `max_retries`
- provider 专属推理参数

### 参数调整的实际意义

#### `temperature`

控制输出发散度。

- 更低：更稳定、更保守
- 更高：更灵活、更发散

对于工具型 Agent，通常更倾向低温或中低温，以减少不稳定行为。

#### `max_tokens`

控制单次输出长度。

任务较复杂、输出结构较长时，需要适当放大。

#### `timeout`

控制单次请求超时时间。

复杂推理、慢网络或长任务时，需要适当提高。

#### `max_retries`

控制失败后自动重试次数。

当网络波动、限流频繁或 provider 偶发错误较多时，这个参数非常重要。

---

## 重试与连接稳定性

LangChain chat model 默认会自动对以下错误场景进行重试：

- 网络错误
- 429 限流
- 5xx 服务端错误

默认重试次数是 `6`。

以下错误通常不会重试：

- `401` 未授权
- `404` 资源不存在

这些属于配置错误或请求错误，重试没有意义。

### 调整重试与超时示例

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

### 什么时候应该提高 `max_retries`

适合提高到 `10~15` 的情况：

- 网络环境不稳定
- Agent 单次任务很长
- 会频繁调用工具
- 外部 API 偶发失败较多

### 什么时候应该提高 `timeout`

适合提高超时时间的情况：

- 使用长思维模型
- 工具链很复杂
- 结果生成较长
- provider 响应本身较慢

### 长任务的额外建议

如果 Agent 执行的是长流程任务，只提高 `max_retries` 还不够，最好同时配合检查点机制。

这样即使中途失败，也可以保留已完成的步骤，避免整轮任务从头开始。

---

## 运行时动态切换模型

当系统开始面向真实用户或真实业务场景时，模型通常就不再是一个写死的常量了。有人希望自己选 provider，有人只愿意为高难度任务付更高成本，也有系统会因为可用性和预算而做自动路由。这时候，与其频繁重建 Agent，不如把“换模”做成运行时能力。

如果应用允许用户自行选择模型，例如：

- 前端下拉选择模型
- 企业版客户选择不同 provider
- 根据任务复杂度切换模型
- 根据成本预算动态路由模型

那么不应该每次都重新构建 Agent，而应该在运行时动态替换模型。

### 基本思路

做法分为三步：

1. 把用户选择的模型写入 runtime context
2. 用 `wrap_model_call` 中间件读取这个上下文
3. 在每次调用时覆盖当前模型

### 示例

```python
from dataclasses import dataclass
from langchain.chat_models import init_chat_model
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse
from deepagents import create_deep_agent
from typing import Callable


@dataclass
class Context:
    model: str

@wrap_model_call
def configurable_model(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    model_name = request.runtime.context.model
    model = init_chat_model(model_name)
    return handler(request.override(model=model))

agent = create_deep_agent(
    model="google_genai:gemini-3.1-pro-preview",
    middleware=[configurable_model],
    context_schema=Context,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "Hello!"}]},
    context=Context(model="openai:gpt-5.4"),
)
```

### 这里发生了什么

- Agent 先有一个默认模型
- 每次调用时，中间件从上下文里读取用户指定模型
- 再用 `request.override(model=model)` 覆盖这次调用的模型
- Agent 本体不需要重建

### 这种方式的优势

- 模型切换更灵活
- 同一个 Agent 可以服务多个模型选择
- 便于做成本优化和策略路由
- 更适合接入前端可配置界面

---

## 动态选模的常见场景

### 1. 用户手动选模

适合产品层暴露“模型选择器”的场景。

例如：

- 普通模式用低成本模型
- 专家模式用高能力模型

### 2. 按任务复杂度路由

简单任务用轻量模型，复杂任务用更强模型。

例如：

- 简单问答用 `gpt-4o-mini`
- 多步研究用 `claude-sonnet-4-6`

### 3. 按成本预算路由

在预算敏感系统中，根据用户等级、剩余额度或任务优先级切换模型。

### 4. 按 provider 可用性做降级

某个 provider 不可用时，自动切到备用 provider。

---

## 什么时候只传字符串，什么时候传模型实例

### 只传字符串

适合：

- 快速起步
- 简单场景
- 不需要 provider 专有参数
- 模型选择逻辑很简单

### 传模型实例

适合：

- 需要控制参数
- 需要更高稳定性
- 需要动态重试和超时策略
- 需要 provider 专有能力
- 需要统一封装模型初始化逻辑

### 一个简单判断方法

如果你只是在问“我要用哪个模型”，传字符串就够。  
如果你在问“我要怎么调这个模型”，那就应该传模型实例。

---

## 多 provider 使用时的建议

当系统里可能接入多个 provider 时，建议遵循这几个原则：

- 所有模型标识统一使用 `provider:model`
- 把模型选择逻辑抽离到配置层
- 把 provider 差异收敛到初始化层
- 避免把 provider 专属逻辑散落在业务代码中

这样可以带来几个好处：

- 迁移成本更低
- A/B 测试更方便
- 容易做 fallback
- 更适合长期维护

---

## 常见错误与排查

### 模型能聊天，但不会调用工具

常见原因：

- 模型本身不支持 tool calling
- provider 配置不完整
- 实际初始化的模型和你以为的不一致

排查方法：

1. 确认模型是否支持工具调用
2. 确认传入的是正确模型名
3. 确认初始化逻辑没有覆盖到其他模型

### 传了 provider:model，但初始化失败

常见原因：

- provider 字符串写错
- provider 对应依赖没安装
- 环境变量没配置

排查方向：

- 检查 provider 拼写
- 检查是否已安装相应 LangChain integration 包
- 检查 API Key 是否生效

### 参数不生效

常见原因：

- 参数不是该 provider 支持的字段
- 用字符串方式初始化时没有机会传额外参数
- 传参数的位置不对

解决方法：

- 改用 `init_chat_model(...)`
- 或直接使用 provider 模型类初始化

### 动态选模时报错

常见原因：

- `context_schema` 没定义
- `context` 没传
- 中间件没有正确读取 runtime context
- 用户传入了无效模型名

解决方法：

- 检查 context 数据类
- 检查 `agent.invoke(..., context=...)`
- 检查中间件中的模型名来源
- 对模型名做白名单校验

### 长任务频繁失败

常见原因：

- 超时时间太短
- 重试次数太少
- provider 稳定性不足
- 任务复杂度与模型能力不匹配

解决方法：

- 提高 `timeout`
- 提高 `max_retries`
- 使用更适合 Agent 的模型
- 为长任务增加 checkpoint

---

## 验收标准

可以用下面的标准判断模型配置是否合理：

- Agent 能稳定启动并完成调用
- 工具调用行为正常
- 参数调整后，行为变化符合预期
- provider 切换后，无需改动大量业务代码
- 动态选模时，同一个 Agent 能在不同调用间切换模型
- 长任务在弱网络环境下仍有较好稳定性

---

## 推荐实操顺序

建议按下面顺序配置模型：

1. 先选一个支持 tool calling 的稳定模型
2. 先用 `provider:model` 方式跑通最小链路
3. 需要细调时改用 `init_chat_model(...)`
4. 再按任务需求配置 `timeout` 和 `max_retries`
5. 如果需要前端选模，再加运行时动态切换
6. 最后再做复杂路由、降级和多 provider 策略

---

## 关键要点

- 模型必须支持 tool calling
- 最简单写法是 `provider:model`
- 需要细调参数时，先初始化模型再传给 Agent
- `max_retries` 和 `timeout` 对长任务稳定性很重要
- 动态选模应该通过中间件和 runtime context 实现
- 模型配置的目标不是“能跑就行”，而是让 Agent 在能力、成本和稳定性之间达到平衡

---

## 写在最后

模型配置决定了 Deep Agent 的能力上限和稳定性下限。

可以把模型相关工作理解成三层：

- 第一层：选对模型
- 第二层：调对参数
- 第三层：在运行时按场景动态切换

当模型、重试策略、超时策略和动态路由都配置好之后，Deep Agent 才能在真实场景里稳定承担复杂任务。
