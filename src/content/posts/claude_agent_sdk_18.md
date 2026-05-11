---
title: Claude Agent SDK学习18 成本与Usage
pubDate: 2026-04-23
categories: ['Claude Agent SDK']
description: '把成本与 usage 变成一个可读、可记录、可告警的信号。'
slug: claude-agent-sdk-cost-usage
---

## 当前 Agent 的问题

第十七章之后，你的 agent 已经能回滚文件，但它还有一个非常现实的问题：你不知道它到底花了多少钱。

在实验阶段这可能只是“好奇”，但一旦进入产品环境，它会变成：

- 怎么限制单次任务预算？
- 为什么某类任务明显更贵？
- 多轮会话到底消耗了多少 token？

所以这一章的目标，是把成本与 usage 变成一个可读、可记录、可告警的信号。

## 本章功能的作用

这一章会引入：

- `total_cost_usd`
- `usage`
- 按 step 统计 usage 的思路

它让 agent 从“能工作”进一步变成“可以被运营”。一旦任务开始变长、用户开始变多、工具调用开始变重，你就不能只关心结果，还必须知道每次执行花了多少 token、成本集中在哪些步骤上。

这里最重要的官方提醒是：`total_cost_usd` 只是 SDK 本地估算值，不是账单权威数据。它对开发期预算、趋势观测和成本对比非常有用，但不应该直接拿去做结算或用户计费决策。

## 具体使用方式

### 第一步：把 `result` 当成单次 query 的成本收口点

如果你只关心一次调用的大盘数据，最直接的做法是在 `result` 上读取 `total_cost_usd` 和 `usage`。这两个字段适合直接写入日志、监控或调试输出。

很多人会把成本记录散落在中间步骤里，结果很难形成一致口径。以 `result` 作为单次 query 的统一收口点，可以让你的成本统计在结构上更清楚，也更容易和任务状态关联起来。

如果你要进一步拆到步骤级，官方建议按 assistant message 的 `id` 去重。因为并行工具调用时，多条 assistant 消息可能共享同一个 step ID 和同一份 usage 数据，直接累加会把成本虚高。

### 第二步：在 `assistant` 消息层做更细粒度统计

如果你想分析每一步消耗，就需要在 `assistant` 消息出现时读取其中的 `usage`。这比只看最终总额更适合定位哪些步骤最贵。

### 第三步：按 assistant step ID 去重

复杂任务里，多个工具回流可能围绕同一个 assistant step 展开。如果不去重，你自己累加出来的 token 用量会高于真实值。

### 第四步：把单次 query 和跨 query 统计分开

SDK 会告诉你“这一次 query 花了多少”，但不会自动给你“整个 session 或整位用户累计花了多少”。跨调用聚合应该由宿主应用自己做。

## 关键概念

### 1. `total_cost_usd` 是估算值

它适合做：

- 开发预算
- 任务分析
- 趋势监控

它不适合做权威计费结算。

### 2. `ResultMessage` 是单次 `query()` 的成本收口

如果你有多次 `query()`，就应该在应用层自己累加。

### 3. 并行工具调用会影响 step 级统计

如果你自己累加 assistant step usage，要按 message ID 去重，因为并行工具调用可能共享同一个 step ID。

## 可运行示例

把下面代码保存为 `chapter-18-cost-and-usage.ts`：

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  let seenAssistantIds = new Set<string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for await (const message of query({
    prompt: "Explain the difference between sessions, hooks, and MCP in the Claude Agent SDK."
  })) {
    if (message.type === "assistant") {
      const id = message.message.id;
      if (!seenAssistantIds.has(id)) {
        seenAssistantIds.add(id);
        totalInputTokens += message.message.usage.input_tokens;
        totalOutputTokens += message.message.usage.output_tokens;
      }
    }

    if (message.type === "result") {
      console.log("Estimated total cost:", message.total_cost_usd);
      console.log("Final usage object:", message.usage);
    }
  }

  console.log("Unique assistant steps:", seenAssistantIds.size);
  console.log("Input tokens (deduped):", totalInputTokens);
  console.log("Output tokens (deduped):", totalOutputTokens);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

运行：

```bash
npx tsx chapter-18-cost-and-usage.ts
```

## 示例拆解

### 第一步：用一个纯问答任务保持统计结果稳定

示例没有引入工具或文件改动，是为了让读者先看清 usage 结构和去重逻辑，而不是把注意力分散到执行链上。

### 第二步：在 `assistant` 消息里按 `message.id` 去重

代码把 `message.message.id` 放进 `Set` 中，只有第一次见到该 ID 才累计 token。这里演示的是实际做 step 级成本统计时最容易忽略的一步。

### 第三步：在 `result` 里读取最终估算成本

`message.total_cost_usd` 直接给出单次 query 的大盘成本，而 `message.usage` 给出更底层的 token 信息。两者通常应该一起记录。

### 第四步：把“估算成本”和“去重后步骤统计”同时输出

示例并列打印两组数据，是为了让读者理解它们解决的是两个不同问题：一个偏预算，一个偏诊断。

## 运行时你应该观察什么

- 最终结果里会包含单次 query 的估算成本
- 你也能看到按唯一 assistant step 去重后的 token 统计

## 易错点

- 不要把 `total_cost_usd` 当作账单。
- 失败 query 也可能消耗 token，因此 error result 也应该统计。
- 多次 query 的费用不会自动汇总成 session 总额。

## 本章结束后你应该掌握

- 成本数据应该从哪里读
- step 级 usage 为什么要去重
- 如何把成本信号接入应用监控与预算控制

## 本章小结

到这里，你的 agent 已经不只是“会工作”，而是开始具备“成本可见性”。这对任何长期运行的系统都不可或缺。
