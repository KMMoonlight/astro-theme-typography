---
title: Claude Agent SDK学习14 Tool Search
pubDate: 2026-04-27
categories: ['Claude Agent SDK']
description: '这时问题不再是“有没有工具”，而是“工具太多怎么办”。'
slug: claude-agent-sdk-tool-search
---
## 当前 Agent 的问题

第十三章之后，你的 agent 已经可以接入很多工具，但工具一多，就会出现新的问题：

- 工具 schema 会吞掉大量上下文
- Claude 在太多工具里更容易选错
- 每轮请求都携带全量工具定义会拖慢执行

这时问题不再是“有没有工具”，而是“工具太多怎么办”。

## 本章功能的作用

这一章会引入 Tool Search，让 Claude 不必一开始就把所有工具定义都载入上下文，而是按需搜索、按需加载。

它解决的不是“权限”问题，而是“规模”问题。当工具数量开始增长时，真正的挑战已经不是能不能接入工具，而是如何让 Claude 在不被大量 schema 压垮上下文的前提下，仍然选对那一把工具。

官方文档给出的数字非常有参考价值：几十把工具的 schema 就可能吃掉上万 token，而且当一次性加载的工具超过 30 到 50 把时，模型的工具选择准确率通常会明显下降。也正因为如此，Tool Search 更像一个系统规模增长后的必要机制，而不是小示例里的锦上添花。

## 具体使用方式

### 第一步：先判断工具集是否足够大

Tool Search 不是所有场景都必须开。只有当工具很多、schema 很重、工具选择容易混乱时，它的收益才明显。小工具集直接加载通常更简单。

这一判断能帮助你避免过度设计。小规模示例里直接加载工具往往最清楚，而 Tool Search 更像是当工具系统开始扩张后才值得投入的优化层。

还有一个官方边界也值得记住：默认情况下 Tool Search 实际上是开启的，只是是否“明显感觉到它存在”取决于你工具集的规模和配置阈值。只有在你显式把 `ENABLE_TOOL_SEARCH` 设为 `"false"` 时，系统才会彻底回到“所有工具定义每轮都直接加载”的模式。

### 第二步：保证工具名和描述足够可检索

Tool Search 本质上依赖语义匹配。如果工具名称和描述过于抽象，例如都叫 `process_data`、`handle_task`，Claude 即使能搜索，也很难定位正确工具。

### 第三步：通过环境变量控制启用策略

最常见方式是在 `options.env` 中设置 `ENABLE_TOOL_SEARCH`。`auto:5` 的含义可以理解为：当工具数量达到一定规模时再自动启用。

### 第四步：仍然保留精确授权边界

Tool Search 只优化工具发现和上下文装载，不替代权限控制。即使启用了搜索，你仍然应该通过 `allowedTools` 明确限定可调用范围。

## 关键概念

### 1. Tool Search 解决的不是权限，而是发现与上下文效率

它主要优化两件事：

- 减少工具 schema 占用的上下文
- 提高在大工具集下的选择质量

### 2. 什么时候最有价值

文档给出的建议非常明确：

- 小工具集：直接加载通常更快
- 大工具集：Tool Search 更合适

### 3. 常见开关形式

通过环境变量控制：

- `true` 或不设置：始终开启
- `auto`
- `auto:5`
- `false`

## 可运行示例

这个示例不依赖外部 MCP 服务，而是程序里自己生成一组工具，让你看到 Tool Search 的配置方式。

把下面代码保存为 `chapter-14-tool-search.ts`：

```ts
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

function makeTool(name: string, description: string, handler: (value: number) => number) {
  return tool(
    name,
    description,
    { value: z.number() },
    async ({ value }) => ({
      content: [{ type: "text", text: `${name}(${value}) = ${handler(value)}` }]
    })
  );
}

const tools = [
  makeTool("double_value", "Double a number", (v) => v * 2),
  makeTool("triple_value", "Triple a number", (v) => v * 3),
  makeTool("square_value", "Square a number", (v) => v * v),
  makeTool("half_value", "Halve a number", (v) => v / 2),
  makeTool("ten_x_value", "Multiply a number by ten", (v) => v * 10),
  makeTool("negate_value", "Return the negative version of a number", (v) => -v),
  makeTool("plus_one", "Add one to a number", (v) => v + 1),
  makeTool("minus_one", "Subtract one from a number", (v) => v - 1)
];

const server = createSdkMcpServer({
  name: "number-tools",
  version: "1.0.0",
  tools
});

async function main() {
  for await (const message of query({
    prompt: "Use the available tools to square the number 9.",
    options: {
      mcpServers: { "number-tools": server },
      allowedTools: ["mcp__number-tools__*"],
      env: {
        ...process.env,
        ENABLE_TOOL_SEARCH: "auto:5"
      }
    }
  })) {
    if (message.type === "result") {
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
npx tsx chapter-14-tool-search.ts
```

## 示例拆解

### 第一步：脚本先生成一组相似但可区分的数值工具

示例故意造出 `double_value`、`triple_value`、`square_value` 等多个工具，目的就是模拟“大工具集下需要搜索”的场景。

### 第二步：把这些工具统一挂到 `number-tools` server

这样做可以把注意力集中在“工具太多怎么办”，而不是分散到多个 server 的接入细节上。

### 第三步：通过 `env` 设置 `ENABLE_TOOL_SEARCH: \"auto:5\"`

这一步是本章真正的开关。它告诉 SDK：不要盲目把所有工具 schema 全量塞入上下文，而是在规模达到阈值时启用搜索机制。

### 第四步：用一个只适合单个工具的问题做验证

Prompt 要求“把 9 平方化”，按理说最合适的就是 `square_value`。如果最终选择正确，就说明 Tool Search 的发现路径是有效的。

## 运行时你应该观察什么

- Claude 最终应该选择与 `square_value` 最相关的工具
- 你不需要在 prompt 中手工指定它一定要调用哪个工具

## 易错点

- Tool Search 的价值主要在大工具集，小工具集不一定更快。
- 工具名称和描述写得差时，搜索效果会明显下降。

## 本章结束后你应该掌握

- Tool Search 解决的核心瓶颈是什么
- 怎么配置 `ENABLE_TOOL_SEARCH`
- 为什么工具命名和描述会直接影响工具发现效果

## 本章小结

到这里，你的 agent 已经开始具备“规模化工具接入能力”。这不是表面上的优化，而是大规模 agent 系统能否稳定工作的关键。
