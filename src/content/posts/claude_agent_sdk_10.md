---
title: Claude Agent SDK学习10 Slash Commands
pubDate: 2026-05-01
categories: ['Claude Agent SDK']
description: '它把一些常见动作从“自然语言猜测”变成“明确命令调用”。'
slug: claude-agent-sdk-slash-commands
---
## 当前 Agent 的问题

第九章之后，你已经有了 Skills，但很多工作流依然有一个问题：触发方式不够明确。

有些动作更适合“显式命令”，而不是等 Claude 自己判断，例如：

- 压缩上下文
- 运行一个固定的审查模板
- 执行某个固定重构流程

这就是 Slash Commands 的用武之地。它把一些常见动作从“自然语言猜测”变成“明确命令调用”。

## 本章功能的作用

这一章会引入：

- 内建 slash commands
- 自定义 `.claude/commands/*.md`

它解决的是“触发方式不够明确”的问题。对于固定流程很多的团队来说，自然语言 prompt 虽然灵活，但不够稳定；而 Slash Command 提供了一个更像命令面板的入口，让同一个动作可以被反复、明确地触发。

官方文档里还有两个很实用的边界说明。第一，不是所有 CLI 里的命令都能在 SDK 里调度，只有那些不依赖交互式终端的命令才会出现在初始化消息的 `slash_commands` 列表中；第二，像 `/clear` 这类强交互命令在 SDK 里并不适用，因为每次 `query()` 本来就可以开始一段新会话。

## 具体使用方式

### 第一步：把固定流程写成命令文件

如果一个流程适合被显式触发，而不是等 Claude 自己推断，就把它写成 `.claude/commands/<name>.md`。文件名会直接映射成命令名，例如 `refactor.md` 会变成 `/refactor`。

这类流程通常有一个共同特征：你已经知道要触发的动作是什么，只是不想每次都重新用自然语言描述一遍。命令文件的价值就在于把这种重复说明收敛成一个稳定入口。

如果你要验证命令是否真的被系统发现，一个非常直接的方式就是先读 `system/init` 消息里的 `slash_commands`。这比“盲跑一遍看看有没有效果”更适合排查路径、命名空间或 setting source 配置问题。

### 第二步：让命令正文只描述流程，不描述上下文状态

命令文件更像“固定指令模板”。它应该描述“执行这个命令时应该怎么做”，而不是写死某个具体文件或某次任务的细节。

### 第三步：在 prompt 中用斜杠命令开头

最直接的调用方式就是让 prompt 以 `/refactor sample.ts` 这类形式开始。这样 Claude 不需要猜测你的意图，而是明确进入命令驱动模式。

### 第四步：为命令配齐必要工具权限

命令文件本身不会绕过工具权限。如果命令要改代码，就仍然需要在主 query 上开放 `Read`、`Edit`、`Write` 等相应工具。

## 关键概念

### 1. Slash Command 是会话控制接口

它和普通 prompt 的最大区别是：它更像控制命令，而不是自然语言任务描述。

典型内建命令包括：

- `/compact`
- `/context`
- `/usage`

### 2. 自定义 Slash Command 的来源

最直接的方式是创建：

```text
.claude/commands/refactor.md
```

文件名会变成命令名，例如 `/refactor`。

### 3. 为什么现在更推荐 Skill 而不是 commands

`.claude/commands/` 是旧格式。推荐格式是 `.claude/skills/<name>/SKILL.md`，因为 Skill 既支持显式调用，也支持自动触发。

不过命令格式仍然有效，学习时非常直观。

## 可运行示例

这个示例会：

1. 创建一个临时项目
2. 写入一个自定义 `/refactor` 命令
3. 让 Claude 对一个示例文件执行命令

把下面代码保存为 `chapter-10-slash-commands.ts`：

```ts
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch10-"));

  try {
    await mkdir(join(workspace, ".claude", "commands"), { recursive: true });

    await writeFile(
      join(workspace, ".claude", "commands", "refactor.md"),
      [
        "Refactor the target code to improve readability and maintainability.",
        "Prefer small functions and remove obvious duplication.",
        ""
      ].join("\n"),
      "utf8"
    );

    await writeFile(
      join(workspace, "sample.ts"),
      [
        "export function total(a: number, b: number, c: number) {",
        "  const first = a + b;",
        "  const second = first + c;",
        "  return second;",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );

    for await (const message of query({
      prompt: "/refactor sample.ts",
      options: {
        cwd: workspace,
        allowedTools: ["Read", "Edit", "Write", "Glob"],
        permissionMode: "acceptEdits"
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
npx tsx chapter-10-slash-commands.ts
```

## 示例拆解

### 第一步：脚本先创建 `.claude/commands/refactor.md`

这里的功能是定义一个最小可用命令，让读者看到 Slash Command 的本质其实就是一份约定位置的 Markdown 指令文件。

### 第二步：再写入一个可以被改进的 `sample.ts`

示例代码虽然不复杂，但它有明显的“中间变量过多、表达不够直接”的问题，足够展示 `/refactor` 的效果。

### 第三步：用 `/refactor sample.ts` 作为 prompt

这一行是本章的核心。它不是普通自然语言，而是显式命令调用。Claude 收到它后，会优先按命令模板理解任务。

### 第四步：通过文件修改结果验证命令是否生效

示例最终不是只看说明文本，而是观察 `sample.ts` 是否真的被改写。对 Slash Command 来说，最重要的验证信号永远是动作结果，而不是解释。

## 运行时你应该观察什么

- Claude 会把 `/refactor` 当成一个命令而不是普通文本
- `sample.ts` 会被修改
- 最终说明应围绕“可读性、重复、简化”展开

## 一个额外验证方式

如果你想确认命令是否被发现，可以先运行一个只看初始化消息的小脚本，检查 `slash_commands` 列表里是否出现 `/refactor`。

## 易错点

- 某些交互式 CLI 命令不适用于 SDK。
- 路径必须在当前 `cwd` 对应项目下，否则命令文件不会被发现。

## 本章结束后你应该掌握

- 什么时候该用显式命令而不是自然语言 prompt
- 如何创建一个最小自定义 Slash Command
- 为什么 Skill 通常是更长期的方案

## 本章小结

到这里，你的 agent 已经拥有了“明确入口”的工作流能力。对于固定流程很多的团队，这比每次写自然语言 prompt 更稳定、更高效。
