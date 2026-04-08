# AutoTrip 架构说明

## 总览

AutoTrip 当前是一个单体全栈应用：

- 前端：Next.js App Router + React + TypeScript
- 后端：Next.js Route Handlers
- 持久化：PostgreSQL + Prisma
- 模型接入：OpenAI-compatible `chat/completions`
- 行程引擎：应用内同步规划与修复

它的核心思路不是“让模型从零编造整份行程”，而是：

1. 先收集一批尽量真实的候选 POI
2. 用规则排程生成一份可执行草案
3. 再把草案交给模型做结构化细化
4. 最后统一做校验、修复和持久化

## 核心数据流

```text
用户登录
-> 保存模型配置
-> 提交 TripRequest
-> 构建候选 POI
-> 规则排程生成草案
-> 可选模型细化
-> 校验 / 修复
-> 保存 Trip
-> 前端工作区继续编辑
```

## 目录与关键模块

### 页面与 API

- `app/page.tsx`
  主工作台入口，要求管理员已登录
- `app/login/page.tsx`
  登录页
- `app/api/auth/login/route.ts`
  登录接口，支持首个管理员自动创建
- `app/api/settings/llm/route.ts`
  读取 / 保存模型配置
- `app/api/settings/llm/test/route.ts`
  测试模型连接
- `app/api/settings/llm/models/route.ts`
  发现可用模型
- `app/api/trips/plan/route.ts`
  流式规划并持久化
- `app/api/trips/[id]/route.ts`
  获取 / 删除单条行程
- `app/api/trips/[id]/items/route.ts`
  保存工作区编辑后的 itinerary
- `app/api/trips/[id]/replan/route.ts`
  重排未锁定项目

### 前端工作区

- `components/dashboard-client.tsx`
  主工作台 UI，负责：
  - 模型配置
  - 行程表单
  - 规划状态展示
  - 历史记录列表
  - 拖拽编辑
  - 保存与重排

### 规划引擎

- `lib/planning/engine.ts`
  规划入口，串起候选点收集、规则排程、模型细化、校验与持久化前数据组织
- `lib/planning/heuristics.ts`
  规则排程
- `lib/planning/poi-signals.ts`
  候选点信号识别、分类、质量分和时段偏好
- `lib/planning/prompt.ts`
  模型提示词
- `lib/planning/validator.ts`
  itinerary 校验与修复
- `lib/planning/destination.ts`
  目的地标准化、国内城市别名、中文输出偏好

### 地理数据提供者

- `lib/geo/index.ts`
  选择当前 geo provider
- `lib/geo/amap-provider.ts`
  高德地图 provider
- `lib/geo/wikimedia-provider.ts`
  Wikimedia 在线资料 provider
- `lib/geo/mock-provider.ts`
  测试专用 mock provider
- `lib/geo/shared.ts`
  通勤矩阵近似计算等共享逻辑

### 模型接入

- `lib/llm/openai-compatible.ts`
  OpenAI-compatible 客户端封装
- `lib/llm/provider-utils.ts`
  Ollama 判定、默认 key、模型发现地址推导

### 认证与存储

- `lib/auth/service.ts`
  登录和首用户 bootstrap
- `lib/auth/session.ts`
  会话 token 和 cookie
- `lib/db/prisma.ts`
  Prisma Client
- `prisma/schema.prisma`
  数据模型定义

## 数据模型

### `AdminUser`

字段要点：

- `email`
- `passwordHash`
- `llmConfig`
- `trips`

当前应用是单用户工作台，但模型上允许扩展到多用户。

### `LlmProviderConfig`

字段要点：

- `baseUrl`
- `apiKeyEncrypted`
- `model`
- `apiStyle`
- `temperature`
- `enabled`

当前仅支持 `apiStyle = "openai"`。

### `Trip`

字段要点：

- `title`
- `destination`
- `startDate`
- `days`
- `status`
- `request`
- `itinerary`
- `planningIssues`
- `lastPlannedAt`

行程请求和最终 itinerary 都以 JSON 保存，便于后续演进 schema。

## 登录与权限模型

登录流程：

1. 前端提交邮箱和密码到 `POST /api/auth/login`
2. `loginOrBootstrap()` 检查当前管理员数量
3. 如果数据库中还没有管理员，第一个登录用户会被自动创建
4. 登录成功后返回 session cookie
5. 首页和 API 通过 `requireAdminUser()` 验证会话

这意味着：

- 没有 seed 也能跑通
- seed 只是可选初始化手段

## 模型配置流

### 保存配置

`PUT /api/settings/llm`

行为：

- 校验 `baseUrl`、`model`、`temperature`
- `temperature` 范围固定为 `0 ~ 2`
- 如果是本地 Ollama：
  - 可以不填真实 API key
  - 服务端会用兼容占位 key
- 如果是远程 provider：
  - 首次保存必须提供 API key
- API key 统一加密后存库

### 测试连接

`POST /api/settings/llm/test`

行为：

- 优先使用输入框内 key
- 如果为空，会尝试复用当前已保存 key
- Ollama 允许继续使用默认兼容 key

### 模型发现

`POST /api/settings/llm/models`

行为：

- Ollama 走 `/api/tags`
- 其它 OpenAI-compatible 服务按 `baseUrl` 自动推导 `/models`

## 规划流水线

### 1. 候选点构建

候选点构建优先级：

1. 如果有 `AMAP_API_KEY`，使用 `AmapProvider`
2. 如果显式设置 `AUTO_TRIP_FORCE_MOCK=1`，使用 `MockGeoProvider`
3. 否则默认使用 `WikimediaProvider`

这是当前版本最重要的默认行为改变之一。

#### Wikimedia 路径

`WikimediaProvider` 会：

- 从 Wikivoyage 页面提取候选点
- 用 Wikipedia 搜索做补充
- 对候选点做名称、类别、地址和坐标补全
- 去掉片区、道路、大学、泛概念、明显不适合直接游玩的条目
- 优先保留更像真实景点的地点

它的目标不是地图级精度，而是：

- 没有高德 Key 时仍能产出一份可用候选池
- 明确优于假示例数据

### 2. 候选点打分与筛选

`scoreCandidates()` 和 `poi-signals.ts` 会综合考虑：

- 用户兴趣匹配
- must-visit 加权
- 地点是否像真实景点
- 是否有明显时间 / 地址信息
- 是否是广义片区、道路、泛概念
- 是否是更经典的城市默认景点

当前还加入了：

- 国内城市偏中文输出
- 更偏经典景点和老字号
- 对泛化片区 / 抽象词 / 普通楼宇做惩罚

### 3. 规则排程

`buildHeuristicItinerary()` 先生成一份可以直接保存的规则行程。

当前这部分已经不是简单平均切片，而是时间段感知排程：

- 上午优先历史 / 人文 / 主景点
- 中段优先美食
- 收尾优先夜景
- 尽量减少同类项目连续堆叠
- 对存在夜景候选的日期会优先保留夜景时段

这一步非常关键，因为它决定了：

- 即使模型细化失败，用户仍然会看到一份可执行草案
- 项目不再依赖“模型一次性吐出完美 JSON”

### 4. 可选模型细化

如果用户已经保存并启用了模型配置，`engine.ts` 会尝试：

- 把规则草案和候选点一起发给模型
- 让模型返回 relaxed itinerary JSON
- 本地再做标准化与补全

对于本地 Ollama，会使用更保守的策略：

- 更低 temperature
- `reasoningEffort: "none"`
- 更短超时
- 更少或不重试

目标是：

- 快速确认“模型能不能完成结构化细化”
- 不能的话立刻保留规则结果，避免长时间卡住

### 5. 校验与修复

`repairItinerary()` 和 `validateItinerary()` 负责：

- 检查重复 POI
- 检查时间重叠
- 检查通勤异常
- 修正明显时间顺序问题
- 合并 warning / error

### 6. 持久化

规划成功后，`POST /api/trips/plan` 会：

- 以流式进度返回状态
- 保存 Trip
- 保存 itinerary 与 planning issues
- 返回可直接用于工作区的 `TripDetail`

## 为什么这版不再默认依赖模型“兜底造点”

早期路径的问题是：

- 没有地图数据时，模型很容易返回英文片区、泛化词或空结果
- 失败后还可能被错误地包装成“看起来成功”的示例数据

当前版本的改法是：

1. 把候选点收集优先级调整为“地图或在线资料优先”
2. 模型更多承担“结构化细化”，而不是“凭空创造 POI”
3. 如果没有可信候选点，明确报错

这让系统更诚实，也更可控。

## 工作区编辑与重排

前端工作区的原则是：

- 规划结果不是终点，而是起点

用户可以：

- 拖拽项目顺序
- 锁定关键项目
- 保存当前编辑结果
- 只重排未锁定项目

对应接口：

- `PATCH /api/trips/[id]/items`
- `POST /api/trips/[id]/replan`

重排流程会重新走规划引擎，但尽量保留已锁定项目。

## 环境变量与运行时假设

强依赖：

- `DATABASE_URL`
- `APP_SECRET`
- `APP_ENCRYPTION_KEY`

可选增强：

- `AMAP_API_KEY`

行为调节：

- `LLM_TEST_TIMEOUT_MS`
- `LLM_PLANNING_TIMEOUT_MS`
- `LLM_TEST_RETRIES`
- `LLM_PLANNING_RETRIES`

开发 / 测试开关：

- `AUTO_TRIP_FORCE_MOCK=1`

## 当前权衡

- 没有高德 Key 时，Wikimedia 路径已经可用，但仍然不是地图级事实源
- 规则排程已经比机械切片好很多，但还不是专业旅行编辑水平
- 本地小模型结构化能力不稳定，所以系统必须保留“规则结果可直接落地”的能力
- 国际目的地仍是 beta 路径

## 推荐后续方向

- 加入更强的城市内经典 POI 白名单 / 黑名单策略
- 引入更强的在线检索或搜索聚合能力
- 为开放时间、闭馆日和票务信息增加额外校验层
- 增加更细粒度的日内主题模板，例如“博物馆日”“夜景日”“亲子日”
- 为国际目的地补充更稳的候选点路径
