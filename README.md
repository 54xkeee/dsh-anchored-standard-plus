# dsh-anchored-standard-plus

> DeepSeek Harness 的 agent preset：把 DeepSeek V4 Pro 从"被降智"的 Standard 轨迹里救回来。

[![GitHub release](https://img.shields.io/github/v/release/54xkeee/dsh-anchored-standard-plus)](https://github.com/54xkeee/dsh-anchored-standard-plus/releases)
[![License: MIT](https://img.shields.io/github/license/54xkeee/dsh-anchored-standard-plus)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.19-green)](#兼容性)

**TL;DR**：V4 Pro 在 DSH 里"变笨"，很多时候不是模型差，而是开局条件没对上它的 agent RL 训练接口。这个 preset 让**新会话的第一请求**精确复刻官方 minimal 的 RL 条件（一句话 system prompt + `bash` + `str_replace_editor`），把会话锚进高分轨迹；第一轮之后工具自动放开，能力不丢。顺手修了两个日常问题：晋升后你的插件工具直接可见、长对话不掉格式。

*English abstract*: A DeepSeek Harness agent preset that reproduces the official
minimal "exact RL prompt and schemas" on the **first request** (`bash` +
`str_replace_editor` + one-sentence system prompt, no auto-injected context),
locking DeepSeek V4 Pro into the high-ability trajectory, then re-opening tools
after promotion. Adds resident deployment-plugin tools and a per-turn
format/continuity guard for long conversations.

## 效果演示

**两阶段生命周期**：首请求 RL 锚定 → promotion → resident 工具放开：

![dsh-anchored-standard-plus 两阶段锚定流程图](docs/images/anchor-flow.svg)

**线上验证证据**：从真实会话 JSONL 读到的 `request/header` 快照（脱敏）：

![真实会话 request/header 验证证据](docs/images/header-proof.svg)

> 关键词：DeepSeek V4 Pro 降智修复 · DSH agent preset · RL scaffold 锚定 ·
> `we need` / `let me` 轨迹指纹 · resident tools · 长对话格式守卫

---

## 目录

- [为什么 V4 Pro 会"降智"](#为什么-v4-pro-会降智)
- [本项目怎么解决](#本项目怎么解决)
- [快速开始](#快速开始)
- [怎么确认生效了](#怎么确认生效了)
- [使用建议](#使用建议)
- [FAQ](#faq)
- [实验依据与边界](#实验依据与边界)
- [与上游的差异](#与上游的差异)
- [配置参考](#配置参考)
- [项目结构](#项目结构)
- [License](#license)

---

## 为什么 V4 Pro 会"降智"

社区实测（[xiaobright/modeltest](https://github.com/xiaobright/modeltest)，同一道完整工程维护题、同一环境）：

| 开局条件 | Ability |
|---|---|
| DSH `standard` | **91** |
| DSH `PTC`（code 模式） | **92** |
| DSH `minimal`（官方 RL 条件） | **99 / 96** |
| `anchored-standard`（首轮 minimal、随后全量工具） | **98 / 99** |

关键不是"工具越少越好"——而是 **DeepSeek V4 Pro 针对 agent RL 训练时，训练分布就是**
官方 DSH `minimal` 的那套接口。官方源码的快照测试直接把它命名为
*"sends the exact RL prompt and schemas"*：

- system prompt 只有一句：`You are a helpful software engineer assistant.`
- 首请求只暴露两个真实工具 schema：`bash` + `str_replace_editor`
- 不自动注入 AGENTS.md 摘要、技能目录等上下文

当会话**第一请求**落进这个分布，模型会选中"计划-集体（we）"的策略区，并且**轨迹会锁定、
延续**；之后即使把完整工具目录放回来，它也不会漂回 Standard 的"`Let me` 复读机"轨迹。
反之，开局直接给 Standard 的 25+ 工具和控制面，V4 Pro 很容易掉进另一个策略区——
表现就是用户体感上的"降智"。

> 顺带破除一个常见误区：`we need` / `let me` 只是**轨迹指纹**，不是能力开关。真正决定
> 进入哪个策略区的是首请求的完整条件分布（persona + 工具 schema + 注入上下文），
> 不是往提示词里塞几个 `we need` 单词。

## 本项目怎么解决

`dsh-anchored-standard-plus` 是一个自包含的 agent preset，复制到
`~/.dsh/.agent-presets/anchored-standard/` 即可用。它做三件事：

1. **首请求精确锚定**：一句话 RL persona（`complete: true` + 抑制运行时上下文）
   + 精确的 `bash` / `str_replace_editor` 工具对 + 剥离 AGENTS/技能目录注入。
2. **晋升后逐步放开**：首次工具调用或首次回复后，进入 resident 目录
   （bootstrap 对 + `dev_tool_search` / `skill_search` / `skill_load`），
   重型工具按需解锁，而不是一次性倒出全部工具把轨迹拉回去。
3. **两个本地增强**（相对上游）：
   - `residentTools`：`antigravity_agent` / `antigravity_agent_status` /
     `vision` / `web_search` 晋升后**直接可见**，不用等模型自己想起来去搜索解锁；
   - `format-guard`：从第二个真实用户消息起，每轮注入一条固定的格式/连续性守卫，
     长对话不再悄悄丢表格、丢基准数据、凭记忆重算日期干支。

## 快速开始

### 方式 A：npm（推荐）

```sh
npm install -g dsh-anchored-standard-plus
dsh-anchored-plus                 # 安装到 $DSH_HOME/.agent-presets/anchored-standard
# 已存在：dsh-anchored-plus --force     # 旧目录自动备份
# 先预览：dsh-anchored-plus --dry-run
```

### 方式 B：GitHub 手动复制

```sh
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
git clone https://github.com/54xkeee/dsh-anchored-standard-plus.git
cp -R dsh-anchored-standard-plus/preset "$DSH_HOME/.agent-presets/anchored-standard"
```

### 启用

1. 重启 DeepSeek Harness（或依赖 preset 目录热加载）；
2. **新建一个空白会话**，预设选 `Anchored Standard (experimental)`；
   或把 `settings.yaml` 的 `agent-presets.default` 设为 `anchored-standard`；
3. 模型选 DeepSeek V4 Pro（`deepseek-vision-official / deepseek-v4-pro`），
   `reasoningEffort = max`。

> 不要给已经产生内容的会话中途切换 preset——轨迹在第一请求就锁定了。

## 怎么确认生效了

导出会话 JSONL，看三处：

| 检查点 | 预期值 |
|---|---|
| 首份 `request/header` 的 `system` | 恰好是 `You are a helpful software engineer assistant.` |
| 首份 `request/header` 的 `tools` | 恰好是 `bash, str_replace_editor` |
| 首块 reasoning | `We` / `We need` 开头，`let me = 0` |

晋升后的 header 应包含：

```text
bash, str_replace_editor, dev_tool_search, skill_search, skill_load,
antigravity_agent, antigravity_agent_status, vision, web_search
```

第二个真实用户消息之后，消息流里应出现一条固定格式守卫
（`source.plugin = format-guard`）；第一条用户消息不会注入，以保护首请求锚定。

本地健康检查：

```sh
npm run check
```

真实会话示例（脱敏）：把一篇"便携式矢量网络分析仪设计与实现"毕设论文整理成开题 PPT 的
长会话，首请求精确锚定、晋升后插件直接可见、203 次工具调用全程 `let me = 0`。
见 [`docs/case-vna.md`](docs/case-vna.md)。

## 使用建议

按任务类型选择开局，是这门"玄学"里最不玄的部分：

| 任务类型 | 建议 preset | 依据 |
|---|---|---|
| 维护 / 修 bug / 读代码再动手 / 长工程 | **anchored-standard**（本仓库） | Project2 维护题：minimal 99/96、anchored 98/99 |
| 从零写新项目 / 绿场构建 / 交付导向 | `code`（PTC）或 standard 系 | Mario 绿场题：code 10/10 vs anchored 6/10 |
| 简单问答、短任务 | 随便 | 简单任务各条件都饱和，测不出差别 |

三条铁律：

1. **新会话第一句话就是真实任务**，别用"你好 / 1+1"暖场——首请求决定轨迹，暖场会把锚定机会浪费在废话上。
2. **首块不是 `We` 开头、或出现 `Let me`**：别抢救，直接新开会话。中途换提示词救不回来（社区 P3/P6 实验已证）。
3. **能力验收只看交付**：简单问答看 `we need` 只能做体检，不能证明能力。分数差异只有在足够复杂的长任务上才显现（简单任务会饱和）。

## FAQ

**Q：这不是就是官方 minimal 吗？**
A：不是。minimal 全程只有两个工具，很多插件和重型工具用不了。本 preset 首轮是
minimal 条件，**第一轮之后逐步放开**：resident 目录 + 你的插件 + 按需解锁的重工具，
能力与轨迹兼得。

**Q：往 system prompt 里塞 `we need` 提示词（比如 oh-we-need）有用吗？**
A：能改措辞，不等于进入优势策略区。`we need` 是轨迹指纹；真正开关是首请求的
persona + 工具 schema + 无注入上下文三者合起来。只抄指纹、不抄接口，效果不稳定。

**Q：为什么第二轮模型找不到我的插件了？**
A：晋升后是"常驻 + 按需"目录，不是全量 25+ 工具。本仓库已把
`antigravity_agent / antigravity_agent_status / vision / web_search` 设为常驻；
其它重工具（subagent / workflow / jobs 等）模型应先用 `dev_tool_search` 搜索并解锁，
解锁后从下一请求起持续可用。要再加常驻工具，编辑 `agent.cordis.yml` 的
`residentTools` 列表即可。

**Q：为什么长对话后面格式和细节掉了？**
A：模型后期会偷懒降级格式、凭记忆重算之前验证过的数据。本仓库的 `format-guard`
从第二轮起每轮注入同一条固定守卫（缓存友好），要求：保持上一轮的 Markdown 结构、
不凭记忆重算、继续引用之前的基准表。

**Q：改完文件没生效？**
A：DSH 会缓存已加载的 preset 模块。改 `agent.cordis.yml` 配置通常热重载；
改本地 `.mjs` 模块内容时，保险做法是**换文件名 + 改引用**或重启 DSH。
这也是本仓库模块带版本后缀（`-v3`、`-v5`）的原因。

## 实验依据与边界

- 高分证据：[xiaobright/modeltest](https://github.com/xiaobright/modeltest)
  V4.1b：同一题同环境，minimal 99/96、anchored-standard 98/99、standard 91、PTC 92。
- 轨迹机制：[yjh051108/dsh-router-standard](https://github.com/yjh051108/dsh-router-standard)
  的 persona 相变实验：首请求选择策略区，轨迹 path-committed，中途切换无效。
- **诚实边界**：n 很小、同一道题反复验证；`Mario` 绿场题上 anchored 只有 6/10
  （code 10/10）。所以这不是"永远更强"的银弹，而是"把 V4 Pro 放进它被训练过的
  接口里，按任务选开局"。措辞（`we` / `let me`）是指纹，不是能力证明。

## 与上游的差异

| 能力 | 上游 [dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) | 本仓库 |
|---|---|---|
| 首请求 RL 锚定 | ✅ | ✅ 完全保留 |
| 晋升后 resident 目录 | ✅ | ✅ 保留 |
| 部署插件晋升后常驻 | ❌ 全部按需解锁 | ✅ `antigravity_agent` / `antigravity_agent_status` / `vision` / `web_search` |
| 每轮格式守卫 | ❌ | ✅ `format-guard`（参照 router-standard 的 near-field 模式） |
| npm 一键安装 | ❌ | ✅ `npx dsh-anchored-plus` |

## 配置参考

`preset/agent.cordis.yml` 中本仓库相关的新增/改动：

```yaml
- id: tool-bootstrap
  name: ./tool-bootstrap-v3.mjs        # 上游 tool-bootstrap.mjs（重命名绕过 DSH 模块缓存）
  config:
    bootstrapTools: [bash, str_replace_editor]
    promoteOn: either
    suppressedContextSources: [agent-instructions, skill-catalog]
    residentTools: [antigravity_agent, antigravity_agent_status, vision, web_search]
    compactionTools: [read, write, edit, glob, grep, todo_write, ask_user_question]

- id: format-guard
  name: ./format-guard-v5.mjs          # 每轮格式守卫
```

其余配置与上游一致；未知键会在 preset 挂载时报错。

## 项目结构

```text
preset/                 自包含 preset：复制到 ~/.dsh/.agent-presets/anchored-standard/
  agent.cordis.yml      组合定义（anchor + residentTools + format-guard）
  tool-bootstrap-v3.mjs 首请求锚定 / 晋升 / 上下文剥离
  format-guard-v5.mjs   逐轮格式守卫
  dev-tool-search.mjs   重工具按需搜索与解锁
  skill-search.mjs      技能按需搜索与加载
  instruction-hint.mjs  晋升后的一次性指令文件提示
  compaction-epoch.mjs  压缩边界与再晋升
  custom-bash.mjs       Windows 下的 bash 兼容实现
bin/dsh-anchored-plus.mjs   npm 安装 CLI
verify/check.mjs        零依赖健康检查（npm run check）
docs/case-vna.md        真实长会话脱敏示例
```

### 兼容性

- DeepSeek Harness `0.1.0-rc.6`、Node.js 24（本仓库实测环境）
- 上游开发基准：DSH `0.1.0-rc.5` + commit `47f9438`

## License

MIT。本仓库 fork 自 [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
（MIT），后者包含 DeepSeek Harness Standard preset 的改编副本。归属与致谢见
[NOTICE](NOTICE) 与 [LICENSE](LICENSE)。

本仓库不含任何 API key、账号 JSON、内部绝对路径或用户隐私数据。
