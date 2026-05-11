---
title: Claude Agent SDK学习20 TODO进度跟踪
pubDate: 2026-04-21
categories: ['Claude Agent SDK']
description: '内部有 trace 和日志不代表用户能理解任务进度。Todo 跟踪解决的是“对用户可见的执行进度”。'
slug: claude-agent-todo
---

## 当前 Agent 的问题

第十九章之后，你的 agent 已经具备了强大的治理和观测能力，但从最终用户角度看，它仍然可能像一个黑盒。

用户会问：

- 它现在到底在做哪一步？
- 是已经卡住了，还是正在推进？
- 长任务还有多少工作没完成？

内部有 trace 和日志不代表用户能理解任务进度。Todo 跟踪解决的是“对用户可见的执行进度”。

## 本章功能的作用

这一章会引入：

- `TodoWrite`
- 监听 todo 状态变化
- 把 todo 状态映射成终端或前端 UI

这一层解决的是“用户能不能看懂 agent 现在在干什么”。即使你的系统内部已经有日志和 trace，如果前端用户看不到任务正在推进哪些步骤，长任务体验依然会很差。

官方文档也给了一个比较明确的触发经验：Todo 通常更容易出现在需要 3 个以上明显步骤的复杂任务里，或者用户自己明确给出了一组待办项。因此它不是一个每轮都会出现的信号，而是“任务复杂度足够高时，Claude 主动提供的进度结构”。

## 具体使用方式

### 第一步：给 Claude 一个足够复杂的任务

TodoWrite 通常出现在多步骤任务里。要观察这项能力，prompt 最好不是一句简单问答，而是一个需要规划、拆分、推进的复杂任务。

这是一个非常实际的前提条件。Todo 不是每次都会出现，它通常只在 Claude 判断“有必要把任务拆成几个阶段持续跟踪”时才会产生。因此，示例任务本身必须足够复杂，才能让这项能力有发挥空间。

Todo 的生命周期也比很多人想的更明确：通常是先以 `pending` 创建，进入执行时变成 `in_progress`，完成后变成 `completed`，最后整组任务结束时可能会被移除。理解这条状态流后，你的前端才能正确映射“已完成多少、当前在做什么、还有没有剩余任务”。

### 第二步：在 `assistant` 消息中查找 `tool_use` 块

Todo 不是独立消息类型，而是 `assistant` 内容块中的工具调用。因此你需要遍历 `message.message.content`，寻找 `type === "tool_use"` 且 `name === "TodoWrite"` 的块。

### 第三步：读取每个 todo 的状态和内容

一旦拿到 `TodoWrite`，就可以从 `block.input.todos` 中提取待办项列表。每一项至少包含状态和文本内容，这已经足够驱动一个基础进度面板。

### 第四步：把 todo 状态映射成用户可读 UI

最简单的做法是打印 `pending`、`in_progress`、`completed`；更完整的做法可以映射成进度条、步骤列表或 IDE 侧边栏状态。

## 关键概念

### 1. Todo 不是额外 API，而是消息流的一部分

Claude 在适当场景下会通过 `TodoWrite` 工具块更新待办列表。

### 2. Todo 的典型生命周期

- `pending`
- `in_progress`
- `completed`

### 3. 为什么它很重要

对于复杂任务，Todo 能显著改善“用户是否知道系统还在工作”的体验。

## 可运行示例

把下面代码保存为 `chapter-20-todos.ts`：

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  for await (const message of query({
    prompt: "Plan and describe how to optimize a React application's performance, and track progress with todos.",
    options: {
      maxTurns: 15
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use" && block.name === "TodoWrite") {
          console.log("\nTodo update:");
          for (const todo of block.input.todos) {
            console.log(`- ${todo.status}: ${todo.content}`);
          }
        }
      }
    }

    if (message.type === "result") {
      console.log("\nFinal result:\n");
      console.log(message.result);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

运行：

```bash
npx tsx chapter-20-todos.ts
```

## 示例拆解

### 第一步：使用一个天然适合拆步骤的性能优化任务

示例 prompt 要求 Claude 规划并说明 React 性能优化方案，这类任务很容易触发待办拆分，因此适合教学演示。

### 第二步：把 `maxTurns` 拉高，给 Claude 足够推进空间

如果最大轮数太低，Claude 可能还没来得及建立或更新 todo 列表，任务就被截断了。示例中的 `maxTurns: 15` 就是在给它足够的执行空间。

### 第三步：在 `assistant` 消息里提取 `TodoWrite`

示例逐个遍历内容块，并在发现 `TodoWrite` 时立刻打印所有 todo。这里展示的是最直接的“消息流转 UI 状态”的路径。

### 第四步：把最终自然语言结果和中间 todo 更新分开显示

示例中 todo 更新会先出现在过程里，而最终结论在 `result` 中统一打印。这种分离方式非常适合真实产品中的“进度区 + 结果区”界面设计。

## 运行时你应该观察什么

- 复杂任务中，Claude 很可能会产出 `TodoWrite`
- 你会在终端中看到待办项从 pending 走到 completed

## 易错点

- 不是每个简单任务都会触发 TodoWrite。
- Todo 适合做用户进度反馈，但不能替代真正的审计日志或错误处理。

## 本章结束后你应该掌握

- 如何从消息流中监听 TodoWrite
- 如何把任务状态映射为用户可见的进度
- 为什么“用户可理解的过程展示”也是 agent 产品的一部分

## 本章小结

到这里，你的 agent 已经不只是“强大”，还开始变得“对用户透明”。这对长任务体验尤为重要。
