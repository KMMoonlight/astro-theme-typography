---
title: Claude Agent SDK学习01 搭建最小的Agent
pubDate: 2026-05-10
categories: ['Claude Agent SDK']
description: '让 Claude Agent SDK 跑起来，并且让 Claude 真正开始调用工具。'
slug: claude-agent-sdk-agent-simple
---
## 当前 Agent 的问题

在这一章开始之前，我们其实还没有一个真正的 agent，只有一个模糊目标：希望 Claude 不只是返回一段文本，而是能为了任务主动做事。

这时系统有三个明显缺口：

- 它不能自己决定是否要读文件、查目录或搜索内容。
- 它没有接入真实工作区，所以所有回答都只能靠“猜”。
- 它没有统一的执行入口，我们还没把“任务目标”和“工具能力”装配成一个程序。

如果你现在只调用普通模型 API，模型最多只能推测“这个目录里可能有什么文件”，而不是先查看真实文件再回答。

## 本章功能的作用

这一章的任务只有一个：让 Claude Agent SDK 跑起来，并且让 Claude 真正开始调用工具。

这一章会引入两个最基础的概念：

- `query()`：启动 agent loop 的入口
- `allowedTools`：告诉 Claude 哪些工具可以直接使用

从工程意义上看，这一章并不是在教你“如何发出一次请求”，而是在搭一个最小但真实的 agent 运行闭环。Claude 会先进入你指定的工作目录，再根据你开放的工具去发现文件、读取文件，最后才组织回答。只有先建立这个闭环，后面讲的会话恢复、审批、流式输出、自定义工具才有落点。

这一章还有一个容易被忽略的现实前提：TypeScript SDK 自带 Claude Code 二进制的可选依赖，所以你不需要额外安装 Claude Code CLI。对学习者来说，这意味着只要 Node 版本和 API Key 正确，最小示例应该能直接启动，不需要再处理额外的本地工具链。

先用这张图建立最小执行闭环，会比直接看代码更容易：

```mermaid
flowchart LR
    A["应用调用 query()"] --> B["Claude 接收 prompt"]
    B --> C["在 cwd 中调用 Glob / Read"]
    C --> D["读取真实文件内容"]
    D --> E["基于真实上下文回答"]
```

请注意，这一章还不会加入：

- 会话恢复
- 流式输入输出
- 审批
- 结构化输出

第一步只追求“能跑通一个最小只读 agent”。

## 具体使用方式

### 第一步：导入 `query()`

你先把 `query()` 当成整个 agent 的启动器。只要你希望 Claude 进入“观察环境 -> 决定是否调用工具 -> 继续回答”的执行模式，就应该从 `query()` 开始，而不是从普通文本 completion 开始。

很多人第一次接触 SDK 时，会习惯性地把它和普通聊天 API 类比，期待“传入字符串，返回字符串”。但 `query()` 背后的模型其实更接近一个任务运行器。它代表的是一次完整 agent 执行过程，而不是一条孤立回答。

### 第二步：给 agent 一个明确工作目录

通过 `options.cwd` 指定 Claude 要工作的目录。这个参数的作用不是“告诉模型一个字符串路径”，而是把工具执行范围绑定到这个目录里。没有 `cwd`，Claude 就算能调工具，也不知道应该看哪一份真实文件。

### 第三步：先只开放只读工具

第一章建议只开放 `Glob` 和 `Read`。使用方式非常直接：

- `Glob` 用来发现文件
- `Read` 用来读取文件内容

这一步的重点不是工具数量，而是建立一个稳定的最小闭环：Claude 先找文件，再读文件，再基于真实内容回答。

这里故意不开放 `Bash`、`Write` 之类更强的能力，是因为学习阶段最重要的是看清“Claude 是不是先观察了真实环境”。只读工具虽然能力少，但路径最纯粹，最适合建立正确心智模型。

### 第四步：处理异步消息流

`query()` 的返回值要用 `for await ... of` 消费。即使你这一章只关心最后结果，也不要把它理解成一个同步返回字符串的函数。后面所有高级能力，都会建立在这个“异步消费消息流”的写法之上。

也就是说，就算当前示例只在最后打印一次结果，你的代码结构也必须从第一天开始适应“过程会不断产生消息”这件事。否则到了后面要接流式输出、审批或者 Todo 跟踪时，就必须回头重写整个执行框架。

## 关键概念

### `query()` 是一个 agent 入口，不是一次普通 completion

`query()` 返回的是一个异步消息流。这意味着 SDK 假设你要运行的是一个持续推进任务，而不是只等待一段最终字符串。

### 工具决定了 agent 的执行边界

Agent SDK 的核心价值之一，是让 Claude 可以调用工具。但前提是你必须开放这些工具。

对于最小学习示例，我们只开放只读工具：

- `Glob`：按模式查找文件
- `Read`：读取文件内容

这样做的好处是：

- 示例足够安全
- 现象足够直观
- 更容易确认 Claude 的回答来自真实环境，而不是想象

### 为什么第一章不推荐上来就开 `Bash`

`Bash` 很强，但也更难验证。学习阶段先让 Claude 通过 `Glob` 和 `Read` 获得真实信息，最容易建立正确心智模型。

## 前置准备

在任意空目录中执行：

```bash
npm init -y
npm install @anthropic-ai/claude-agent-sdk
npm install -D tsx
export ANTHROPIC_API_KEY=your-api-key
```

如果你使用 `.env` 管理环境变量，也可以自行加载，只要运行时 `ANTHROPIC_API_KEY` 存在即可。

## 可运行示例

把下面代码保存为 `chapter-01-minimal-agent.ts`：

```ts
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch01-"));

  try {
    await writeFile(
      join(workspace, "README.md"),
      "# Demo Project\n\nThis workspace is used by the minimal Agent SDK example.\n",
      "utf8"
    );
    await writeFile(
      join(workspace, "notes.txt"),
      "Remember to explain what files exist and what they are used for.\n",
      "utf8"
    );

    for await (const message of query({
      prompt: "Use the available tools to inspect this workspace, list the files, and explain what each file is for.",
      options: {
        cwd: workspace,
        allowedTools: ["Glob", "Read"],
        permissionMode: "dontAsk"
      }
    })) {
      if (message.type === "result" && message.subtype === "success") {
        console.log("Final answer:\n");
        console.log(message.result);
      }
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

运行：

```bash
npx tsx chapter-01-minimal-agent.ts
```

## 示例拆解

### 第一步：脚本先创建一个临时工作区

`mkdtemp()` 会在系统临时目录下生成一个独立目录，确保这个例子不依赖你的仓库状态。这样读者复制脚本后，不需要手工准备任何测试文件。

这种写法最大的价值是可复现。无论谁在什么机器上运行这个脚本，Claude 看到的都是同一组输入文件，因此示例行为会比较稳定，学习时也更容易判断问题到底出在代码还是环境。

### 第二步：写入 `README.md` 和 `notes.txt`

这两个文件的作用是故意给 Claude 一个最小但可验证的观察对象。`README.md` 提供项目级说明，`notes.txt` 提供额外任务提示。Claude 只有真的读过文件，才可能解释出各自用途。

这一步其实是在为后面的验证标准埋钩子。最终回答如果只提到“目录里有两个文件”，说明它可能只完成了文件发现；如果能解释 `README.md` 和 `notes.txt` 的职责，才说明它真的完成了发现、读取和理解这三个动作。

### 第三步：调用 `query()` 并传入三类核心参数

`prompt` 负责定义任务目标，`cwd` 负责定义工作区，`allowedTools` 负责定义能力边界。三者合在一起，才构成一个真正可控的最小 agent。

这三个参数在后续 20 章里会一直重复出现。你可以把它们记成一个固定框架：`prompt` 回答“要做什么”，`cwd` 回答“在什么环境里做”，`allowedTools` 回答“允许通过哪些手段做”。

### 第四步：只在 `result` 消息里打印最终答案

这个示例故意不处理 `assistant`、`system` 等中间消息，只保留最后的 `result`。这样读者可以先把注意力放在“最小 agent 能否跑通”这件事上，下一章再展开消息流细节。

## 这个示例为什么能直接运行

- 它自己创建了一个临时工作区，不依赖你事先准备文件。
- 它只使用 `Glob` 和 `Read`，不会触发写入、删除或执行命令。
- 它明确设置了 `cwd`，因此 Claude 的工作范围是稳定且可预测的。
- `permissionMode: "dontAsk"` 配合只读工具，意味着不会出现交互式审批阻塞。

## 运行时你应该观察什么

运行成功后，你应该看到 Claude 基于真实文件生成的回答，而不是凭空猜测目录结构。

最重要的观察点有两个：

- Claude 的结论应该提到 `README.md` 和 `notes.txt`
- 回答内容应该体现“它看过文件内容”，而不只是说“有两个文件”

## 本章结束后你应该掌握

- 如何安装和启动 Claude Agent SDK
- 如何通过 `query()` 启动最小 agent
- 如何用 `allowedTools` 收紧能力边界
- 如何用 `cwd` 把 agent 限制在一个明确的工作区中

## 本章小结

到这里，你已经拥有了一个真正的最小 agent。它和“普通 LLM 调用”的关键区别是：

- 它可以访问真实环境
- 它可以先观察再回答
- 它具备后续叠加所有高级能力的基础执行入口
