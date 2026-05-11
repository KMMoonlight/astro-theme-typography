---
title: Claude Agent SDK学习16 Hooks
pubDate: 2026-04-25
categories: ['Claude Agent SDK']
description: '它们不是提示词技巧，而是运行时拦截点。'
slug: claude-agent-sdk-hooks
---
## 当前 Agent 的问题

第十五章之后，你已经可以把复杂任务拆给不同子 agent 处理，但执行链仍然缺少一个很重要的治理入口：你还不能在“工具真正执行之前和之后”插入自己的逻辑。

这会导致很多高价值能力无处安放：

- 阻断危险命令
- 审计所有文件修改
- 改写工具输入
- 在结果回流给 Claude 前补充上下文

这就是 Hooks 存在的意义。它们不是提示词技巧，而是运行时拦截点。

## 本章功能的作用

这一章会引入：

- `PreToolUse`
- `PostToolUse`
- matcher
- hook 回调返回的结构化决策

这章的重点是把治理逻辑从“提示词约束”升级成“运行时强约束”。提示词只能影响 Claude 的倾向，而 Hook 可以真正站在执行链上，决定某一步是否允许继续进行。

官方权限文档甚至把 Hook 放在权限检查链路的最前面。也就是说，当一个工具请求到来时，最先介入的往往不是 `allowedTools` 或 `permissionMode`，而是你注册的 Hook。这也是它为什么特别适合承接审计、阻断、改写和外部通知逻辑。

## 具体使用方式

### 第一步：先决定要拦截哪一类事件

大多数治理逻辑都从 `PreToolUse` 开始，因为这时工具还没有真正执行。只有当你需要审计结果、补充上下文或记录返回值时，才需要 `PostToolUse`。

这也是为什么很多安全策略都更适合写在 Hook，而不是系统提示词里。你不是在请求模型“最好别这么做”，而是在程序层明确规定“这一步在执行前必须经过检查”。

另外，官方还强调了一个经常被误用的点：`matcher` 只按工具名匹配，不按文件路径或命令参数匹配。所以如果你想只拦截某个特定文件，正确做法一定是“用 matcher 先缩小到 Write/Edit，再在回调里继续看 `tool_input.file_path`”。

### 第二步：用 matcher 缩小触发范围

不要让所有 hook 拦所有工具。更稳妥的做法是通过 `matcher` 先筛到 `Write`、`Edit`、`Bash` 这类高风险工具，再在回调里继续检查具体参数。

### 第三步：在 hook 回调里读取结构化输入

Hook 的工作方式不是“看一段自然语言”，而是读真实工具输入对象。对于文件修改场景，最常见的就是从 `tool_input` 中提取 `file_path` 再做路径级策略判断。

### 第四步：把 Hook 当作程序级防线

系统提示词只能影响 Claude 的倾向，Hook 才能真正阻止动作执行。生产环境里，危险操作的硬约束应该优先放在 Hook，而不是写在 prompt 里碰运气。

## 关键概念

### 1. Hook 在哪里执行

Hook 运行在你的应用进程里，不在 Claude 的上下文窗口里。这意味着它更像“程序逻辑”，而不是“让模型自己遵守的规则”。

### 2. `PreToolUse` 和 `PostToolUse` 的分工

- `PreToolUse`：工具真正执行前
- `PostToolUse`：工具执行后

最常见的治理逻辑通常都放在 `PreToolUse`。

### 3. matcher 的作用

matcher 用来限制 hook 触发范围。例如：

- `"Bash"`：只拦截 Bash
- `"Write|Edit"`：只拦截写文件类工具

## 可运行示例

这个示例会：

1. 创建一个 `.env` 文件
2. 让 Claude 尝试修改它
3. 使用 `PreToolUse` 阻止修改

把下面代码保存为 `chapter-16-hooks.ts`：

```ts
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { query, type HookCallback, type PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const protectEnvFiles: HookCallback = async (input) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  const filePath = String(toolInput.file_path ?? "");

  if (basename(filePath) === ".env") {
    return {
      hookSpecificOutput: {
        hookEventName: preInput.hook_event_name,
        permissionDecision: "deny",
        permissionDecisionReason: "Editing .env is blocked by tutorial policy."
      }
    };
  }

  return {};
};

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-sdk-ch16-"));

  try {
    await writeFile(join(workspace, ".env"), "API_URL=https://old.example.com\n", "utf8");

    for await (const message of query({
      prompt: "Update .env so that API_URL points to https://new.example.com.",
      options: {
        cwd: workspace,
        allowedTools: ["Read", "Edit", "Write", "Glob"],
        permissionMode: "acceptEdits",
        hooks: {
          PreToolUse: [{ matcher: "Write|Edit", hooks: [protectEnvFiles] }]
        }
      }
    })) {
      if (message.type === "result") {
        console.log(message.result);
      }
    }

    const finalEnv = await readFile(join(workspace, ".env"), "utf8");
    console.log("\nFinal .env:\n");
    console.log(finalEnv);
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
npx tsx chapter-16-hooks.ts
```

## 示例拆解

### 第一步：先写入一个真实 `.env` 文件

这个例子不用虚拟路径，而是创建真实配置文件，是为了让“阻止修改敏感文件”这个场景足够具体。

### 第二步：定义 `protectEnvFiles` 回调

回调里先把 `input` 视为 `PreToolUseHookInput`，再从 `tool_input.file_path` 读取目标路径。这里的重点是告诉读者：Hook 的判断依据来自结构化工具输入。

### 第三步：通过 `hooks.PreToolUse` 把回调挂到执行链上

示例使用 `matcher: "Write|Edit"`，意味着只有写文件相关工具才会进入这条 Hook。这样既节省判断开销，也让规则边界更清楚。

### 第四步：最后重读 `.env` 验证拦截是否真的生效

只要文件内容保持原样，就说明这不是“Claude 听话了”，而是程序在执行层面真正阻止了写操作。

## 运行时你应该观察什么

- Claude 会尝试编辑 `.env`
- Hook 会在工具执行前阻止它
- 最终 `.env` 文件内容应保持不变

## 易错点

- matcher 只按工具名过滤，不按文件路径过滤；路径判断要在 hook 回调里自己做。
- 如果多个 Hook 同时命中，`deny` 的优先级很高。

## 本章结束后你应该掌握

- 为什么 Hook 比 prompt 约束更可靠
- 如何拦截和修改工具请求
- 为什么治理逻辑应该尽量放在执行链，而不是只放在系统提示词里

## 本章小结

到这里，你的 agent 已经拥有真正的运行时治理能力。对生产系统来说，这通常比“回答质量更高一点”更重要。
