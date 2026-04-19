---
title: Deep Agents 学习06 Permissions
pubDate: 2026-04-14
categories: ['Deep Agents']
description: '说明如何用声明式 permissions 规则控制内置文件工具的读写范围、路径边界，以及主代理与子代理的权限隔离。'
slug: deep-agents-permissions
---

当 Agent 开始真正碰文件系统时，“它能不能读”“它能不能写”“它到底能写到哪里”就不能再靠口头约定。权限规则的意义，在于把这些边界前置成一层清晰配置，让访问范围在工具真正执行前就已经被框定下来。

## 为什么值得关注

文件权限控制看起来像细节配置，实际却是让 Agent 从“默认开放”走向“按边界执行”的第一步。它不负责解决所有安全问题，但它会非常直接地影响 Agent 能否越界访问、能否误改敏感文件，以及不同角色的代理之间是否真的做到了隔离。

权限系统的核心价值是：

- 防止 Agent 越权访问文件
- 把文件访问边界前置成配置，而不是散落在工具逻辑里
- 让内置文件系统工具在统一规则下工作
- 为多目录、多角色、多子代理场景提供最基础的安全隔离

---

## 权限控制作用于什么

权限规则只作用于内置文件系统工具：

- `ls`
- `read_file`
- `glob`
- `grep`
- `write_file`
- `edit_file`

### 不作用于什么

权限规则不会自动覆盖以下能力：

- 自定义工具
- MCP 工具
- 沙箱中的 `execute`

这点必须记清楚。

因为这意味着：

- 你给 Agent 加了一个自定义工具，如果它自己读写文件，那么 `permissions` 不会自动拦住它
- 如果 backend 是 sandbox，并且 Agent 能通过 `execute` 跑 shell，那么单纯的路径权限规则也无法约束 shell 层访问

### 一个实用判断

- 只想控制内置文件工具访问路径：用 `permissions`
- 需要控制自定义工具、做内容检查、审计、限流等：用 backend policy hooks 或 wrapper

---

## 基本用法

在 `create_deep_agent(...)` 里传 `permissions=[...]` 即可。

```python
from deepagents import create_deep_agent, FilesystemPermission

agent = create_deep_agent(
    model=model,
    backend=backend,
    permissions=[
        FilesystemPermission(
            operations=["write"],
            paths=["/**"],
            mode="deny",
        ),
    ],
)
```

这个例子表示：

- 所有写操作全部拒绝
- 因此 Agent 变成只读文件系统 Agent

---

## 权限规则的核心结构

每条 `FilesystemPermission` 由三个部分组成：

- `operations`
- `paths`
- `mode`

### 1. `operations`

类型：

```python
["read"]
["write"]
["read", "write"]
```

含义：

- `read` 包含：
  - `ls`
  - `read_file`
  - `glob`
  - `grep`

- `write` 包含：
  - `write_file`
  - `edit_file`

### 2. `paths`

这是路径匹配规则，支持 glob 风格。

例如：

- `"/workspace/**"`
- `"/workspace/.env"`
- `"/memories/**"`
- `"/docs/*.{md,txt}"`

常见能力包括：

- `**`：递归匹配
- `{a,b}`：多选匹配

### 3. `mode`

可选值：

- `"allow"`
- `"deny"`

作用是指定：

- 命中该规则时，到底允许还是拒绝

默认值是 `allow`，但实际使用中建议显式写出，避免歧义。

---

## 规则匹配机制

权限系统采用的是：

- 按声明顺序匹配
- 第一条命中的规则生效
- 如果没有规则命中，默认允许

这三点非常重要。

### 这意味着什么

权限系统不是“最严格优先”，而是“先匹配先生效”。

因此：

- 规则顺序比规则内容同样重要
- 写错顺序，就算规则本身正确，也可能完全失效

### 一个简单理解方式

权限规则像防火墙规则：

- 从上往下看
- 第一条匹配到就停止
- 后面的规则不再有机会生效

---

## 最常见的几种权限设计模式

真正写权限规则时，很多人最容易卡住的不是语法，而是“到底应该从什么边界开始设”。最实用的办法通常不是从空白开始凭感觉设计，而是先套用几种常见模式，再按业务风险做增减。

---

## 模式一：把 Agent 限制在某个工作目录

这是最常见、也最适合作为默认起点的一种方式。它的思路很直接：先承认 Agent 需要读写文件，但把活动范围明确压缩到一个工作区里。

目标：

- 只允许 Agent 在 `/workspace/` 下读写
- 其他任何位置一律禁止

```python
agent = create_deep_agent(
    model=model,
    backend=backend,
    permissions=[
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/**"],
            mode="deny",
        ),
    ],
)
```

### 这个模式适合什么

如果你的核心诉求是“Agent 可以工作，但不能在整个文件系统里乱跑”，那这个模式几乎总是最先该考虑的基线。典型场景包括：

- coding assistant 只允许操作某个项目目录
- 文档助手只允许处理某个知识库目录
- 任何需要“工作区隔离”的场景

### 这是一种非常推荐的默认基线

如果你不知道怎么开始做权限控制，就先用“只开放一个工作区目录”这个模式。

---

## 模式二：保护特定敏感文件

第二类需求通常不是“全关”或“全开”，而是大部分工作区可以正常使用，但某些位置必须单独加锁。这时就需要把敏感路径从允许范围里显式剥出来。

目标：

- 允许 Agent 操作大部分工作区
- 但对 `.env`、样例目录、敏感目录单独封锁

```python
agent = create_deep_agent(
    model=model,
    backend=backend,
    permissions=[
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/workspace/.env", "/workspace/examples/**"],
            mode="deny",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/**"],
            mode="deny",
        ),
    ],
)
```

### 这个模式适合什么

如果你的项目里已经有少量明确的高风险文件或目录，这种写法往往比“缩小整个工作区”更实用。典型情况包括：

- 项目里有凭证文件
- 示例目录不希望被改写
- 某些目录只允许人工维护

### 一个经验规则

对 `.env`、密钥目录、配置模板等位置，优先默认 deny，而不是依赖 Agent 自觉不去碰。

---

## 模式三：记忆只读

到了多轮任务或多用户场景，权限控制的重点往往不再只是代码目录，而会转向“哪些知识可以查，哪些知识不能被改”。这时，把记忆区做成只读会比简单的目录白名单更有价值。

目标：

- Agent 可以读取记忆文件
- 但不能修改记忆文件

```python
agent = create_deep_agent(
    model=model,
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": StoreBackend(
                namespace=lambda rt: (rt.server_info.user.identity,),
            ),
            "/policies/": StoreBackend(
                namespace=lambda rt: (rt.context.org_id,),
            ),
        },
    ),
    permissions=[
        FilesystemPermission(
            operations=["write"],
            paths=["/memories/**", "/policies/**"],
            mode="deny",
        ),
    ],
)
```

### 这个模式适合什么

如果你把记忆看成制度、知识沉淀或共享政策，而不是 Agent 的私人草稿本，那么这一层只读限制就会非常必要。常见场景包括：

- 组织级政策库
- 共享知识库
- 由应用侧统一维护的长期记忆
- 不希望 Agent 自行改写的标准资料

### 为什么这个模式很重要

很多系统里，记忆并不等于“可以随便改的笔记本”。

有些记忆更像：

- 公司制度
- 审核通过的知识沉淀
- 共享项目规则

这些内容应该允许读取，但不应该允许 Agent 随意写入。

---

## 模式四：拒绝全部访问

还有一种思路更适合安全要求很高的系统：先什么都不给，再逐步开放。它读起来最“保守”，但在很多高约束场景里反而是最容易建立确定边界的办法。

目标：

- 先把所有读写全部封死
- 再按需逐步打开特定目录

```python
agent = create_deep_agent(
    model=model,
    backend=backend,
    permissions=[
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/**"],
            mode="deny",
        ),
    ],
)
```

### 这个模式适合什么

适合：

- 高安全要求场景
- 想从最小权限开始构建规则
- 先封闭，再逐步白名单放开

### 这种做法的优点

- 安全边界最清晰
- 不容易因为默认 permissive 行为而漏出访问面

---

## 规则顺序为什么是核心风险点

权限系统最容易踩坑的地方，不是 `allow` 和 `deny` 本身，而是你以为更严格的规则会自动优先。实际上这里没有“最严格优先”这种保护机制，只有按顺序命中，所以规则顺序本身就是安全边界的一部分。

因为权限是“第一条命中即生效”，所以规则顺序必须从“更具体”到“更宽泛”。

### 正确写法

```python
permissions=[
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/workspace/.env"],
        mode="deny",
    ),
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/workspace/**"],
        mode="allow",
    ),
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/**"],
        mode="deny",
    ),
]
```

含义：

1. 先特殊拒绝 `.env`
2. 再允许整个工作区
3. 最后拒绝其他所有路径

### 错误写法

```python
permissions=[
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/workspace/**"],
        mode="allow",
    ),
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/workspace/.env"],
        mode="deny",
    ),
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/**"],
        mode="deny",
    ),
]
```

这个写法的问题是：

- `/workspace/.env` 先被 `/workspace/**` 命中
- 因此后面的 deny 永远没有机会执行

### 一条实用规则

永远把：

- 特殊 deny
- 精细 allow
- 全局 deny

按这个顺序排。

---

## 子代理权限

子代理默认继承父 Agent 的权限。

这意味着：

- 父 Agent 能访问什么，子代理通常也能访问什么
- 如果不额外配置，子代理不会自动变得更受限

### 给子代理单独设置权限

如果希望子代理拥有不同权限，可以在子代理定义里显式设置 `permissions`。

注意：

- 子代理一旦设置了 `permissions`
- 这会完全替换父 Agent 的权限规则
- 不是“在父规则上追加”

### 示例

```python
agent = create_deep_agent(
    model=model,
    backend=backend,
    permissions=[
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/workspace/**"],
            mode="allow",
        ),
        FilesystemPermission(
            operations=["read", "write"],
            paths=["/**"],
            mode="deny",
        ),
    ],
    subagents=[
        {
            "name": "auditor",
            "description": "Read-only code reviewer",
            "system_prompt": "Review the code for issues.",
            "permissions": [
                FilesystemPermission(
                    operations=["write"],
                    paths=["/**"],
                    mode="deny",
                ),
                FilesystemPermission(
                    operations=["read"],
                    paths=["/workspace/**"],
                    mode="allow",
                ),
                FilesystemPermission(
                    operations=["read"],
                    paths=["/**"],
                    mode="deny",
                ),
            ],
        }
    ],
)
```

### 这个例子表达了什么

父 Agent：

- 可读可写 `/workspace/**`

子代理 `auditor`：

- 只能读取 `/workspace/**`
- 完全禁止写入

### 适合的典型角色拆分

- 主代理：可读可写
- 审计子代理：只读
- 报告子代理：只读特定目录
- 修复子代理：只写输出目录

这类分权设计在复杂 Agent 系统里非常实用。

---

## 与 `CompositeBackend` 配合时的限制

如果 backend 是 `CompositeBackend`，而它的默认 backend 是 sandbox，那么权限规则会有一个额外限制：

- 权限路径必须落在明确的 route 前缀下
- 不能覆盖到 sandbox 默认区域

### 为什么会这样

因为 sandbox 支持 `execute`，而 `execute` 可以运行任意命令。

这意味着：

- 即使你在权限规则里写了路径 deny
- 只要 Agent 还能通过 shell 访问该路径
- 单纯的路径权限规则就无法真正形成安全边界

因此系统要求：

- 权限规则只能施加在明确路由到某个非 sandbox backend 的路径上

### 一个可行例子

```python
from deepagents.backends import CompositeBackend

composite = CompositeBackend(
    default=sandbox,
    routes={"/memories/": memories_backend},
)

agent = create_deep_agent(
    model=model,
    backend=composite,
    permissions=[
        FilesystemPermission(
            operations=["write"],
            paths=["/memories/**"],
            mode="deny",
        ),
    ],
)
```

这里可以工作，是因为：

- `/memories/**` 明确属于一个已知 route
- 不是落在默认 sandbox 区域里

### 不可行例子

```python
agent = create_deep_agent(
    model=model,
    backend=composite,
    permissions=[
        FilesystemPermission(
            operations=["write"],
            paths=["/workspace/**"],
            mode="deny",
        ),
    ],
)
```

或：

```python
agent = create_deep_agent(
    model=model,
    backend=composite,
    permissions=[
        FilesystemPermission(
            operations=["read"],
            paths=["/**"],
            mode="deny",
        ),
    ],
)
```

这类配置会报 `NotImplementedError`。

### 一条必须记住的规则

如果默认 backend 是 sandbox：

- 不要试图用 `permissions` 去限制默认 sandbox 区域
- 真正的控制应来自 sandbox 隔离、网络限制、审批与外层策略设计

---

## `permissions` 和 backend policy hooks 的区别

这两个机制很容易混淆，但用途完全不同。

### `permissions` 适合做什么

适合：

- 路径 allow / deny
- 读写边界配置
- 基础访问控制
- 子代理目录隔离

特点：

- 配置简单
- 声明式
- 可读性高
- 适合静态访问规则

### backend policy hooks / wrapper 适合做什么

适合：

- 内容审查
- 频率限制
- 审计日志
- 复杂动态验证
- 控制自定义工具
- 多条件判断

特点：

- 灵活度更高
- 但实现复杂度也更高

### 一个实用判断标准

如果你问的是：

- “这个目录能不能写？”
  - 用 `permissions`

如果你问的是：

- “写入前我要不要检查内容是否含敏感词？”
  - 用 backend hook / wrapper

---

## 常见权限设计套路

### 套路一：工作区白名单

目标：

- 只开放 `/workspace/**`
- 其他全部 deny

适合：

- 最常见的 coding assistant 限权

### 套路二：敏感文件黑名单

目标：

- 工作区大部分可用
- `.env`、`secrets/`、`examples/` 等目录封禁

适合：

- 有少量高风险文件需要额外保护

### 套路三：长期记忆只读

目标：

- Agent 可以查知识库
- 不能自行篡改知识库

适合：

- 多用户共享知识库
- 组织政策文件

### 套路四：子代理分权

目标：

- 主代理可写
- 子代理只读

适合：

- 审计、review、分析型子代理

---

## 常见错误与排查

### 规则看起来对，但就是不生效

最常见原因：

- 规则顺序错了
- 前面的宽泛 allow 先命中
- 后面的 deny 永远到不了

解决：

- 先写具体 deny
- 再写局部 allow
- 最后写全局 deny

### 以为没匹配规则就默认拒绝

这是错误理解。

真实行为是：

- 没有命中任何规则时，默认允许

解决：

- 如果想要默认拒绝，必须显式补一条 `"/**" + deny`

### 以为 `permissions` 能限制自定义工具

这是错误理解。

真实情况是：

- `permissions` 只约束内置文件系统工具
- 自定义工具需要自己做限制

解决：

- 对自定义工具加内部校验
- 或在 backend / middleware 层做策略控制

### 以为 `permissions` 能限制 sandbox 的 shell 访问

这也是错误理解。

因为：

- shell 通过 `execute` 运行
- 不受内置文件权限规则约束

解决：

- sandbox 场景下用隔离、审批、网络限制和 provider 级安全策略

### 子代理权限设置后行为和父代理不一致

原因：

- 子代理的 `permissions` 是替换父规则，不是继承后追加

解决：

- 给子代理写规则时，要把完整权限集重新写全

### `CompositeBackend` + sandbox 下报 `NotImplementedError`

原因：

- 权限路径覆盖到了默认 sandbox 区域
- 系统无法把这种规则解释成真正安全的约束

解决：

- 只对显式 route 的路径写权限规则

---

## 验收标准

可以用下面的标准判断权限配置是否合理：

- Agent 只能访问预期目录
- 敏感文件不会被读写
- 未命中白名单的路径最终会被拒绝
- 子代理权限与角色设计一致
- `CompositeBackend` 下的权限只作用在明确路由的后端上
- 自定义工具和 sandbox 风险没有被误判为已被 `permissions` 覆盖

---

## 推荐实操顺序

建议按这个顺序配置权限：

1. 先明确 Agent 需要访问哪些目录
2. 先写最小工作区 allow 规则
3. 再补敏感路径 deny 规则
4. 最后补全局 deny 规则
5. 如果有子代理，再按角色拆分权限
6. 如果有 sandbox 或自定义工具，再单独设计额外安全机制

---

## 关键要点

- `permissions` 只管内置文件系统工具
- 规则按顺序匹配，第一条命中即生效
- 没有命中规则时默认允许
- 要想默认拒绝，必须显式写全局 deny
- 子代理默认继承父权限，显式配置后会完全替换
- sandbox 的 `execute` 不受路径权限规则保护
- 路径边界控制用 `permissions`，复杂验证逻辑用 backend hooks

---

## 写在最后

文件权限控制的本质，是把 Agent 的文件访问能力从“默认开放”收敛成“按路径和操作精确授权”。

可以把整个权限系统理解成三层：

- 第一层：哪些操作属于读，哪些属于写
- 第二层：哪些路径应该允许，哪些路径必须拒绝
- 第三层：主代理和子代理是否应该拥有不同权限边界

当这三层设计清楚后，Agent 的文件系统访问才真正进入可控状态。
