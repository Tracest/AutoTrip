# AutoTrip

AutoTrip 是一个单用户、自托管的 AI 出游路线工作台。

你可以在后台接入任意 `OpenAI 兼容` 的模型 `base URL / API key / model`，再结合地图/POI 数据生成可编辑的多日行程，并在网页里继续拖拽调整、锁定关键景点、保存和重新规划未锁定项目。

## V1 能力

- 单管理员账号登录，首次登录自动初始化管理员
- 服务端加密保存模型密钥，前端不会直接调用大模型
- OpenAI 兼容接口配置、保存与连接测试
- 基于地图/POI 抽象层的候选景点检索
- 规则预规划 + LLM 精修 + 校验修复的 4 段式规划流水线
- 无地图供应商时支持 LLM 候选点回退，并在界面中显示候选点来源
- 行程工作台支持拖拽排序、锁定项目、保存编辑、重排未锁定项目
- 历史行程支持打开与删除
- Prisma + Postgres 持久化存储
- Vitest 单元/集成测试与 Playwright e2e 样例

## 技术栈

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- dnd-kit
- Zod
- Vitest / Playwright

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

```bash
cp .env.example .env
```

建议把 `APP_SECRET` 和 `APP_ENCRYPTION_KEY` 换成你自己的随机值。

`APP_ENCRYPTION_KEY` 推荐使用 32 字节随机值的 base64，例如：

```bash
openssl rand -base64 32
```

3. 启动 PostgreSQL

如果你安装了 Docker：

```bash
docker compose up -d postgres
```

如果你不想装 Docker，也可以直接用本机 PostgreSQL，只要把 `DATABASE_URL` 指向本地实例即可。

4. 生成 Prisma Client 并迁移数据库

```bash
npx prisma generate
npx prisma migrate dev --name init
```

5. 启动开发环境

```bash
npm run dev
```

首次访问 `/login` 时，输入邮箱和密码即可自动创建管理员账号。

如果你修改了 `.env` 里的任何值，尤其是：

- `DATABASE_URL`
- `AMAP_API_KEY`
- `LLM_TEST_TIMEOUT_MS`
- `LLM_PLANNING_TIMEOUT_MS`
- `LLM_TEST_RETRIES`
- `LLM_PLANNING_RETRIES`

请重启开发服务后再测试。

## 环境变量

- `DATABASE_URL`: PostgreSQL 连接串
- `APP_SECRET`: 会话签名密钥
- `APP_ENCRYPTION_KEY`: 用于加密存储 LLM API key
- `AMAP_API_KEY`: 可选但强烈推荐，高德地图 key；不填时会先尝试 `LLM candidate fallback`，再回退到占位 mock 数据
- `NEXT_PUBLIC_APP_NAME`: 可选，应用展示名
- `LLM_TEST_TIMEOUT_MS`: 可选，模型连通性测试超时，默认 20000
- `LLM_PLANNING_TIMEOUT_MS`: 可选，正式规划的 LLM 超时，默认 90000
- `LLM_TEST_RETRIES`: 可选，模型连通性测试重试次数，默认 0
- `LLM_PLANNING_RETRIES`: 可选，正式规划的 LLM 重试次数，默认 1

## 模型配置说明

- `base URL` 建议填写供应商根路径或 `/v1` 路径，例如 `https://api.openai.com/v1`
- 也支持直接填写完整的 `/chat/completions` 地址
- 不要填写 `/responses` 路径；当前项目只按 `OpenAI-compatible chat/completions` 协议工作
- 如果上游供应商响应较慢，可以调大 `LLM_PLANNING_TIMEOUT_MS`
- API Key 已在服务端加密存储；后续保持输入框为空时会沿用已保存的密钥

## 当前工作台

当前首页工作流是：

1. 顶部右侧主按钮直接发起规划
2. 左侧填写核心需求；模型配置和“更多偏好”都支持折叠
3. 右侧查看历史行程、打开或删除旧记录
4. 在工作区里拖拽、锁定、保存编辑或重排未锁定项目
5. 问题提醒只显示当前工作区的实时结果，不再混入旧问题

## 主要 API

- `POST /api/auth/login`
- `GET /api/settings/llm`
- `PUT /api/settings/llm`
- `POST /api/settings/llm/test`
- `POST /api/trips/plan`
- `GET /api/trips/:id`
- `DELETE /api/trips/:id`
- `PATCH /api/trips/:id/items`
- `POST /api/trips/:id/replan`

## 测试

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Playwright e2e 样例：

```bash
npm run test:e2e
```

## 部署

仓库已包含：

- `Dockerfile`
- `docker-compose.yml`

默认部署形态是 `app + postgres` 的单体全栈结构，便于后续把规划引擎拆到独立 worker。

## 当前限制

- 没有 `AMAP_API_KEY` 时，POI、营业时间和通勤时间只能算“近似可信”，不是强保证
- 当前只支持 `OpenAI-compatible chat/completions`，不直接支持 `Responses API`
- 国际目的地仍然属于 beta 路径，系统会保留提示 warning
- LLM 输出使用“宽进严出”的补全过程，能提升兼容性，但真实地图数据仍然明显优于纯 LLM fallback

## 文档

- [架构说明](./docs/ARCHITECTURE.md)
- [排障说明](./docs/TROUBLESHOOTING.md)
