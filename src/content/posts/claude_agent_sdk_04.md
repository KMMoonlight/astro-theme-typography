---
title: Claude Agent SDK学习04 流式输入
pubDate: 2026-05-07
categories: ['Claude Agent SDK']
description: '把输入模型从“启动前一次性交付”改成“执行过程中持续补充”。'
slug: claude-agent-sdk-stream-input
---
## 当前 Agent 的问题

第三章之后，你的 agent 已经能跨调用记住上下文，但它还有一个非常明显的交互缺口：所有信息都必须在启动时一次性给完。

这和真实使用场景并不匹配。用户通常会这样工作：

- 先给一个目标
- 再补一个限制
- 再追加一个文件、截图或更具体的说明

如果你的 agent 只能在开始时接受一条静态 prompt，它就更像批处理脚本，而不像一个可协作系统。

## 本章功能的作用

这一章会把输入模式从“单条字符串”升级为“持续消息流”。

你要掌握的是：

- `prompt` 不一定是字符串，也可以是异步消息生成器
- 一个 `query()` 调用过程中可以连续送入多条用户消息

本章最核心的变化，是把输入模型从“启动前一次性交付”改成“执行过程中持续补充”。这使得 agent 更像一个正在协作的对象，而不是一个拿到完整任务包才开始工作的离线脚本。

官方文档把这种模式直接定义为推荐模式，因为它天然支持图片、排队消息、插入式补充说明以及更自然的中断处理。也就是说，流式输入并不是一个少数高级场景的技巧，而是更接近真正产品形态的默认交互模式。

## 具体使用方式

### 第一步：把 `prompt` 从字符串改成异步生成器

当你希望同一轮任务中连续追加信息时，把 `prompt` 改成 `async function*`。你每次 `yield` 一条消息，SDK 就会把它注入当前会话，而不是开启新 query。

从编程接口角度看，这一步相当于把“请求体”升级成“输入流”。一旦接受这个模型，后面你接图片、接用户中途补充说明、接审批结果，就都会变得顺理成章。

这也是为什么它和“单字符串 prompt + 多次 resume”不完全一样。两者都能把信息分段送给 Claude，但流式输入发生在同一次 query 内部，Claude 不需要重新建立一个新的调用边界。

### 第二步：每次只追加一个明确的新信息

流式输入最适合承载“增量补充”，例如补约束、补文件、补重点。不要把它写成多个重复 prompt，而应该让每一条消息只承担一个新增意图。

这是因为 Claude 会把后续消息当成对当前任务的修正。如果你每次都把前面说过的话全部重复一遍，真正新增的限制反而会被旧信息稀释，阅读和推理成本都会更高。

### 第三步：必要时在消息之间等待外部事件

示例里的 `setTimeout` 只是最简单的模拟。实际系统里，这里可以替换成用户输入、上传完成、人工审批结果，或者别的服务返回的新上下文。

换句话说，流式输入不是为了“让例子看起来更高级”，而是为了贴近真实产品交互。真实世界里的上下文几乎从来都不是一次性齐备的，而是随着任务推进不断到达。

### 第四步：仍然只维护一个 query 实例

流式输入的重点是“同一次 query 内追加消息”。如果你为了补一句话就重新调用一次 `query()`，那就退回到了多轮 session，而不是单次流式输入。

## 关键概念

### 流式输入和 session 的区别

- session 解决“下一次调用怎么接着上一次”
- 流式输入解决“这一次调用过程中能不能继续喂消息”

二者常常配合使用，但不是一回事。

### 为什么流式输入重要

它是这些体验的基础：

- 聊天式协作
- 运行过程中补充约束
- 插入图片输入
- 更自然的审批和澄清问题处理

### `prompt` 变成消息生成器后，SDK 在做什么

SDK 会把你 `yield` 出来的每条消息加入同一个 agent 会话。Claude 会把它们理解成同一任务上下文中的连续输入，而不是多个相互独立的调用。

## 可运行示例

把下面代码保存为 `chapter-04-streaming-input.ts`：

```ts
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch04-"));

  try {
    await writeFile(
      join(workspace, "README.md"),
      "# Demo App\n\nThis app has an authentication layer and a billing layer.\n",
      "utf8"
    );
    await writeFile(join(workspace, "auth.ts"), "export function login() { return true; }\n", "utf8");
    await writeFile(join(workspace, "billing.ts"), "export function charge() { return 42; }\n", "utf8");

    async function* promptStream() {
      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: "Inspect this workspace and tell me what the project seems to do."
        }
      };

      await new Promise((resolve) => setTimeout(resolve, 500));

      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: "Focus more on the authentication part than the billing part."
        }
      };
    }

    for await (const message of query({
      prompt: promptStream(),
      options: {
        cwd: workspace,
        allowedTools: ["Read", "Glob", "Grep"],
        permissionMode: "dontAsk"
      }
    })) {
      if (message.type === "result") {
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
npx tsx chapter-04-streaming-input.ts
```

## 示例拆解

### 第一步：先准备一个带多个模块的工作区

示例同时写入 `README.md`、`auth.ts` 和 `billing.ts`，目的是让 Claude 初始时有多个可能关注点，便于第二条输入把重点重新拉回认证模块。

### 第二步：定义 `promptStream()`

`promptStream()` 是整章最关键的结构。它先发第一条“整体总结”消息，再延迟发送第二条“聚焦认证”消息，从而模拟真实协作中的补充说明。

这里的延迟不是重点，重点是顺序。第一条消息先让 Claude 建立全局认识，第二条消息再把注意力重新压到认证模块，这正好复现了人和 agent 协作时最常见的工作节奏。

### 第三步：让 `query()` 消费这个生成器

当 `prompt` 传入的是 `promptStream()` 时，SDK 会把两条消息都视为同一任务中的连续输入。Claude 不会把第二条当成新会话，而会把它当成当前任务的最新约束。

### 第四步：只在最后读取结果，验证关注点是否被改变

示例最后只打印 `result`，你应该观察到最终输出不只是总结项目，还明显更偏向 `auth.ts`。这说明后续追加输入已经成功改变了会话方向。

## 运行时你应该观察什么

- 第一条消息让 Claude 建立全局认识
- 第二条消息不会开启新任务，而是改变当前任务关注点
- 最终回答应该更偏向 `auth.ts`

## 易错点

- 不要把流式输入理解成“输出逐字显示”，那是下一章的主题。
- 流式输入解决的是消息进入方式，不是结果返回方式。

## 本章结束后你应该掌握

- 什么情况下该把 `prompt` 从字符串升级为消息流
- 为什么流式输入更适合 IDE、Web chat 和协作代理
- 它如何为后续图片输入和审批流打基础

## 本章小结

到这里，你的 agent 已经从“单次调用任务”变成了“可持续接受上下文补充的协作对象”。这一步是实现真实交互产品的关键分水岭。
