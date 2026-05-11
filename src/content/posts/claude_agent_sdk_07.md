---
title: Claude Agent SDK学习07 结构化输出
pubDate: 2026-05-04
categories: ['Claude Agent SDK']
description: '让 agent 的最终输出从自然语言升级为被 schema 约束的数据。'
slug: claude-agent-sdk-structured-output
---
## 当前 Agent 的问题

第六章之后，你的 agent 已经能安全地执行工具，但结果仍然有一个根本性的工程缺口：输出还是自由文本。

自由文本适合人类阅读，但一旦你要接系统，就会变得脆弱：

- 前端需要稳定字段才能渲染
- 后端需要明确结构才能写数据库
- 工作流系统需要可靠的布尔值、数组、计划步骤，而不是“像 JSON 的一段文字”

所以这一章的目标，是让 agent 的最终输出从自然语言升级为被 schema 约束的数据。

## 本章功能的作用

这一章会引入结构化输出能力。

你要掌握的对象包括：

- `outputFormat`
- JSON Schema
- `structured_output`

它带来的核心收益，是把 Claude 的最终结果从“适合人读的自然语言”升级成“适合程序读的稳定对象”。一旦结果要进入前端渲染、数据库写入、自动工作流或后续 agent 链路，这种稳定结构就会变得非常重要。

官方实现里，structured output 并不是“要求模型吐一段 JSON 文本”这么简单。SDK 会根据 schema 校验最终结果，不符合就会驱动重试；如果多次校验都失败，最终结果会以错误结束，而不是悄悄给你一个结构不稳定的对象。

## 具体使用方式

### 第一步：先定义一个足够简单的 JSON Schema

最稳妥的做法是先从对象、字符串、数组这些基本结构开始。Schema 的职责是定义“最终结果必须长什么样”，而不是把 Claude 的全部思考过程都结构化。

很多学习者一开始就会把 schema 设计得过深、过细，结果很难判断是模型理解错了，还是结构本身不合理。教学阶段先用扁平结构，能更快建立“Claude 可以被约束到什么程度”的直觉。

等你进入真实项目后，再逐步引入 Zod 或 Pydantic 会更自然。这样 schema 不只是用来约束 Claude，还能同时承担运行时校验和类型推导，让 `structured_output` 真正成为类型安全的数据源。

### 第二步：把 schema 挂到 `outputFormat`

在 `query()` 的 `options` 中传入：

```ts
outputFormat: {
  type: "json_schema",
  schema
}
```

这一步告诉 SDK：最终结果必须通过这个 schema 校验。

### 第三步：在 `result` 中读取 `structured_output`

真正可供程序消费的对象不在自由文本里，而在 `message.structured_output`。如果你要把结果交给前端、数据库或工作流系统，应该优先读取这个字段。

### 第四步：把 schema 设计成“业务结果结构”，不是“展示格式”

例如 `steps`、`risks`、`summary` 很适合放入 schema；而复杂的解释性长文通常更适合保留在自然语言层。这样 schema 才稳定、可复用。

## 关键概念

### 结构化输出的核心思想

Claude 在执行过程中依然可以自由使用工具、自由思考，但在最终收尾时，SDK 会要求它返回一份满足指定 schema 的结果。

### 为什么它比“让模型输出 JSON 文本”更稳

因为 SDK 会：

- 校验输出是否符合 schema
- 在不符合时驱动重试
- 把最终结果放入专门字段，而不是混在自然语言里

### 适合放进 schema 的内容

最适合的是业务边界清晰的数据，例如：

- 步骤列表
- 风险项数组
- 状态值
- 实体抽取结果
- 汇总字段

## 可运行示例

把下面代码保存为 `chapter-07-structured-output.ts`：

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const schema = {
  type: "object",
  properties: {
    feature_name: { type: "string" },
    summary: { type: "string" },
    steps: {
      type: "array",
      items: { type: "string" }
    },
    risks: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["feature_name", "summary", "steps", "risks"]
};

async function main() {
  for await (const message of query({
    prompt: "Plan how to add password reset support to a web application.",
    options: {
      outputFormat: {
        type: "json_schema",
        schema
      }
    }
  })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log("Structured output:\n");
      console.dir(message.structured_output, { depth: null });
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
npx tsx chapter-07-structured-output.ts
```

## 示例拆解

### 第一步：先声明一个规划类 schema

示例把输出固定为 `feature_name`、`summary`、`steps`、`risks` 四个字段。这种结构很适合教学，因为它同时覆盖了单值字段和数组字段。

### 第二步：让 Claude 处理一个明确但非代码型任务

示例 prompt 是“为密码重置功能做规划”。这类任务最容易产生稳定的结构化结果，也能避免文件工具等额外因素干扰学习重点。

### 第三步：只在成功结果里读取 `structured_output`

代码明确判断 `message.type === "result" && message.subtype === "success"`，然后才打印 `structured_output`。这一步强调了结构化输出是结果收口能力，而不是中间过程能力。

### 第四步：用 `console.dir()` 观察对象真实形状

示例不用普通字符串拼接，而是用 `console.dir(..., { depth: null })` 输出对象。这样读者能直接看到结构，而不是阅读一段看起来像 JSON 的文本。

## 运行时你应该观察什么

- 最终输出不再是自由文本长文
- 终端里会打印一个稳定的对象结构
- 每次结果的字段形状都相同

## 一个很实用的延伸

如果你在 TypeScript 项目里工作，下一步通常会接入 `zod`，让 schema 同时承担：

- 运行时校验
- 类型推导

这样 `structured_output` 可以直接变成强类型对象。

## 易错点

- 学习阶段不要一开始就设计过深、过复杂的 schema，否则很难判断失败原因。
- 结构化输出失败时，不一定会有 `structured_output`，因为 schema 校验可能在多次重试后仍失败。

## 本章结束后你应该掌握

- 什么时候应该优先用结构化输出
- 为什么它适合数据库、前端和工作流系统接入
- 为什么它是从“助手”升级到“系统组件”的关键一步

## 本章小结

到这里，你的 agent 已经不只是“能帮人看懂结果”，而是“能把结果交给别的程序继续处理”。这通常是产品化分水岭。
