---
title: Claude Agent SDK学习11 Plugins
pubDate: 2026-04-30
categories: ['Claude Agent SDK']
description: 'Plugin 解决的就是“这一组能力怎么被打包、分发和复用”。'
slug: claude-agent-sdk-plugins
---
## 当前 Agent 的问题

第十章之后，你已经学会了 Skills、CLAUDE.md 和 Slash Commands，但这些能力还停留在“当前项目里手工配置”的阶段。

这会带来几个问题：

- 团队里多个项目想复用同一套能力时，复制目录很麻烦
- skills、hooks、agents、commands 分散在项目里，不利于统一维护
- 某些能力本质上是“插件包”，而不是单个仓库的临时配置

所以这一章的目标，是把一组 Claude 扩展打包成可复用的 plugin。

## 本章功能的作用

这一章会引入：

- `.claude-plugin/plugin.json`
- `plugins: [{ type: "local", path: ... }]`

Plugin 的本质是一个扩展包，它可以包含：

- skills
- commands
- agents
- hooks
- `.mcp.json`

如果 Skill 解决的是“一个能力怎么定义”，那 Plugin 解决的就是“这一组能力怎么被打包、分发和复用”。这也是为什么 Plugin 更适合团队级能力沉淀，而不是单个仓库里的零散配置。

官方 SDK 侧还有一个强限制：`plugins` 只接受本地路径，`type` 也只能是 `"local"`。即使插件最初来自 marketplace 或远程仓库，在 SDK 里也必须先下载成一个本地目录，再通过路径挂载进来。

## 具体使用方式

### 第一步：把可复用能力组织成独立目录

Plugin 的起点不是某个 API，而是一个目录边界。你应该先为插件准备独立根目录，再把 skill、command、agent、hook 等能力放进去，而不是散落在业务项目根目录下。

只有先形成清晰的目录边界，后面的版本管理、共享、复用和升级才有可能变得简单。否则即使功能上能跑，也仍然只是“项目里一堆配置的复制粘贴”，而不是可维护的插件化能力。

加载成功后，最可靠的验证信号不是 Claude 自己说“我看到了插件”，而是初始化消息里的 `plugins` 和 `slash_commands` 字段。它们会直接告诉你插件是否被识别，以及哪些命令或技能入口已经注入到当前会话。

### 第二步：在 `.claude-plugin/plugin.json` 中声明插件元数据

这个文件至少要告诉系统“这是什么插件”。对学习者来说，最关键的是理解：没有这份清单文件，这个目录就不会被当成 Plugin 根目录。

### 第三步：在主 query 里通过本地路径挂载插件

SDK 侧的使用方式非常直接：

```ts
plugins: [{ type: "local", path: pluginRoot }]
```

这里的 `path` 指向的是插件根目录，而不是 skill 子目录。

### 第四步：通过插件命名空间调用其中能力

如果插件内提供了 skill 或命令，常见调用方式会带上插件命名空间。这样同名能力在多插件场景下也不会冲突。

## 关键概念

### 1. SDK 中只支持本地 Plugin

这一点很重要。即便插件来自 marketplace，SDK 里最终也必须提供一个本地路径。

```ts
plugins: [{ type: "local", path: "./plugins/my-plugin" }]
```

### 2. Plugin 是分发边界，不是单一能力

Skill 解决的是“一个专项能力”，Plugin 解决的是“如何把一组能力一起发布和复用”。

### 3. Plugin Skill 的命名空间

当你通过 slash command 调用 plugin skill 时，通常使用：

```text
/plugin-name:skill-name
```

## 可运行示例

这个示例会：

1. 创建一个临时 plugin
2. 在 plugin 里放一个 skill
3. 通过插件命名空间显式调用它

把下面代码保存为 `chapter-11-plugins.ts`：

```ts
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const root = await mkdtemp(join(tmpdir(), "agent-sdk-ch11-"));
  const workspace = join(root, "workspace");
  const pluginRoot = join(root, "plugins", "demo-plugin");

  try {
    await mkdir(workspace, { recursive: true });
    await mkdir(join(pluginRoot, ".claude-plugin"), { recursive: true });
    await mkdir(join(pluginRoot, "skills", "greet"), { recursive: true });

    await writeFile(
      join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify(
        {
          name: "demo-plugin",
          description: "Demo plugin used in the Agent SDK tutorial"
        },
        null,
        2
      ),
      "utf8"
    );

    await writeFile(
      join(pluginRoot, "skills", "greet", "SKILL.md"),
      [
        "---",
        "name: greet",
        "description: Use when the user explicitly asks for a demo greeting.",
        "---",
        "",
        "Reply with a short greeting that mentions this response came from the plugin skill.",
        ""
      ].join("\n"),
      "utf8"
    );

    for await (const message of query({
      prompt: "/demo-plugin:greet",
      options: {
        cwd: workspace,
        plugins: [{ type: "local", path: pluginRoot }],
        maxTurns: 2
      }
    })) {
      if (message.type === "system" && message.subtype === "init") {
        console.log("Loaded plugins:", message.plugins);
        console.log("Available commands:", message.slash_commands);
      }

      if (message.type === "result") {
        console.log("\nResult:\n");
        console.log(message.result);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

运行：

```bash
npx tsx chapter-11-plugins.ts
```

## 示例拆解

### 第一步：脚本创建一个独立 plugin 根目录

示例先构造 `plugins/demo-plugin`，再在其中创建 `.claude-plugin/plugin.json` 和 `skills/greet/SKILL.md`。这一步完整演示了一个最小插件的目录骨架。

### 第二步：`plugin.json` 负责把目录标记成插件

示例里的 `name` 和 `description` 很简单，但已经足够让初始化消息中出现这个插件信息。它的重点不是字段多，而是“插件身份”被声明出来。

### 第三步：在 `query()` 中通过 `plugins` 挂载它

这一行让当前会话知道：除了工作区自己的配置，还要额外加载这个本地插件目录。对团队复用来说，这就是最重要的接入点。

### 第四步：使用 `/demo-plugin:greet` 验证命名空间调用

示例用显式命令触发插件里的能力，是因为这种方式最容易验证插件确实被正确发现和挂载。

## 运行时你应该观察什么

- 初始化消息里应该出现 `demo-plugin`
- `slash_commands` 里应该能看到 plugin 命名空间下的命令
- 最终结果应来自 plugin 中定义的 skill

## 易错点

- `path` 必须指向包含 `.claude-plugin/plugin.json` 的根目录。
- Plugin 内 skill 调用时要注意命名空间格式。
- 如果你只想沉淀某个项目自己的能力，不一定非要上 plugin；plugin 更适合跨项目复用。

## 本章结束后你应该掌握

- Plugin 和 Skill 的职责区别
- 如何构造一个最小本地 Plugin
- 如何在 SDK 中装载 Plugin

## 本章小结

到这里，你的 agent 扩展能力已经具备“打包和分发”的边界了。对于团队级复用，这是从“配置”走向“基础设施”的关键一步。
