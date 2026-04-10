# 架构说明

## 概览

AutoTrip 是一个单管理员使用的 Next.js 行程规划应用，数据持久化到 PostgreSQL。

当前规划链路分成两条主路径：

1. 配置了 `AMAP_API_KEY`
   直接使用高德作为高置信度 POI 与通勤数据源。
2. 未配置 `AMAP_API_KEY`
   使用兼容 OpenAI 的大模型通过工具自行联网调研，搜索公开网页并整理候选点。

在无高德的场景下，TypeScript 不再主导“网上搜什么、筛什么”，而是负责：

- 执行搜索与抓页工具
- 结构化校验
- 目的地越界过滤
- 类别纠偏
- 同源 POI 变体去重
- 城市种子点补齐
- 启发式排程
- 行程修复、验证与持久化

## 主流程

1. 前端向 `POST /api/trips/plan` 提交 `TripRequest`
2. `lib/planning/engine.ts` 解析目的地并选择规划路径
3. 构建候选点池：
   - 高德
   - 或大模型联网调研
   - 或城市种子点兜底
4. 对候选点做清洗：
   - 坐标修复
   - 越界过滤
   - 类别纠偏
   - 同义/变体去重
5. 候选点打分并生成启发式草案
6. 若启用了模型，则把草案交给模型做行程润色
7. 对结果做修复、验证、图片补全并入库

## 候选点链路

### 1. 高德路径

- 直接从高德拉 POI
- 通勤矩阵与开闭馆信息质量更高

### 2. 模型联网调研路径

当没有高德时：

1. 向模型下发研究提示词
2. 提供三个工具：
   - `web_search`
   - `fetch_url`
   - `multi_fetch_url`
3. 模型决定搜索词、抓取哪些页面、如何汇总
4. 模型返回结构化 JSON 候选点
5. TypeScript 清洗并验证结果

### 3. 城市种子点兜底

如果出现以下情况，会并入或回退到 `core-city-seeds`：

- 联网调研失败
- 模型候选点数量太薄
- 某些兴趣覆盖仍然缺失

现在这层兜底已经不只在 `wikimedia` 路径生效，也会在 `fallback/mock + 模型联网` 路径下生效。

## 当前关键模块

### 应用与 API

- `app/api/auth/login/route.ts`
  登录与首个管理员初始化
- `app/api/settings/llm/route.ts`
  保存模型配置
- `app/api/settings/llm/test/route.ts`
  连通性测试
- `app/api/settings/llm/models/route.ts`
  模型发现
- `app/api/trips/plan/route.ts`
  行程规划入口
- `app/api/trips/[id]/items/route.ts`
  保存编辑
- `app/api/trips/[id]/replan/route.ts`
  仅重排未锁定项目

### 规划核心

- `lib/planning/engine.ts`
  规划主编排
- `lib/planning/heuristics.ts`
  候选点打分与规则排程
- `lib/planning/prompt.ts`
  联网调研与行程润色提示词
- `lib/planning/validator.ts`
  行程修复与验证
- `lib/planning/core-city-seeds.ts`
  内置城市种子点
- `lib/planning/destination.ts`
  目的地别名、语言与本地化辅助
- `lib/planning/destination-geo.ts`
  目的地锚点与越界识别
- `lib/planning/poi-signals.ts`
  POI 信号、类别判断与纠偏

### 模型与联网工具

- `lib/llm/openai-compatible.ts`
  OpenAI 兼容客户端与工具调用循环
- `lib/llm/web-research.ts`
  搜索、抓页、正文提取与工具定义
- `lib/llm/provider-utils.ts`
  Provider URL 与 Ollama 兼容辅助

### 地图与图片

- `lib/geo/amap-provider.ts`
  高德规划路径
- `lib/geo/fallback-provider.ts`
  无地图时的兜底 Provider
- `lib/geo/mock-provider.ts`
  测试与调试专用
- `lib/geo/wikimedia-images.ts`
  Wikimedia 图片补全

## `candidateSource` 说明

当前可能出现的候选点来源标记：

- `amap`
- `llm-web-research`
- `hybrid-supplement`
- `core-city-seeds`
- `wikimedia`
- `mock`

含义：

- `amap`
  主候选点来自高德
- `llm-web-research`
  主候选点来自模型联网调研
- `hybrid-supplement`
  主候选点基础上又并入了补点结果
- `core-city-seeds`
  联网结果不可用或太薄，退回种子点
- `wikimedia`
  候选点来自在线公开旅行资料路径
- `mock`
  仅测试或调试使用

## 当前稳定性策略

为了降低模型联网结果的离谱程度，当前已经加入：

- 行政区、轨道交通、媒体机构、办公楼等伪 POI 过滤
- 目的地越界坐标修复与过滤
- 博物馆/美食街等明显错误类别纠偏
- `甲秀楼` / `甲秀楼夜景` 这类同源变体去重
- 城市种子点兴趣覆盖补齐

## 已验证情况

截至 `2026-04-10`：

- `deepseek-r1:8b`
  已在本机真实联机规划链路中验证通过
- `glm-4.7-flash:latest`
  在当前机器上因 Ollama 内存不足失败，不是代码逻辑错误

## 当前权衡

- 无高德时，通勤与营业时间仍然不是地图级精度
- 模型联网路径更灵活，但更依赖模型质量与机器资源
- 城市种子点仍是稳定性组件，不能替代实时数据
