---
title: Claude Agent SDK学习08 系统提示词与 CLAUDE.md
pubDate: 2026-05-03
categories: ['Claude Agent SDK']
description: '"systemPrompt"和"CLAUDE.md"正好分别对应“这次要怎么做”和“这个项目一贯怎么做”。'
slug: claude-agent-sdk-system-prompt-claude
---
## 当前 Agent 的问题

第七章之后，你的 agent 已经能输出结构化结果，但它仍然有一个很常见的问题：行为不稳定。

你可能会遇到这些现象：

- 这次它记得写类型注解，下次又忘了
- 这次它会遵循项目命名风格，下次又偏了
- 你每次都要在 prompt 里重复“请先跑测试”“请用 TypeScript strict 风格”

这说明你的 agent 缺少长期规则层。它能做事，但还不会持续按照你的方式做事。

## 本章功能的作用

这一章会加入两层行为定制能力：

- `systemPrompt`
- `CLAUDE.md`

这两者的职责不同：

- `systemPrompt` 更适合当前调用的临时策略
- `CLAUDE.md` 更适合项目长期规则

这一章真正解决的是“行为稳定性”问题。Claude 不是不会写代码，而是如果没有稳定规则源，它每次写代码时采用的风格、约束和优先级都可能波动。`systemPrompt` 和 `CLAUDE.md` 正好分别对应“这次要怎么做”和“这个项目一贯怎么做”。

这里还有一个非常关键的官方说明：Agent SDK 默认并不会自动使用完整 Claude Code 系统提示词，而是只带一个最小运行提示。也就是说，如果你不显式启用 `preset: "claude_code"`，就不能默认假设 Claude 已经天然带着完整的编码行为基线。

## 具体使用方式

### 第一步：先决定哪些规则属于“本次调用”

如果一条规则只在当前任务里有效，例如“这次请用更简短的解释”或“这次必须补类型注解”，优先放到 `systemPrompt.append` 中。这样它不会污染整个项目的长期规范。

这个判断很重要，因为很多团队一开始会把所有规则都塞进同一个地方。结果要么 prompt 越来越臃肿，要么 `CLAUDE.md` 里混入大量一次性要求，最后谁也分不清哪些规则是长期的，哪些只是当前任务的临时偏好。

另外，`CLAUDE.md` 是否加载，不取决于你有没有使用 `claude_code` preset，而取决于 `settingSources`。这正是很多“明明文件存在但规则不生效”的根本原因。

### 第二步：把长期团队规则写进 `CLAUDE.md`

像命名风格、测试习惯、架构边界、常用命令这类规则，更适合写入项目根目录下的 `CLAUDE.md`。这是因为它们应该随着仓库一起被版本化，而不是每次由调用方重复拼接。

### 第三步：通过 `settingSources` 控制是否加载项目规则

只有在 `settingSources` 包含 `project` 时，项目里的 `CLAUDE.md`、skills、commands 等配置才会被发现。很多“为什么规则没生效”的问题，本质上都是这里没打开。

### 第四步：把 preset 和 append 组合使用

最常见的组合方式是先用 `preset: "claude_code"` 提供完整编码行为基线，再用 `append` 叠加你当前任务的特殊要求。这样既有稳定默认值，又保留了当前调用的灵活性。

## 关键概念

### 1. 默认 SDK system prompt 不是完整 Claude Code prompt

这是一个非常容易忽略的点。SDK 默认使用的是最小 system prompt，只包含基本运行所需信息，并不自动等价于 Claude Code 的完整编码行为。

如果你希望更接近 Claude Code 的行为基线，应该显式使用：

```ts
systemPrompt: {
  type: "preset",
  preset: "claude_code"
}
```

### 2. `append` 适合写本次调用特例

例如：

- 总是加类型注解
- 总是用更精简的回答风格
- 当前任务要优先关注安全性

### 3. `CLAUDE.md` 适合写项目长期规则

例如：

- 代码风格
- 常用命令
- 测试规范
- 架构约束

它的好处是：

- 可版本化
- 团队共享
- 不用每次手工重复 prompt

## 可运行示例

这个示例分两部分：

1. 脚本自动创建一个临时项目和 `CLAUDE.md`
2. Claude 在该项目里根据规则写代码

把下面代码保存为 `chapter-08-system-prompt-and-claude-md.ts`：

```ts
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch08-"));

  try {
    await mkdir(join(workspace, "src"), { recursive: true });

    await writeFile(
      join(workspace, "CLAUDE.md"),
      [
        "# Project Guidelines",
        "",
        "- Use TypeScript style even in small examples",
        "- Prefer small pure functions",
        "- Include a brief doc comment for exported functions",
        "- Keep examples concise and readable",
        ""
      ].join("\n"),
      "utf8"
    );

    for await (const message of query({
      prompt: "Create src/format.ts with an exported function that formats a number as US dollars.",
      options: {
        cwd: workspace,
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: "Always add explicit type annotations."
        },
        settingSources: ["project"],
        allowedTools: ["Read", "Write", "Edit", "Glob"],
        permissionMode: "acceptEdits"
      }
    })) {
      if (message.type === "result") {
        console.log(message.result);
      }
    }

    const output = await readFile(join(workspace, "src", "format.ts"), "utf8");
    console.log("\nGenerated file:\n");
    console.log(output);
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
npx tsx chapter-08-system-prompt-and-claude-md.ts
```

## 示例拆解

### 第一步：脚本先创建 `CLAUDE.md`

这一步的功能是模拟一个真实项目已经沉淀好的长期规范。示例把“使用 TypeScript 风格”“导出函数要有简短注释”等规则写进去，便于后面观察这些规则是否体现在生成结果里。

### 第二步：在 `query()` 中配置 `systemPrompt`

示例使用 `preset: "claude_code"`，并通过 `append` 增加“总是补显式类型标注”。这里体现的是两层规则同时生效：一层是 Claude Code 风格基线，一层是本次调用追加要求。

### 第三步：通过 `settingSources: ["project"]` 打开项目级设置

如果没有这一行，Claude 虽然在同一个目录里工作，但不会把 `CLAUDE.md` 当作项目规则源。这个参数就是把“目录里有文件”变成“会话里加载规则”的开关。

### 第四步：在结果后直接读取生成文件

示例最后再次读取 `src/format.ts`，目的是让读者从真实代码里验证规则是否生效，而不是只依赖 Claude 的自述。

## 运行时你应该观察什么

- Claude 会在 `src/format.ts` 中创建代码
- 代码风格应该受 `CLAUDE.md` 和 `append` 共同影响
- 你应该能看到导出函数、类型注解，以及简短注释

## 易错点

- 如果你显式设置了 `settingSources: []`，那么 `CLAUDE.md` 根本不会被加载。
- 如果你没有设置 `claude_code` preset，就不要默认假设 Claude 会自动采用完整的 Claude Code 编码风格。

## 本章结束后你应该掌握

- `systemPrompt` 和 `CLAUDE.md` 的职责分工
- 为什么长期规则应该文件化，而不是一直堆在 prompt 里
- 如何让 agent 的行为在多次调用之间更稳定

## 本章小结

到这里，你的 agent 已经开始具备“工程风格一致性”。这对长期集成非常关键，因为系统可维护性往往来自规则稳定，而不是单次回答好看。

