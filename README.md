# AutoTrip

AutoTrip 是一个面向单管理员场景的本地自托管 AI 行程规划器。

当前版本的核心路线已经切换为：

1. 配置了 `AMAP_API_KEY` 时，优先走高德地图数据。
2. 没有高德时，交给兼容 OpenAI 的大模型自行联网搜索、抓取公开网页、整理候选点。
3. TypeScript 负责工具执行、结构校验、异常点过滤、候选点补齐、启发式排程与最终修复。

截至 `2026-04-10`，`deepseek-r1:8b` 已在本机真实联机验证通过。

## 功能概览

- 单管理员登录，首次登录自动初始化账号
- OpenAI 兼容接口配置，支持本地 Ollama
- 模型连通性测试与模型列表发现
- 大模型联网调研候选点
- 多日行程生成、保存、重新打开、删除
- 行程项拖拽重排、锁定、仅重排未锁定项目
- 候选点异常过滤、类别纠偏、同源变体去重
- Wikimedia 图片补全

## 当前规划链路

候选点来源顺序如下：

1. 高德地图，前提是已配置 `AMAP_API_KEY`
2. 配置好的大模型联网调研
3. 内置城市种子点兜底，用于补齐覆盖或稳定性

现在 TypeScript 不再在“无高德”时主动充当主搜索器；它主要负责执行工具、验证结果、修复明显错误并生成可编辑行程。

## 技术栈

- Next.js App Router
- React 18
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Zod
- dnd-kit
- Vitest
- Playwright

## 运行要求

- Node.js 22 或兼容的较新 LTS
- PostgreSQL
- 可选：Ollama
- 可选：Docker Desktop

## 快速开始

### 1. 安装依赖

```bash
npm install
```

Windows PowerShell：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

### 2. 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

至少需要配置：

- `DATABASE_URL`
- `APP_SECRET`
- `APP_ENCRYPTION_KEY`

建议使用 32 字节 Base64 密钥，例如：

```bash
openssl rand -base64 32
```

当前 `.env.example`：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/autotrip?schema=public"
APP_SECRET="replace-with-a-long-random-secret"
APP_ENCRYPTION_KEY="replace-with-32-byte-base64-key"
AMAP_API_KEY=""
NEXT_PUBLIC_APP_NAME="AutoTrip"
LLM_TEST_TIMEOUT_MS="20000"
LLM_PLANNING_TIMEOUT_MS="90000"
LLM_TEST_RETRIES="0"
LLM_PLANNING_RETRIES="1"
```

### 3. 启动 PostgreSQL

如果用 Docker：

```bash
docker compose up -d postgres
```

### 4. 初始化 Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

可选：初始化管理员账号

```powershell
$env:ADMIN_EMAIL='admin@autotrip.local'
$env:ADMIN_PASSWORD='autotrip123'
& 'C:\Program Files\nodejs\npm.cmd' run prisma:seed
```

如果不手动种子，首次成功登录时也会自动创建管理员。

### 5. 启动应用

```bash
npm run dev
```

Windows PowerShell：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

默认地址：

- `http://localhost:3000`
- `http://localhost:3000/login`

## Ollama 配置示例

启动 Ollama：

```bash
ollama serve
```

拉取模型：

```bash
ollama pull deepseek-r1:8b
```

应用里推荐配置：

- `Base URL`：`http://127.0.0.1:11434/v1`
- `API Key`：本地 Ollama 可留空
- `Model`：`deepseek-r1:8b`

说明：

- `deepseek-r1:8b` 已在本项目里完成真实联机校验。
- `glm-4.7-flash:latest` 在当前机器上曾因 Ollama 内存不足失败，不是代码逻辑错误。

## 常用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run verify
npm run test:e2e
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

真实联机校验脚本：

```powershell
$env:APP_ENCRYPTION_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { [byte]9 }))
$env:LIVE_CHECK_MODEL = 'deepseek-r1:8b'
$env:LIVE_CHECK_DESTINATION = '贵阳'
& 'C:\Program Files\nodejs\npx.cmd' tsx scripts/verify-live-web-research.ts
```

## 当前限制

- 目的地仍限于项目内置支持城市
- 没有高德时，通勤时间与营业时间精度弱于地图级数据
- 联网调研结果依赖模型质量、机器资源和公开网页质量
- 小模型更容易出现结构化输出不稳、候选点覆盖不足
- 城市种子点仍然是稳定性兜底，不代表实时信息

## 文档索引

- [协作约束](./AGENTS.md)
- [文档总览](./docs/DOCS_SUMMARY.md)
- [运行手册](./docs/RUNBOOK.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [项目状态](./docs/PROJECT_STATUS.md)
- [排障手册](./docs/TROUBLESHOOTING.md)
