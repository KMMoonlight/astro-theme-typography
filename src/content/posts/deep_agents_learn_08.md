---
title: Deep Agents 学习08 CLI
pubDate: 2026-04-12
categories: ['Deep Agents']
description: '完整梳理 Deep Agents CLI 的能力边界、交互方式、slash 命令、记忆技能、非交互执行以及 sandbox 和 tracing 集成。'
slug: deep-agents-cli
---

如果把 Deep Agents SDK 看成底层能力，那么 CLI 更像是把这些能力真正放进了一个可长期使用的终端工作界面里。它不是“给模型套个聊天壳”，而是把读文件、改代码、跑命令、调用技能、记住偏好这些能力收拢成一条持续可用的开发工作流。

## 为什么值得关注

理解 CLI，重点不在于背命令清单，而在于看清它为什么能成为日常工作的入口：它既保留了终端的直接性，又把 Agent 的规划、工具调用、记忆和审批机制一起带进了开发现场。用得好的话，它不是偶尔帮你答题的助手，而是一个能长期参与项目工作的终端代理。

它的核心作用是：

- 在终端中直接完成代码、文件、命令和研究类任务
- 通过记忆、技能和上下文压缩支持长期使用
- 通过审批机制控制高风险操作
- 在需要时接入 MCP、远程沙箱和 LangSmith tracing

可以把它理解成：

- 一个基于 Deep Agents SDK 封装出来的终端工作代理
- 一个可以长期学习你的项目习惯和工作方式的 CLI 助手

---

## 它到底是什么

Deep Agents CLI 是一个运行在终端里的 coding agent。

和普通命令行工具不同，它不是“你输一个命令，它执行一个固定逻辑”，而是：

- 你输入自然语言任务
- Agent 会自己规划步骤
- 自己决定是否要读文件、改文件、执行命令、搜索资料、问你问题、调用子代理
- 必要时还会记住项目习惯和你的偏好

所以它更像一个在终端里的“可执行智能工作流系统”。

---

## 界面示意

![Deep Agents CLI 界面示意](https://mintcdn.com/langchain-5e9cc07a/K17j_uBSCpWoKNGK/oss/images/deepagents/deepagents-cli.png?fit=max&auto=format&n=K17j_uBSCpWoKNGK&q=85&s=65b8e32a3d973ebdf0a5bffc06fc057b)

这张图展示的是 CLI 的典型交互形态：上方是对话与工具输出区域，下方是持续输入任务的终端式工作界面。先从这个界面形态建立直觉会很有帮助，因为后面提到的文件工具、shell、记忆和审批，本质上都是在这个统一工作界面里协同发生的。

---

## 内置能力总览

这个 CLI 默认就具备一整套能力，不需要你自己手工拼装。

### 文件能力

可以直接：

- 读文件
- 写文件
- 编辑文件
- 搜索文件名
- 搜索文件内容

适合：

- 改代码
- 看日志
- 写文档
- 分析项目结构

### shell 执行能力

可以运行命令，例如：

- 测试
- 构建
- 安装依赖
- 调 git
- 调用系统工具

### Web 与 HTTP 能力

可以：

- 搜索网页
- 获取最新文档
- 发起 HTTP 请求

适合：

- 查 API 文档
- 获取在线信息
- 调用外部服务

### 任务规划与追踪

对复杂任务，Agent 会先拆步骤，再按阶段推进。

### 记忆能力

可以跨 session 保存：

- 项目约定
- 你的偏好
- 团队规范
- 历史工作经验

### 上下文压缩与卸载

当会话过长时，会自动把历史消息摘要化并卸载到存储里，避免上下文窗口爆掉。

### 人工审批

对高风险操作，例如改文件、执行命令、发 Web 请求等，可以要求人工确认。

### 技能

可以按需扩展专项能力，例如：

- code review
- web research
- 文档整理
- 某类内部工作流

### MCP 工具

可以从 MCP server 加载额外工具，把 CLI 变成更大的工具系统入口。

### Tracing

可以把 Agent 的操作、工具调用、决策链路发送到 LangSmith 中进行观察和调试。

---

## 内置工具怎么理解

CLI 自带的工具大致分成几类。

### 文件系统工具

- `ls`
- `read_file`
- `write_file`
- `edit_file`
- `glob`
- `grep`

### 执行与网络工具

- `execute`
- `web_search`
- `fetch_url`

### 流程控制工具

- `task`
- `ask_user`
- `compact_conversation`
- `write_todos`

### 哪些工具默认要审批

通常以下工具属于高风险或潜在破坏性操作，会触发人工审批：

- `write_file`
- `edit_file`
- `execute`
- `web_search`
- `fetch_url`
- `task`
- 手动触发的 `compact_conversation`

这里的核心思想是：

- 只读类工具尽量低摩擦
- 有副作用或高成本动作走审批

---

## 环境与平台认知

这个 CLI 主要面向类 Unix 环境。

### Windows 的现实情况

它并不是官方重点支持的 Windows 原生工具。

如果你在 Windows 上使用，更推荐：

- WSL

这样兼容性通常会好很多。

---

## 最小启动流程

要跑起来，最少只需要完成三件事：

1. 配模型 API Key
2. 安装 CLI
3. 启动并给它任务

---

## 第一步：配置模型凭证

CLI 依赖一个支持 tool calling 的模型。

最常见的是设置环境变量。

### OpenAI

```bash
export OPENAI_API_KEY="your-api-key"
```

### Anthropic

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

### Google

```bash
export GOOGLE_API_KEY="your-api-key"
```

### 更推荐的长期方式

把 key 写到：

```text
~/.deepagents/.env
```

这样每次启动终端都不需要重新 export。

### 为什么 `.env` 更适合长期使用

因为 CLI 启动时会自动读取自己的配置目录，长期使用时更稳定，也更适合：

- 多 provider
- tracing 配置
- sandbox 凭证
- 项目级覆盖

---

## 第二步：安装 CLI

### 最简单安装方式

```bash
curl -LsSf https://raw.githubusercontent.com/langchain-ai/deepagents/refs/heads/main/libs/cli/scripts/install.sh | bash
```

### 带可选 provider extras 安装

```bash
DEEPAGENTS_EXTRAS="ollama,groq" curl -LsSf https://raw.githubusercontent.com/langchain-ai/deepagents/refs/heads/main/libs/cli/scripts/install.sh | bash
```

### 用 `uv` 安装

```bash
uv tool install 'deepagents-cli[ollama,groq]'
```

### 默认已包含哪些 provider

默认包含：

- OpenAI
- Anthropic
- Google

其他 provider 需要额外安装对应 integration。

---

## 第三步：启动 CLI

```bash
deepagents
```

启动后就可以直接输入自然语言任务，例如：

```text
Create a Python script that prints "Hello, World!"
```

在默认设置下，CLI 会对关键修改展示 diff，并在执行高风险操作前请求确认。

---

## Provider 扩展方式

如果你需要额外的模型 provider，可以通过 `uv tool install ... --with ...` 追加依赖。

例如：

```bash
uv tool install deepagents-cli --with langchain-xai
```

一个简单判断标准：

- OpenAI / Anthropic / Google：开箱即用
- 其他 provider：按需安装 integration

---

## 交互模式怎么使用

进入 CLI 后，默认就是交互模式。

在这个模式下，最核心的用法就是：

- 直接像聊天一样输入任务
- 让 Agent 自己决定要用哪些工具

除了普通对话，还支持 slash 命令、shell 模式和快捷键。

---

## Slash 命令体系

如果把自然语言任务看成“让 Agent 去做事”，那 slash 命令更像是“你来管理 Agent 的工作环境”。它们不直接解决业务问题，而是帮你切模型、控上下文、调能力、查状态。

Slash 命令是 CLI 的内置控制层。

最常用的一组包括：

- `/model`
  - 切换模型或打开模型选择器

- `/remember [context]`
  - 让 Agent 回顾当前对话并更新记忆与技能

- `/skill:<name> [args]`
  - 直接调用某个 skill

- `/offload` 或 `/compact`
  - 主动压缩上下文并把旧消息卸载到存储

- `/tokens`
  - 查看当前上下文 token 占用情况

- `/clear`
  - 清空当前对话并开启新 thread

- `/threads`
  - 浏览并恢复历史会话

- `/mcp`
  - 查看已加载的 MCP server 和工具

- `/reload`
  - 重新读取 `.env`、配置和 skill，而不重启会话

- `/theme`
  - 切换主题

- `/update`
  - 检查并更新 CLI

- `/trace`
  - 打开当前 thread 的 LangSmith trace

- `/editor`
  - 用外部编辑器编辑当前 prompt

- `/help`
  - 查看帮助

- `/quit`
  - 退出 CLI

### 最常用的几类场景

命令很多时，最好的记法通常不是逐个背，而是按使用场景来分。你会发现，大多数高频操作其实都落在“管上下文、管能力、管环境”这三类里。

#### 管理上下文

- `/offload`
- `/tokens`
- `/clear`
- `/threads`

#### 管理能力

- `/model`
- `/skill:<name>`
- `/mcp`
- `/reload`

#### 管理环境

- `/theme`
- `/update`
- `/trace`
- `/editor`

---

## Shell 模式

CLI 虽然强调让 Agent 自主完成任务，但它并不会把你完全排除在操作链路之外。很多时候，你只是想快速看一眼环境状态，或者临时跑一条命令，这时 shell 模式会更直接。

如果想临时手动执行命令，可以输入 `!` 进入 shell 模式，然后执行：

```bash
git status
npm test
ls -la
```

这适合两类场景：

- 你自己想快速看环境状态
- 不想经过 Agent 决策，直接手动敲命令

---

## 常用快捷键

快捷键这部分最适合在真正使用 CLI 时边用边记，不需要一次性背全。可以先把它们理解成三类：输入编辑、Agent 控制，以及文件注入。

### 输入与提交

- `Enter`
  - 提交 prompt

- `Shift+Enter` / `Ctrl+J` / `Alt+Enter` / `Ctrl+Enter`
  - 换行

### 输入编辑

- `Ctrl+A`
  - 全选

- `Ctrl+U`
  - 删除到行首

- `Ctrl+X`
  - 用外部编辑器编辑 prompt

### Agent 交互控制

- `Shift+Tab` 或 `Ctrl+T`
  - 切换 auto-approve

- `Ctrl+O`
  - 展开或折叠最近一次工具输出

- `Escape`
  - 中断当前操作

- `Ctrl+C`
  - 中断或退出

- `Ctrl+D`
  - 退出

### 文件注入

- `@filename`
  - 自动补全文件名并把文件内容注入 prompt

这对让 Agent 快速拿到某个文件内容非常有用。

---

## 非交互模式

当你不需要长期对话，而只是想把 CLI 接进脚本、管道或者一次性自动化流程时，非交互模式会更合适。这里的思路和交互模式完全不同：重点不再是持续协作，而是把 CLI 当成一个可以被外部程序调用的任务执行器。

如果你不想进入 TUI，而是想把 CLI 当作“一次性任务执行器”，可以使用：

```bash
deepagents -n "Write a Python script that prints hello world"
```

### 适合什么场景

只要你的需求更接近“把 CLI 嵌进一条已有自动化链路”，这一模式就会非常顺手。常见场景包括：

- shell 脚本调用
- CI 流程中的一次性分析
- 从别的程序中调用 CLI
- 管道式处理

---

## 管道输入

一旦进入非交互模式，stdin 就会变成非常实用的接入口。很多原本需要手工复制粘贴给 Agent 的内容，都可以直接从上一条命令流过来。

CLI 可以直接从 stdin 接收内容。

例如：

```bash
echo "Explain this code" | deepagents
cat error.log | deepagents -n "What's causing this error?"
git diff | deepagents -n "Review these changes"
git diff | deepagents --skill code-review -n 'summarize changes'
```

### 这个能力特别适合什么

- 分析日志
- review diff
- 解释命令输出
- 配合 skill 做专项处理

### 一个重要规则

当你同时用了 stdin 和 `-n` / `-m` 时：

- piped 输入会先进入上下文
- 你通过 flag 传入的文字会追加在后面

### 输入大小限制

最大 piped 输入大小通常是：

- 10 MiB

所以非常大的日志或 diff，仍然需要先裁剪。

---

## 非交互模式下的 shell 限制

这里有一个非常值得单独记住的边界：非交互模式默认并不会让 Agent 自由执行 shell。因为一旦没有人在场盯着审批，执行能力就必须收得更紧。

在非交互模式中，shell 默认是禁用的。

原因很合理：

- 非交互场景下通常没人盯着审批
- 直接放开 shell 风险太高

如果你确实需要让 CLI 在非交互模式下执行命令，就要显式设置 shell allow list。

### 只允许指定命令

```bash
deepagents -n "Run the tests and fix failures" -S "pytest,git,make"
```

### 使用推荐白名单

```bash
deepagents -n "Build the project" -S recommended
```

### 放开全部命令

```bash
deepagents -n "Fix the build" -S all
```

### 风险提醒

`-S all` 的含义几乎等于：

- 在无人工确认的情况下允许 Agent 执行任意 shell 命令

这在自动化场景中风险极高，除非你非常清楚运行环境边界，否则不要随便开。

---

## `-q` 与 `--no-stream`

如果你想让 CLI 更适合被别的命令消费，可以使用这两个参数。

### `-q`

输出更干净，只保留 Agent 最终回答，适合重定向或管道。

例如：

```bash
deepagents -n "Generate a .gitignore for Python" -q > .gitignore
```

### `--no-stream`

关闭流式输出，等完整结果生成后再一次性写到 stdout。

例如：

```bash
deepagents -n "List dependencies" -q --no-stream | sort
```

### 一个重要限制

`-q` 或 `--no-stream` 一般需要配合：

- `-n`
- 或 stdin 输入

---

## 模型切换

CLI 支持在会话中动态切换模型，而不需要重启。

### 会话内切换

```text
/model anthropic:claude-opus-4-6
/model openai:gpt-5.4
```

### 启动时指定模型

```bash
deepagents --model openai:gpt-5.4
```

### 打开交互式模型选择器

直接输入：

```text
/model
```

### 模型参数临时覆盖

如果你想在 session 内加临时模型参数，例如 temperature：

```text
/model --model-params '{"temperature": 0.7}' anthropic:claude-sonnet-4-5
```

也可以不直接指定模型，而是打开选择器后把参数应用到所选模型。

### 这个能力适合什么

- 当前任务特别复杂，切到更强模型
- 当前任务只想省钱，切到更轻模型
- 想比较不同 provider 的表现

---

## 配置目录结构

CLI 的配置都放在：

```text
~/.deepagents/
```

默认 agent 名叫：

- `agent`

每个 agent 会有自己的独立目录。

### 关键路径

- `~/.deepagents/config.toml`
  - 全局配置，例如模型默认值、provider 参数、profile 覆盖、主题、更新设置、MCP trust store

- `~/.deepagents/.env`
  - 全局 API key 和 secrets

- `~/.deepagents/hooks.json`
  - 生命周期 hook 配置

- `~/.deepagents/<agent_name>/`
  - 每个 agent 自己的记忆、技能、会话线程

- `.deepagents/`（项目根目录）
  - 项目级记忆与技能

### 查看已配置 agent

```bash
deepagents agents list
```

---

## 记忆系统

CLI 的长期可用性，很大程度来自它的记忆系统。

主要有两层：

- `AGENTS.md`
- 自动记忆文件

---

## 自动记忆

随着使用过程，CLI 会自动把信息保存到：

```text
~/.deepagents/<agent_name>/memories/
```

这些记忆通常会按主题拆成独立 markdown 文件，例如：

```text
~/.deepagents/backend-dev/memories/
├── api-conventions.md
├── database-schema.md
└── deployment-process.md
```

### 记忆的工作方式

可以理解为三步：

1. 先搜索已有记忆
2. 任务执行中不确定时再查记忆
3. 识别到新知识后自动保存

### 适合记忆什么

- 编码风格
- API 命名习惯
- 数据库约定
- 部署流程
- 团队偏好
- 某个项目特有规则

---

## `AGENTS.md`

`AGENTS.md` 是始终加载的持久上下文文件。

### 全局位置

```text
~/.deepagents/<agent_name>/AGENTS.md
```

作用：

- 每次 session 启动都加载
- 存通用工作方式、个人偏好、跨项目习惯

### 项目位置

```text
.deepagents/AGENTS.md
```

作用：

- 在 git 项目中启动 CLI 时自动加载
- 存当前项目的架构、规范、测试策略、团队约定

### 如何划分全局与项目级内容

#### 全局 `AGENTS.md`

适合写：

- 你的沟通风格
- 你的通用编码偏好
- 通用工具使用习惯
- 不随项目变化的方法论

#### 项目级 `AGENTS.md`

适合写：

- 当前项目架构
- 代码组织方式
- 项目专属约定
- 测试与发布流程
- 团队规范

### 一个重要补充

如果你在 `.deepagents/` 下还放了其他结构化知识文件，应该在 `AGENTS.md` 里显式引用它们。

否则：

- CLI 启动时不会自动知道这些附加文件的存在

---

## `/remember` 的作用

如果你希望 Agent 主动把当前对话中的新知识沉淀进记忆和技能，可以使用：

```text
/remember
```

也可以附带上下文。

这个命令适合在以下时机使用：

- 你刚告诉它新的团队规范
- 你刚修正了它的工作方式
- 你希望某条经验以后自动被沿用

---

## 技能系统

技能是可复用的专项能力包。

和记忆相比：

- 记忆更偏“长期记住什么”
- 技能更偏“这类任务应该怎么做”

### 适合做成技能的内容

- code review 流程
- web research 流程
- 某类特定文档写作规范
- 某业务系统的操作手册
- 某类任务模板

---

## 如何创建技能

### 用户级技能

```bash
deepagents skills create test-skill
```

### 项目级技能

```bash
deepagents skills create test-skill --project
```

这会生成：

```text
skills/
└── test-skill
    └── SKILL.md
```

然后你需要编辑 `SKILL.md`，填入该技能的说明和工作方式。

### 也可以直接复制现成技能

```bash
mkdir -p ~/.deepagents/<agent_name>/skills
cp -r examples/skills/web-research ~/.deepagents/<agent_name>/skills/
```

---

## 社区技能安装

如果你想直接使用社区技能，可以用相关工具安装。

例如：

```bash
npx skills add vercel-labs/agent-skills --skill web-design-guidelines -a deepagents -g -y
npx skills ls -a deepagents -g
```

### 一个重要限制

全局安装默认会链接到默认 agent：

```text
~/.deepagents/agent/skills/
```

如果你使用的是自定义 agent 名称，就要注意：

- 要么改用项目级技能
- 要么手动把 skill 链接到对应 agent 目录

---

## 技能发现路径

CLI 启动时会自动扫描多个技能目录，例如：

```text
~/.deepagents/<agent_name>/skills/
~/.agents/skills/
.deepagents/skills/
.agents/skills/
~/.claude/skills/
.claude/skills/
```

### 技能覆盖规则

如果同名 skill 在多个目录都存在：

- 后优先级目录会覆盖前面的同名 skill

### 项目技能为什么依赖 git 根目录

项目级技能只有在 CLI 能识别当前项目根目录时才会被发现。

通常做法是：

- 从当前目录向上找 `.git`

因此没有 git 根目录时，项目技能发现可能不生效。

### 手动调用技能

也可以直接：

```text
/skill:<name> [args]
```

或者在启动时：

```bash
deepagents --skill code-review
```

配合 `-m`、`-n` 或 stdin 也都可以使用。

---

## Subagents in CLI

CLI 也支持通过 markdown 文件定义子代理。

目录格式如下：

```text
.deepagents/agents/{subagent-name}/AGENTS.md
~/.deepagents/{agent}/agents/{subagent-name}/AGENTS.md
```

### 覆盖规则

如果项目级和用户级存在同名子代理：

- 项目级覆盖用户级

### 文件结构理解

子代理的 `AGENTS.md`：

- frontmatter 中定义 `name`、`description`
- markdown 正文作为 `system_prompt`
- 可选 `model` 用于覆盖主 Agent 的模型

### 示例

```markdown
---
name: researcher
description: Research topics on the web before writing content
model: anthropic:claude-haiku-4-5-20251001
---

You are a research assistant with access to web search.

## Your Process
1. Search for relevant information
2. Summarize findings clearly
```

### 这个能力适合什么

- 把研究任务交给更便宜模型
- 给不同子任务定义不同角色
- 做 specialized delegation

### 目前的限制

通过 CLI 的 `AGENTS.md` 方式定义的 subagent，还不能完整配置：

- 独立工具集
- 独立 middleware
- 独立 interrupt_on
- 独立 skills

它们默认继承主 Agent 的工具。

如果需要完全可编程控制，要回到 SDK 层实现。

---

## MCP 工具接入

CLI 可以从 MCP server 加载额外工具。

典型做法是：

- 在项目根目录放 `.mcp.json`
- CLI 启动时自动发现并加载

适合：

- 接数据库
- 接浏览器
- 接内部工具平台
- 接第三方系统

如果你想让 CLI 成为统一工作入口，MCP 是很关键的扩展方式。

---

## 远程沙箱在 CLI 中的工作方式

CLI 采用的是：

- sandbox as tool

也就是说：

- CLI 进程本身跑在你的本地机器
- 但 Agent 的文件操作和命令执行会落到远程 sandbox

### 这意味着什么

本地负责：

- LLM loop
- memory
- skills
- tool dispatch

远程 sandbox 负责：

- 文件系统操作
- `execute`
- 隔离执行环境

这是一个非常实用的架构，因为它既保留了本地交互体验，又把执行副作用隔离出去。

---

## 在 CLI 中启用 sandbox

### 第一步：安装 provider 依赖

例如 Daytona：

```bash
uv tool install deepagents-cli --with langchain-daytona
```

### 第二步：设置 provider 凭证

例如 Daytona：

```bash
export DAYTONA_API_KEY="your-key"
```

### 第三步：启动 CLI 并指定 sandbox

```bash
deepagents --sandbox daytona
```

### 支持的类型

常见包括：

- `langsmith`
- `agentcore`
- `modal`
- `daytona`
- `runloop`

---

## 常用 sandbox 参数

### `--sandbox TYPE`

指定使用哪种远程沙箱。

### `--sandbox-id ID`

复用已存在的沙箱，而不是重新创建。

适合：

- 长期工作区
- 已有环境复用
- 不希望每次启动都重新拉起环境

### `--sandbox-setup PATH`

指定一个在沙箱创建后执行的初始化脚本。

适合：

- clone 仓库
- 安装依赖
- 初始化环境变量
- 切到工作目录

### setup 脚本示例

```bash
#!/bin/bash
set -e

git clone https://x-access-token:${GITHUB_TOKEN}@github.com/username/repo.git $HOME/workspace
cd $HOME/workspace

cat >> ~/.bashrc <<'EOF'
export GITHUB_TOKEN="${GITHUB_TOKEN}"
export OPENAI_API_KEY="${OPENAI_API_KEY}"
cd $HOME/workspace
EOF
source ~/.bashrc
```

### 这类脚本的注意点

CLI 会对 `${VAR}` 做本地环境变量展开，因此：

- 你本地提供什么变量
- 脚本里就可能注入什么内容

所以 setup script 必须可信，不能随便执行陌生来源脚本。

---

## Tracing with LangSmith

如果你希望看到 Agent 每一步做了什么，可以开启 LangSmith tracing。

建议写入：

```text
~/.deepagents/.env
```

例如：

```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=optional-project-name
```

### 启用后有什么用

你可以看到：

- Agent 每次调用的模型
- 工具调用链路
- 决策过程
- 执行步骤
- 线程级 trace

这对调试以下问题特别重要：

- 为什么它调用了某个工具
- 为什么它没调用某个工具
- 哪一步卡住了
- 为什么结果质量不稳定

### CLI 内使用方式

开启后，CLI 通常会显示 tracing 状态。

你也可以使用：

```text
/trace
```

快速打开当前 thread 的 LangSmith 页面。

### 与应用 trace 分离

如果 CLI 是被你的上层应用调用的，那么可能会出现：

- 应用 trace
- CLI trace

都打到同一个项目里

这时可以单独设置：

```bash
DEEPAGENTS_CLI_LANGSMITH_PROJECT=my-deep-agent-execution
LANGSMITH_PROJECT=my-app-traces
```

这样就能把 CLI 内部轨迹和应用外层轨迹拆开。

---

## 管理命令体系

除了交互式使用，CLI 还带了一套管理命令。

### agents

```bash
deepagents agents list
deepagents agents reset --agent NAME
deepagents agents reset --agent NAME --target SOURCE
```

作用：

- 查看 agent
- 重置记忆
- 从别的 agent 复制记忆

### skills

```bash
deepagents skills list
deepagents skills create NAME
deepagents skills info NAME
deepagents skills delete NAME
```

作用：

- 查看 skill
- 创建 skill
- 查看 skill 详情
- 删除 skill

### threads

```bash
deepagents threads list
deepagents threads delete ID
```

作用：

- 浏览历史会话
- 删除指定会话

### update

```bash
deepagents update
```

作用：

- 检查并安装 CLI 更新

### deploy

```bash
deepagents deploy
```

作用：

- 将 agent 部署到 LangSmith

---

## 常见命令行参数

最常用的一组参数包括：

- `--agent NAME`
  - 使用指定 agent 配置

- `--model MODEL`
  - 指定模型

- `--model-params JSON`
  - 指定模型额外参数

- `--message TEXT`
  - 启动后自动提交初始 prompt

- `--skill NAME`
  - 启动时直接调用 skill

- `-n`
  - 非交互模式执行单任务

- `-q`
  - 只输出最终结果，适合 piping

- `--no-stream`
  - 缓冲完整结果后再输出

- `-y`
  - 自动批准所有工具调用

- `-S`
  - shell allow list

- `--sandbox TYPE`
  - 启用远程沙箱

- `--sandbox-id ID`
  - 复用已有沙箱

- `--sandbox-setup PATH`
  - 沙箱初始化脚本

- `--mcp-config PATH`
  - 指定额外 MCP 配置

- `--no-mcp`
  - 禁用 MCP

- `--json`
  - 管理子命令输出 JSON

---

## `-y` / auto-approve 的真实含义

```bash
deepagents -y
```

它的作用是：

- 自动批准所有工具调用
- 跳过人工审批

这是提升效率的开关，但同时也显著提高风险。

适合：

- 你完全信任当前环境
- 你在做低风险本地任务
- 你希望加快自动化流程

不适合：

- 有外部输入
- 有高风险写操作
- 有 shell 执行
- 有远程系统调用

一个简单建议是：

- 先默认不开
- 只有在你足够清楚当前任务边界时再打开

---

## CLI 的长期使用方式

如果想真正把它用成工作助手，推荐形成下面这套习惯：

### 1. 维护全局 `AGENTS.md`

把你的通用偏好写进去。

### 2. 为每个项目维护 `.deepagents/AGENTS.md`

把项目架构、命令、约定写进去。

### 3. 把高频专项工作沉淀成 skills

例如：

- code review
- docs summary
- web research

### 4. 用 `/remember` 把临时经验转成长期记忆

不要每次都重复教同一件事。

### 5. 对高风险操作保留审批

尤其是：

- 写文件
- 执行命令
- 沙箱 setup
- 对外请求

### 6. 开启 tracing 调试复杂问题

尤其是你在做：

- prompt 调优
- skill 调试
- 工具链问题排查

---

## 常见错误与排查

### 启动后模型不可用

常见原因：

- API key 没配
- provider 依赖没装
- 模型名写错

解决：

- 检查 `~/.deepagents/.env`
- 检查 provider integration 是否安装
- 检查模型字符串格式

### skill 明明创建了，但 CLI 不识别

常见原因：

- skill 放错目录
- `SKILL.md` frontmatter 不完整
- 当前目录不在 git 项目里，导致项目级 skill 没被发现
- 没有执行 `/reload`

解决：

- 检查 skill 目录
- 检查 `SKILL.md`
- 执行 `/reload`

### 项目级 `AGENTS.md` 没生效

常见原因：

- 当前不在 git 仓库内
- `.deepagents/AGENTS.md` 不在项目根目录

解决：

- 检查 `.git`
- 检查 `.deepagents/AGENTS.md` 位置

### 非交互模式下 Agent 不执行 shell

这是默认行为，不一定是 bug。

解决：

- 显式加 `-S`
- 例如 `-S "pytest,git,make"`

### sandbox 启动失败

常见原因：

- provider 依赖没安装
- provider 凭证没配置
- setup script 有问题

解决：

- 先单独验证 provider SDK
- 再检查 `--sandbox`、`--sandbox-id`、`--sandbox-setup`

### tracing 没有出现

常见原因：

- `LANGSMITH_TRACING` 没开
- API key 没配
- 项目名配置冲突

解决：

- 检查 `~/.deepagents/.env`
- 用 `/trace` 看是否生成链接

---

## 验收标准

可以用下面这些标准判断 CLI 是否真正进入可用状态：

- 能正常启动并与模型对话
- 能在项目中读写文件和执行命令
- 高风险操作会按预期触发审批
- 记忆能跨 session 生效
- skills 能被自动发现或手动调用
- 项目级 `AGENTS.md` 能影响 Agent 行为
- 非交互模式能稳定处理一次性任务
- 需要时能接入 sandbox 和 LangSmith tracing

---

## 推荐上手顺序

建议按这个顺序使用 CLI：

1. 先配置模型 API key
2. 安装 CLI 并跑通基础对话
3. 在一个项目里试文件读写和命令执行
4. 写项目级 `.deepagents/AGENTS.md`
5. 创建一个简单 skill
6. 体验 `/remember` 和 `/threads`
7. 再尝试非交互模式和 piping
8. 最后接 sandbox、MCP 和 tracing

---

## 关键要点

- CLI 是一个终端里的执行型 Agent，不只是聊天工具
- 它自带文件、命令、搜索、任务、记忆、技能、审批、MCP 和 tracing 能力
- `AGENTS.md` 负责长期上下文，skills 负责专项能力
- 非交互模式适合自动化，交互模式适合日常协作
- sandbox 让执行副作用隔离出去，LangSmith tracing 让执行过程可观察

---

## 写在最后

Deep Agents CLI 的真正价值，在于它把“模型能力、工具能力、记忆能力、审批机制和项目上下文”统一到了一个终端工作界面里。

可以把它理解成三层：

- 第一层：像聊天一样自然地下达任务
- 第二层：像工程系统一样执行文件、命令、搜索和多步骤流程
- 第三层：像长期协作助手一样记住项目、沉淀技能并持续适应你的工作方式

当这三层都建立起来之后，CLI 就不再只是一个会回答问题的终端工具，而是一个能真正参与日常开发工作的长期代理。
