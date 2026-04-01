# AutoTrip Architecture

## Overview

AutoTrip 当前是一个单体全栈应用：

- 前端：`Next.js App Router + React + TypeScript`
- 后端：Next.js Route Handlers
- 存储：`Postgres + Prisma`
- 规划引擎：应用内同步执行

主流程是：

1. 管理员登录或首次自举创建账号
2. 保存 OpenAI-compatible LLM 配置
3. 用户提交 `TripRequest`
4. 系统收集候选 POI
5. 规则引擎先做 heuristic draft
6. LLM 对 draft 进行结构化精修
7. Validator/Repair 修复冲突后持久化
8. 前端工作台支持拖拽、保存和重排未锁定项目

## Key Modules

- `app/`
  负责页面和 API 路由
- `components/dashboard-client.tsx`
  负责主工作台 UI、拖拽编辑和行程操作
- `lib/planning/engine.ts`
  负责候选点收集、heuristic、LLM refinement 和 repair 流程
- `lib/geo/`
  地图供应商抽象层；当前支持高德和 mock provider
- `lib/llm/openai-compatible.ts`
  OpenAI-compatible 接口封装、超时控制和重试逻辑
- `lib/schemas/trip.ts`
  Trip/Itinerary 相关 schema 与 relaxed schema
- `prisma/schema.prisma`
  管理员、LLM 配置和 Trip 持久化模型

## Planning Pipeline

### 1. Candidate Builder

- 优先走地图供应商搜索 POI
- 当 `AMAP_API_KEY` 缺失时：
  - 先尝试 LLM 生成真实 POI 候选点
  - 如果仍失败，再回退到 mock placeholder
- 系统会在 itinerary metadata 中记录 `candidateSource`

### 2. Heuristic Pre-Planner

- 按兴趣、must-visit、节奏对候选点打分
- 先形成可落库的多日 draft
- 在没有精确地图矩阵时，使用 fallback distance estimation

### 3. LLM Planner

- 使用固定 JSON 输出约束
- 当前协议只支持 `chat/completions`
- 对上游 `429 / 5xx / timeout` 做轻量重试
- 接收 relaxed itinerary schema，再做本地补全

### 4. Validator / Repair

- 检查重复 POI
- 检查时间重叠
- 检查长距离通勤
- 修复时间顺序并合并保留系统 warning

## Data Quality Strategy

项目当前采用“宽进严出”策略：

- 宽进：允许 LLM 返回不完整的 POI 或 itinerary 结构
- 严出：在落库前补齐 `id / address / lat / lng / duration / time fields`

补全过程优先级：

1. 使用 LLM 原始字段
2. 用 heuristic 候选点按 `id` 或 `name` 回填
3. 用系统默认值和近似坐标兜底

这让项目能兼容更松散的 OpenAI-compatible 提供方，但真实地图数据仍然是首选。

## Current Tradeoffs

- 同步规划逻辑易于调试，但高并发时需要拆 worker
- 单管理员模式简化了权限和隔离问题
- 没有地图 key 时可以继续工作，但结果可信度会下降
- 国际目的地可用，但目前仍是 beta 体验
