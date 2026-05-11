---
title: Claude Agent SDK学习09 Skills
pubDate: 2026-05-02
categories: ['Claude Agent SDK']
description: '按需加载的专项能力。'
slug: claude-agent-sdk-skills
---
## 当前 Agent 的问题

第八章之后，你已经能把长期规则写进 `CLAUDE.md`，但还有一个问题：并不是所有知识都适合每次都进入上下文。

比如下面这些能力：

- 代码审查 checklist
- PDF 处理流程
- 文档总结格式
- 某类任务的固定操作指南

如果把它们全都塞进 `CLAUDE.md`，会有两个坏处：

- 上下文越来越重
- 很多只在少数场景才用到的知识，也会在每次会话里反复注入

这就是 Skills 要解决的问题：按需加载的专项能力。

## 本章功能的作用

这一章会引入：

- `.claude/skills/<name>/SKILL.md`
- `skills`
- `settingSources`

如果把 `CLAUDE.md` 看成项目的常驻规则层，那么 Skill 更像“按需装载的专项能力包”。它让你不用在每次会话里都背着所有知识前进，而是只在任务相关时再把对应说明真正加载进上下文。

官方文档还强调了一点：Skill 的发现依赖文件系统 setting sources。默认情况下用户级和项目级来源都会加载，所以很多时候你“什么都不配”也能用到已发现 Skill；但只要你显式改了 `settingSources`，就必须把需要的来源重新加回来。

## 具体使用方式

### 第一步：先判断某类知识是否适合做成 Skill

适合做成 Skill 的通常是“只在特定任务才需要加载”的知识或流程，例如代码审查 checklist、文档摘要模板、数据清洗步骤。它不应该是每次会话都要注入的全局规则。

这一步的判断标准可以很简单：如果一段知识在大多数会话里都应该生效，就放进 `CLAUDE.md`；如果它只在某一类任务里才重要，就更适合做成 Skill。用这个标准去拆分，通常不会偏太远。

还要注意，`skills` 选项本质上是“给模型看的可见性过滤”，不是强沙箱。官方文档明确指出，未列出的 Skill 不会通过 Skill 工具触发，但相关文件如果仍在磁盘上，Claude 理论上仍可通过 `Read` 或 `Bash` 接触到它们。

### 第二步：按固定目录结构创建 `SKILL.md`

最常见结构就是 `.claude/skills/<skill-name>/SKILL.md`。Skill 的发现依赖文件系统而不是运行时代码注册，所以路径结构本身就是使用方式的一部分。

### 第三步：在 frontmatter 里写清名字和触发描述

`name` 决定 Skill 的标识，`description` 决定 Claude 什么时候会觉得“这个 skill 可能有用”。如果描述模糊，Skill 可能虽然被发现，但触发效果会很差。

### 第四步：在 query 里显式启用 Skills

常见做法是同时设置 `settingSources: ["project"]` 和 `skills: "all"`。前者负责发现项目里的 skill 文件，后者负责把这些已发现 skill 纳入当前会话。

## 关键概念

### 1. Skill 和 `CLAUDE.md` 的区别

`CLAUDE.md`：

- 每次会话都会加载
- 适合长期项目规则

Skill：

- 启动时只暴露描述
- 只有相关时才加载正文
- 适合专项工作流和专门知识

### 2. Skill 必须是文件系统对象

在 SDK 中，Skill 不是通过代码注册的，而是通过文件系统发现的。

最常见结构：

```text
.claude/skills/review-checklist/SKILL.md
```

### 3. `skills` 控制的是可见性，不是硬沙箱

如果你写：

```ts
skills: "all"
```

表示启用所有已发现 skills。

如果你写：

```ts
skills: []
```

表示不启用任何 skill。

## 可运行示例

这个示例会：

1. 创建一个临时项目
2. 创建一个简单 skill
3. 让 Claude 使用这个 skill 做代码审查

把下面代码保存为 `chapter-09-skills.ts`：

```ts
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch09-"));

  try {
    await mkdir(join(workspace, ".claude", "skills", "review-checklist"), { recursive: true });

    await writeFile(
      join(workspace, ".claude", "skills", "review-checklist", "SKILL.md"),
      [
        "---",
        "name: review-checklist",
        "description: Use when reviewing code for bug risks, missing tests, and maintainability problems.",
        "---",
        "",
        "When reviewing code:",
        "- Look for crash risks",
        "- Look for missing tests",
        "- Call out maintainability issues",
        ""
      ].join("\n"),
      "utf8"
    );

    await writeFile(
      join(workspace, "auth.ts"),
      [
        "export function getUserName(user?: { name?: string }) {",
        "  return user!.name!.toUpperCase();",
        "}",
        ""
      ].join("\n"),
      "utf8"
    );

    for await (const message of query({
      prompt: "Review auth.ts using our project review checklist.",
      options: {
        cwd: workspace,
        settingSources: ["project"],
        skills: "all",
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
npx tsx chapter-09-skills.ts
```

## 示例拆解

### 第一步：先创建 `review-checklist` Skill

示例在临时项目中写入 `.claude/skills/review-checklist/SKILL.md`。这一步的功能是让教程不依赖现成仓库配置，读者复制脚本就能看到最小 Skill 长什么样。

### 第二步：给 Skill 写一份非常具体的正文

Skill 正文明确要求 Claude 在代码审查时关注 crash risk、测试缺失和可维护性问题。这样输出风格是否受 Skill 影响，会非常容易观察。

### 第三步：准备一个有明显缺陷的 `auth.ts`

这个文件故意使用了不安全的非空断言，目的就是让 Skill 里的 checklist 有东西可抓。否则示例即使触发 Skill，也不容易展示它的价值。

### 第四步：通过“使用我们的 review checklist”提示 Claude 调用 Skill

示例 prompt 不是泛泛地说“review auth.ts”，而是显式点出 review checklist。这样读者既能理解自动触发逻辑，也能看到提示词如何帮助 Claude 选择正确 Skill。

## 运行时你应该观察什么

- Claude 的审查结果应该明显围绕 skill 里定义的 checklist 展开
- 它会更倾向于指出 crash risk、测试缺失和可维护性问题

## 易错点

- 如果没启用 `settingSources: ["project"]`，项目 skill 不会被发现。
- SDK 中 skill 的 `allowed-tools` frontmatter 不能替代主 query 的 `allowedTools`。

## 本章结束后你应该掌握

- 什么能力适合做成 skill
- Skill 和 `CLAUDE.md` 的职责边界
- 如何让 agent 在需要时动态加载专项知识

## 本章小结

到这里，你的 agent 已经不只是“遵守通用规则”，还开始具备“遇到特定任务时调用专项能力”的结构化扩展方式。
