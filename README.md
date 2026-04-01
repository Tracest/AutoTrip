# AutoTrip

AutoTrip 是一个单用户、自托管的 AI 出游路线工作台。

你可以在后台接入任意 `OpenAI 兼容` 的模型 `base URL / API key / model`，再结合地图/POI 数据生成可编辑的多日行程，并在网页里继续拖拽调整、锁定关键景点、保存和重新规划未锁定项目。

## V1 能力

- 单管理员账号登录，首次登录自动初始化管理员
- 服务端加密保存模型密钥，前端不会直接调用大模型
- OpenAI 兼容接口配置、保存与连接测试
- 基于地图/POI 抽象层的候选景点检索
- 规则预规划 + LLM 精修 + 校验修复的 4 段式规划流水线
- 行程工作台支持拖拽排序、锁定项目、保存编辑、重排未锁定项目
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

```bash
docker compose up -d postgres
```

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

## 环境变量

- `DATABASE_URL`: PostgreSQL 连接串
- `APP_SECRET`: 会话签名密钥
- `APP_ENCRYPTION_KEY`: 用于加密存储 LLM API key
- `AMAP_API_KEY`: 可选，高德地图 key；不填时自动使用 mock geo provider
- `NEXT_PUBLIC_APP_NAME`: 可选，应用展示名

## 主要 API

- `POST /api/auth/login`
- `GET /api/settings/llm`
- `PUT /api/settings/llm`
- `POST /api/settings/llm/test`
- `POST /api/trips/plan`
- `GET /api/trips/:id`
- `PATCH /api/trips/:id/items`
- `POST /api/trips/:id/replan`

## 测试

```bash
npm run typecheck
npm test
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
