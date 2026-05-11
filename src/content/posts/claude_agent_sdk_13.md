---
title: Claude Agent SDK学习13 MCP
pubDate: 2026-04-28
categories: ['Claude Agent SDK']
description: '用统一协议把外部工具和数据源接进来。'
slug: claude-agent-sdk-mcp
---
## 当前 Agent 的问题

第十二章之后，你已经能接自己写的工具，但仍然有一个明显限制：所有能力都得由你自己实现。

如果你要接入：

- 文件系统 server
- GitHub
- Slack
- 数据库
- 文档检索服务

再为每个系统都手写一套工具层，成本会非常高。

这就是 MCP 的意义：用统一协议把外部工具和数据源接进来。

## 本章功能的作用

这一章会引入：

- `mcpServers`
- MCP 工具命名规则
- MCP 工具授权方式

它的核心意义是把“外部世界的能力”以统一协议接入 Claude。无论背后是文件系统、数据库、文档服务还是团队内部平台，只要它以 MCP server 的形式暴露出来，Claude 看见的接入方式都会趋于一致。

这也是为什么教程里要把“自定义工具”和“MCP 外部系统”分成两章。前者讲的是你自己在本地定义能力，后者讲的是如何把一个已经存在于进程外部、甚至远程网络上的工具系统接进来。

## 具体使用方式

### 第一步：先决定 MCP server 的来源

MCP server 可以是你本地启动的进程，也可以是团队提供的现成 server。学习阶段最容易上手的是命令行启动的本地 server，因为它不需要你自己实现协议。

这一步先从现成 server 开始非常重要。因为如果一上来就自己实现协议，你会同时面对两类问题：一类是 MCP 本身怎么接，另一类是你自己的 server 有没有写对。先用现成 server，能把学习变量压到最少。

官方文档也说明了 `mcpServers` 不只支持本地命令进程，还可以接远程 HTTP server。学习阶段先用本地 filesystem server，是因为它最容易直观看到“确实通过 MCP 读到了目录内容”。

### 第二步：在 `mcpServers` 中声明启动命令

最常见的方式是提供 `command` 和 `args`。这一步的含义是：SDK 会在运行时拉起这个 server 进程，并把它当成 Claude 的外部工具来源。

### 第三步：按 namespaced 名称授权工具

MCP 工具不会因为 server 被挂上就自动全部可用。你仍然应该在 `allowedTools` 中用 `mcp__<server>__<tool>` 或通配形式精确授权。

### 第四步：让 prompt 明确依赖外部能力

如果你希望读者看出 MCP 的价值，prompt 最好明确要求“使用 filesystem MCP server”或“通过外部工具查看目录”。这样就不会和内建文件工具混淆。

## 关键概念

### 1. MCP 工具名的规则

MCP 工具的名字一定长这样：

```text
mcp__<server-name>__<tool-name>
```

例如 `filesystem` server 上的某个工具，会以 `mcp__filesystem__...` 的形式出现。

### 2. 为什么 MCP 最适合接外部世界

因为它让以下两件事被统一了：

- 工具发现
- 工具调用协议

Claude 不需要知道这个工具背后是本地进程、远程 HTTP 服务，还是你自己写的 SDK MCP server。

### 3. 为什么授权优先用 `allowedTools`

MCP 工具通常不应该靠宽松的 `bypassPermissions` 放开，而应该通过精确的 `allowedTools` 控制开放范围。

## 前置准备

如果你想运行下面这个例子，最稳妥的方式是先安装本地 filesystem MCP server：

```bash
npm install -D @modelcontextprotocol/server-filesystem
```

## 可运行示例

把下面代码保存为 `chapter-13-mcp.ts`：

```ts
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch13-"));

  try {
    await writeFile(join(workspace, "README.md"), "# MCP Demo\n\nTesting filesystem access.\n", "utf8");
    await writeFile(join(workspace, "todo.md"), "- connect external tools\n", "utf8");

    for await (const message of query({
      prompt: "Use the filesystem MCP server to inspect this directory and summarize the files you found.",
      options: {
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", workspace]
          }
        },
        allowedTools: ["mcp__filesystem__*"]
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
npx tsx chapter-13-mcp.ts
```

## 示例拆解

### 第一步：脚本先准备一个临时目录和示例文件

这一步的功能是给 filesystem MCP server 一个真实的可观察目标，同时避免污染你当前项目目录。

### 第二步：在 `mcpServers.filesystem` 中写入 `npx` 启动方式

示例使用 `npx -y @modelcontextprotocol/server-filesystem <workspace>`。这说明外部工具并不一定要先被你的 Node 代码 import，它也可以是一个独立子进程。

### 第三步：通过 `allowedTools: [\"mcp__filesystem__*\"]` 放开 server 工具

这一行既演示了 MCP 工具命名规则，也演示了实际授权方法。没有它，Claude 可能知道有 filesystem server，但依然无法调用其中工具。

### 第四步：观察回答是否基于外部 server 返回的数据

如果示例运行正常，Claude 的总结会提到 `README.md` 和 `todo.md`，这说明它确实是通过 MCP server 看到目录内容，而不是只依赖当前 Node 进程上下文。

## 运行时你应该观察什么

- Claude 会通过 MCP filesystem server 获取目录信息
- 回答应基于真实文件，而不是单纯依赖当前进程 `cwd`

## 易错点

- `acceptEdits` 不会自动批准 MCP 工具。
- `server-name` 一旦变了，对应的 `allowedTools` 前缀也要跟着改。
- 如果本机没有安装 server 包，`npx` 运行时可能需要联网下载。

## 本章结束后你应该掌握

- 为什么 MCP 是外部系统集成的统一入口
- MCP 工具名如何构成
- 如何为 MCP 工具做权限边界设计

## 本章小结

到这里，你的 agent 已经真正跨出了本地逻辑，开始访问外部系统。这是从“本地自动化”走向“平台集成”的关键一步。
