# dsh-anchored-standard-plus

一个 DeepSeek Harness（DSH）的 **agent preset**：保留 `anchored-standard` 的"首请求 RL 锚定"机制，并加上两个本地增强——**部署插件常驻** 与 **逐轮格式守卫**。

> 社区项目。不是 DeepSeek 官方 preset，也不代表 DeepSeek 的认可或背书。

## 它是什么

首轮模型请求只暴露官方 minimal 的真实 RL 条件（一句 system prompt + `bash` + `str_replace_editor`），会话出现首次工具调用或回复后晋升到 resident 目录，重型工具按需解锁。在此基础上：

| 能力 | 上游 [dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) | 本仓库 |
|---|---|---|
| 首请求锚定 | ✅ `bash + str_replace_editor` + 一句话 persona + 剥 AGENTS/技能注入 | ✅ 完全保留 |
| 晋升后 resident 目录 | bootstrap 对 + 发现工具 + 按需解锁 | ✅ 保留 |
| 部署插件常驻 | ❌ 全部按需解锁 | ✅ `antigravity_agent` / `antigravity_agent_status` / `vision` / `web_search` 晋升后直接可见 |
| 长对话格式守卫 | ❌ | ✅ 从第二轮起每轮注入一条固定 Format guard（参照 [dsh-router-standard](https://github.com/yjh051108/dsh-router-standard) 的 near-field guidance 模式） |

## 为什么

DeepSeek V4 Pro 对**首次请求的 agent scaffold**高度敏感：官方 DSH 的 minimal preset
快照测试直接把该条件命名为 "the exact RL prompt and schemas"。社区实测（
[xiaobright/modeltest](https://github.com/xiaobright/modeltest)）中，同一题同一环境：

- standard：91
- PTC：92
- minimal：99 / 96
- anchored-standard（首轮两工具、随后全量工具）：98 / 99

关键不是全程只给两个工具，而是**首轮先落进 RL 对齐轨迹，之后轨迹会锁定并延续**。
`we need` / `let me` 只是轨迹指纹；真正的开关是首请求的 prompt + 工具 schema + 无自动
注入上下文。

本仓库的增量解决两个日常使用问题：

1. **插件找不到了**：晋升后目录太小，模型不知道 antigravity / vision / web_search 存在。
   `residentTools` 让这些部署插件第二轮起直接可见，不需要模型自己想到去 `dev_tool_search`。
2. **长对话掉格式**：模型后期会悄悄丢掉表格/标题、凭记忆重算之前验过的数据。
   `format-guard` 从第二个真实用户消息起，每轮注入一条固定、缓存友好的格式契约。

## 安装

```sh
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
mkdir -p "$DSH_HOME/.agent-presets"
test ! -e "$DSH_HOME/.agent-presets/anchored-standard"   # 已存在则先备份/删除旧版
cp -R preset "$DSH_HOME/.agent-presets/anchored-standard"
```

然后重启 DeepSeek Harness（或依赖 preset 目录的热加载），新建空会话，在预设列表选择
**Anchored Standard (experimental)**；也可以把 `settings.yaml` 的
`agent-presets.default` 设为 `anchored-standard`。

不要在已经产生内容的会话中途切换 preset。

### 兼容性

- DeepSeek Harness `0.1.0-rc.6`、Node.js 24（本仓库实测环境）
- 上游开发基准：DSH `0.1.0-rc.5` + commit `47f9438`

## 验证加载

导出一个新会话的 JSONL，检查 `request/header`：

1. 首份 header：
   - `system` == `You are a helpful software engineer assistant.`
   - `tools` == `bash, str_replace_editor`
2. 首次工具调用或回复后的 header（resident）：
   - `bash, str_replace_editor, dev_tool_search, skill_search, skill_load`
   - 外加 `antigravity_agent, antigravity_agent_status, vision, web_search`（本仓库增强）
3. 第二个真实用户消息之后，消息流里应出现 `source.kind = plugin, plugin = format-guard`
   的固定格式守卫；第一条用户消息不注入（保护首请求锚定）。

本地健康检查（零依赖）：

```sh
npm run check
```

## 真实会话示例

一份真实长会话的脱敏证据：用户要求把一篇"便携式矢量网络分析仪设计与实现"的毕设论文
整理成开题 PPT。详见 [`docs/case-vna.md`](docs/case-vna.md)。

摘要：

| 项 | 值 |
|---|---|
| 模型 | deepseek-vision-official / deepseek-v4-pro / max |
| 首份 header system | `You are a helpful software engineer assistant.` |
| 首份 header tools | `bash, str_replace_editor` |
| 首块轨迹指纹 | `We`/`Need` 系，整会话 `we`×7、`we need`×1、`let me`×0 |
| 晋升后 tools | resident 目录 + `antigravity_agent/status, vision, web_search` |
| 后续按需解锁 | `subagent` / `subagent_fork` / `interrupt_agent` / `list_agents` / `send_message` |
| 会话规模 | 11 turns、203 次工具调用、188 条 assistant 消息 |

## 配置参考

`preset/agent.cordis.yml` 中与本仓库相关的新增/改动：

```yaml
- id: tool-bootstrap
  name: ./tool-bootstrap-v3.mjs        # 上游 tool-bootstrap.mjs（重命名以绕过 DSH 模块缓存）
  config:
    bootstrapTools: [bash, str_replace_editor]
    promoteOn: either
    suppressedContextSources: [agent-instructions, skill-catalog]
    residentTools: [antigravity_agent, antigravity_agent_status, vision, web_search]
    compactionTools: [read, write, edit, glob, grep, todo_write, ask_user_question]

- id: format-guard
  name: ./format-guard-v5.mjs          # 每轮格式守卫（router-standard 的 near-field 模式）
```

其余配置与上游一致，未知键会在 preset 挂载时报错。

## License

MIT。本仓库 fork 自 [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
（MIT），后者包含 DeepSeek Harness Standard preset 的改编副本。归属与致谢见 [NOTICE](NOTICE)
与 [LICENSE](LICENSE)。

本仓库不含任何 API key、账号 JSON、内部绝对路径或用户隐私数据。
