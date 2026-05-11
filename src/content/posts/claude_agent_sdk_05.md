---
title: Claude Agent SDK学习05 实时流式输出
pubDate: 2026-05-06
categories: ['Claude Agent SDK']
description: '把输出从“整块返回”升级为“边生成边显示”。'
slug: claude-agent-sdk-stream
---
## 当前 Agent 的问题

第四章之后，agent 输入已经可以持续追加，但输出仍然是“整段完成后一次性返回”。

这在真实产品里会很难用：

- Claude 可能已经在生成长回答，但界面还是空白
- 用户无法判断系统是正在工作还是卡住了
- 你没法实现逐字渲染、实时进度反馈和打字机效果

所以这一章的目标，是把输出从“整块返回”升级为“边生成边显示”。

## 本章功能的作用

这一章会引入部分消息流，也就是 partial messages。

你要掌握的是：

- `includePartialMessages`
- `stream_event`
- 如何从事件里提取 `text_delta`

这一章的重点不是“把文字早点打印出来”这么简单，而是把 agent 的执行过程暴露成一个可以被界面实时消费的信号流。只要你希望用户看到打字机效果、进度感或者即时响应，这一层就是必需的。

官方消息流里不只会流出文本，还会流出工具输入块、消息开始和结束事件。因此这一章虽然先聚焦 `text_delta`，但你应该知道 `stream_event` 是更通用的实时事件总线，而不只是一个“逐字打印器”。

## 具体使用方式

### 第一步：显式开启 `includePartialMessages`

如果不打开这个开关，SDK 主要会给你完整消息。要做实时逐字渲染，第一步就是在 `options` 中加入 `includePartialMessages: true`。

可以把这个开关理解成“告诉 SDK：除了最终完整消息，我还要过程增量”。没有它，Claude 也会生成文本，但你的程序只能在整段完成后一次性看到。

官方文档给出的顺序也值得记住：通常会先看到 `message_start`、`content_block_start`、多次 `content_block_delta`、`content_block_stop`，最后才汇总成完整 `AssistantMessage`。理解这条顺序后，你在前端就不会再把“流式片段”和“完整消息对象”混为一谈。

### 第二步：只对 `stream_event` 做增量渲染

实时输出不是把所有消息都打印出来，而是只在 `message.type === "stream_event"` 时处理增量片段。这样你的 UI 才不会把中间对象结构和最终结果混在一起。

### 第三步：过滤到真正的文本 delta

最常见的渲染路径是 `content_block_delta -> text_delta`。你应该先判断事件类型，再判断 delta 类型，最后才把 `event.delta.text` 写到终端或界面。

### 第四步：把“实时展示”和“最终收口”分开

流式文本只负责用户体验，真正的结束状态、usage、session_id 仍然在 `result` 里统一读取。这两个通道在工程上应该分开处理。

## 关键概念

### 完整消息和增量消息的区别

默认情况下，SDK 主要给你完整的 `AssistantMessage`。这适合存档和最终展示，但不适合即时反馈。

开启 `includePartialMessages` 后，SDK 会额外产出 `stream_event`。这些事件是 Claude 正在生成内容时的增量片段。

### 最常见的文本事件链

如果你想拿到逐字输出，通常要这样判断：

1. `message.type === "stream_event"`
2. `event.type === "content_block_delta"`
3. `event.delta.type === "text_delta"`

### 为什么最终结果仍然要看 `ResultMessage`

流式事件只是过程片段，它不代表整次调用已经结束。真正的结束状态、成本和 `session_id` 仍然在 `ResultMessage` 里。

## 可运行示例

把下面代码保存为 `chapter-05-streaming-output.ts`：

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  for await (const message of query({
    prompt: "Explain what an agent loop is, using three short paragraphs and simple language.",
    options: {
      includePartialMessages: true
    }
  })) {
    if (message.type === "stream_event") {
      const event = message.event;
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      }
    }

    if (message.type === "result") {
      console.log("\n\n--- done ---");
      console.log("status:", message.subtype);
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
npx tsx chapter-05-streaming-output.ts
```

## 示例拆解

### 第一步：用一个纯文本任务触发稳定输出

示例没有让 Claude 调工具，而是让它解释 agent loop。这样可以把注意力集中在输出流本身，而不是被工具消息干扰。

### 第二步：在 `stream_event` 分支里逐字打印

`process.stdout.write()` 的作用是直接把每个 `text_delta` 片段追加到终端，而不是等整段字符串组装完成后再一次性 `console.log()`。

### 第三步：在 `result` 分支里补上结束标记

示例专门输出 `--- done ---`，是为了让读者观察到一个重要事实：流式文本出现很早，但任务完成信号总是最后到。

### 第四步：用最小脚本建立 UI 心智模型

这个例子虽然简单，但它已经等价于很多 Web chat 或 IDE 面板里的基础渲染逻辑。后续你只需要把 `stdout` 替换成前端状态更新即可。

## 运行时你应该观察什么

- 文本会逐步打印出来，而不是最后一次性显示
- 直到最后才会出现 `--- done ---`

## 一个常见延伸

除了文本，工具调用输入也会逐步流出。后续如果你要做“Claude 正在读取文件”“Claude 正在生成命令”这类高级 UI，就需要继续解析更多 `stream_event` 类型。

## 易错点

- `stream_event` 不是最终结果，要自己处理拼接与展示。
- 不能因为有了流式输出，就忽略完整 `AssistantMessage` 和 `ResultMessage`。

## 本章结束后你应该掌握

- 如何做终端逐字输出
- 如何把增量渲染和最终落盘分开
- 为什么实时 UI 需要围绕 `stream_event` 设计

## 本章小结

到这里，你的 agent 已经具备了“看起来像在实时工作”的能力。对于用户体验来说，这往往比单纯提升模型质量更直接。
