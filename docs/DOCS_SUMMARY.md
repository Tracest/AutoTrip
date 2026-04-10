# 文档总览

这个文件用于快速定位项目文档。

## 建议阅读顺序

1. `README.md`
2. `AGENTS.md`
3. `docs/RUNBOOK.md`
4. `docs/PROJECT_STATUS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/TROUBLESHOOTING.md`

## 每个文件解决什么问题

### `README.md`

适合先看这些内容：

- 项目定位
- 快速启动
- 环境变量
- 当前默认规划链路

### `AGENTS.md`

适合了解：

- 项目协作约束
- 文档与注释语言要求
- 变更时的验证标准
- 当前项目级偏好

### `docs/RUNBOOK.md`

适合在这些场景使用：

- 本地拉起项目
- 做一轮健康检查
- 跑标准验证命令
- 做真实联机校验

### `docs/PROJECT_STATUS.md`

适合了解：

- 现在做到哪一步了
- 最近有哪些关键变化
- 已验证到什么程度
- 还剩哪些主要风险

### `docs/ARCHITECTURE.md`

适合在这些情况下查看：

- 理解规划主流程
- 修改模型联网调研链路
- 修改候选点清洗、补齐与排程逻辑

### `docs/TROUBLESHOOTING.md`

适合排查：

- 应用无法启动
- 模型无法连接
- 规划失败
- 候选点明显离谱
- 本机 Ollama 资源不足

## 当前项目事实

截至 `2026-04-10`，当前最重要的事实是：

- 配置高德时，高德仍然是高置信度路径
- 没有高德时，候选点主来源已经切换为“大模型自行联网调研”
- TypeScript 现在负责执行工具、校验、清洗、补齐和排程
- `deepseek-r1:8b` 已在本机真实联机验证通过
- 城市种子点仍然保留，作为稳定性兜底层

如果文档与代码不一致，优先以 `README.md`、`docs/ARCHITECTURE.md` 和 `lib/planning/engine.ts` 为准。
