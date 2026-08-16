# 案例：便携式矢量网络分析仪毕设 PPT（脱敏）

这是一份真实 DSH 会话的**脱敏摘要**，用于演示 `dsh-anchored-standard-plus` 的
首请求锚定、晋升与按需解锁行为。原始会话含个人路径、论文原文和推理全文，不公开；
这里只保留可复算的 header 与聚合轨迹指标。

## 会话背景

- 用户目标：把一篇《便携式矢量网络分析仪设计与实现》的毕业设计论文整理为开题 PPT，
  并要求使用 ppt-master skill。
- 会话性质：多代理协作长任务，中途派发多个子代理回填 PPT 内容。
- 模型：`deepseek-vision-official / deepseek-v4-pro / max`，上下文窗口 1,000,000。

## 锚定证据（从 session JSONL 的 `request/header` 读取）

| 快照 | reason | system | tools |
|---|---|---|---|
| 首请求 | `initial` | `You are a helpful software engineer assistant.` | `bash, str_replace_editor` |
| 晋升后 | `change` | 同上 | `bash, str_replace_editor, dev_tool_search, skill_search, skill_load, antigravity_agent, antigravity_agent_status, vision, web_search` |
| 后续按需解锁 | `change` | 同上 | 在 resident 集上增加 `subagent, subagent_fork` 等，再增加 `interrupt_agent, list_agents, send_message` |

## 轨迹指纹（整会话聚合）

| 指标 | 值 |
|---|---|
| reasoning 字符数（chunk 归并） | 2,293 |
| `we`（边界匹配） | 7 |
| `we need` | 1 |
| `let me` | 0 |

首块 reasoning 以 `We`/`Need` 系句式进入任务，符合 anchored 轨迹的指纹；晋升后未出现
`let me` 回潮。

## 会话规模

| 指标 | 值 |
|---|---|
| turns | 11 |
| 工具调用 | 203 |
| assistant 消息 | 188 |

## 结论

该会话证明：

1. 首请求精确锚定在 RL 条件上（一句话 system + Minimal 真实工具对）；
2. 晋升后本仓库的 `residentTools` 让部署插件（antigravity、vision、web_search）直接可见；
3. 更重的 subagent 家族仍通过 `dev_tool_search` 按需解锁，目录不会一次性倒出；
4. 长任务全程 `let me = 0`，轨迹没有漂回 standard 风格。
