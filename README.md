# AutoTrip

AutoTrip 是一个单用户、自托管的 AI 行程规划工作台。

它的目标不是“生成一份看起来像行程的示例”，而是在本地优先、可选联网的前提下，产出一份可以继续编辑、锁定、重排和保存的真实行程草案。

当前版本的默认路线是：

1. 优先推荐本地 Ollama 作为模型服务。
2. `AMAP_API_KEY` 变为可选增强项，不再是最低可用门槛。
3. 没有地图 Key 时，默认从 Wikimedia 在线资料收集真实候选点。
4. 规划失败时优先诚实报错，不再静默回退到误导性的示例 POI。

## 当前能力

- 单管理员账号登录，首次登录自动创建管理员账号
- 保存 OpenAI-compatible 模型配置
- 支持本地 Ollama，且本地 Ollama 可以不填真实 API key
- 从高德地图或 Wikimedia 收集候选 POI
- 规则排程生成可落地的多日行程
- 可选把规则行程交给模型做结构化细化
- 行程工作区支持拖拽、锁定、保存编辑、重排未锁定项目
- 历史行程查看、打开、删除
- Prisma + PostgreSQL 持久化
- Vitest 单测 / 集成测试

## 这版最重要的行为变化

- 不配置 `AMAP_API_KEY` 也能规划。
- 没有地图 Key 时，默认候选点来源是 Wikimedia 在线公开资料，不再是 mock 示例数据。
- Wikimedia 候选点会做更严格的清洗和排序，尽量优先经典、像真实景点的地点，压低片区、道路、泛概念词。
- 规则排程已经改成“看时间段排内容”，而不是简单均分：
  - 中段更偏美食
  - 收尾更偏夜景
- 如果已经拿到了可执行的在线候选点，本地 Ollama 结构化细化失败时，不会再默认用很吵的 warning 把用户体验拉坏。

## 技术栈

- Next.js App Router
- React 18 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Zod
- dnd-kit
- Vitest / Playwright

## 快速开始

### 1. 准备依赖

推荐环境：

- Node.js 22+
- PostgreSQL 14+
- 可选：Ollama
- 可选：Docker Desktop

安装依赖：

```bash
npm install
```

如果你在 Windows PowerShell 里遇到 `npm.ps1` 被策略拦截，直接改用：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

### 2. 准备环境变量

复制示例文件：

```bash
cp .env.example .env
```

默认示例值如下：

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

至少需要正确配置：

- `DATABASE_URL`
- `APP_SECRET`
- `APP_ENCRYPTION_KEY`

生成一个 32 字节 base64 密钥的例子：

```bash
openssl rand -base64 32
```

### 3. 启动 PostgreSQL

如果你使用 Docker：

```bash
docker compose up -d postgres
```

如果你使用本机 PostgreSQL：

- 先确认服务已经启动
- 再让 `DATABASE_URL` 指向正确实例

### 4. 初始化数据库

```bash
npx prisma generate
npx prisma migrate dev --name init
```

可选：如果你想预先创建管理员账号，可以设置环境变量后执行：

```bash
$env:ADMIN_EMAIL='admin@autotrip.local'
$env:ADMIN_PASSWORD='autotrip123'
& 'C:\Program Files\nodejs\npm.cmd' run prisma:seed
```

不想手动 seed 也没关系。项目在第一次登录时会自动创建第一个管理员账号。

### 5. 启动开发服务

```bash
npm run dev
```

Windows PowerShell 推荐：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

如果 `3000` 已被占用：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev -- --port 3001
```

### 6. 登录

打开：

- `http://localhost:3000/login`
- 或你指定的新端口，例如 `http://localhost:3001/login`

登录规则：

- 如果库里还没有管理员，第一次登录会自动创建该邮箱/密码
- 之后再登录时必须输入同一账号的正确密码

## 本地 Ollama 配置

AutoTrip 当前默认最推荐的使用方式是：

1. 用本地 Ollama 提供模型
2. 不配置 `AMAP_API_KEY`
3. 让系统先用 Wikimedia 联网收集候选点
4. 再让本地模型做结构化细化

启动 Ollama：

```bash
ollama serve
```

拉取一个轻量模型：

```bash
ollama pull qwen2.5:3b
```

拉取一个效果通常更好的模型：

```bash
ollama pull deepseek-r1:8b
```

在前端模型配置里填写：

- `Base URL`: `http://127.0.0.1:11434/v1`
- `API Key`: 可留空
- `Model`: 例如 `qwen2.5:3b` 或 `deepseek-r1:8b`
- `Temperature`: `0` 到 `2` 之间，默认建议 `0.2 ~ 0.4`

建议：

- 想先把流程跑通：`qwen2.5:3b`
- 想要更稳一些的结构化输出：`deepseek-r1:8b`

如果 `ollama serve` 提示 `11434` 端口已被占用，通常代表 Ollama 已经在后台运行，这时直接继续使用即可，不需要再重复启动。

## 如何使用项目

### 1. 配置模型

在首页工作台中：

1. 填入 `Base URL`
2. 选择或输入 `Model`
3. 点击“测试连接”
4. 点击“保存配置”

说明：

- 本项目只支持 OpenAI-compatible `chat/completions`
- 不要填 `/responses`
- 本地 Ollama 支持模型发现接口，会自动尝试读取本地模型列表
- `temperature` 的合法范围是 `0` 到 `2`

### 2. 创建行程

填写这些字段后点击“开始规划”：

- 目的地
- 出发日期
- 天数
- 人数
- 兴趣标签
- 节奏
- 预算
- 可选：酒店区域、必去点、补充要求

### 3. 查看结果

工作区会展示：

- 行程日期和标题
- 每个项目的开始/结束时间
- 分类
- 预计停留时间
- 通勤时间
- 提醒和问题说明
- 候选点数量和来源

### 4. 编辑结果

你可以：

- 拖拽项目顺序
- 锁定关键项目
- 保存编辑
- 重排未锁定项目
- 打开历史行程继续修改

## 数据来源策略

当前候选点构建优先级如下：

1. 如果存在 `AMAP_API_KEY`，优先使用高德地图
2. 如果没有高德 Key，默认使用 Wikimedia 在线公开资料
3. 如果启用了模型，模型只负责在这些候选点之上做细化，不再凭空编造示例景点
4. 如果系统拿不到足够可信的候选点，会直接报错

重要结论：

- 现在不会再保存“看起来成功、其实是示例数据”的行程
- `AMAP_API_KEY` 仍然是更高质量路线，但已经不是最低可用门槛
- 不接第三方地图 Key 的情况下，系统仍然依赖公共互联网访问 Wikimedia

## 候选点来源说明

工作区中你会看到候选点来源：

- `amap`
  表示高德地图
- `wikimedia`
  表示联网检索的 Wikimedia 公开资料
- `llm-fallback`
  只在测试或特定回退场景里出现，表示候选点来自模型
- `mock`
  仅测试或显式强制 mock 时使用，不应该是正常生产使用路径

## 环境变量

- `DATABASE_URL`
  PostgreSQL 连接串
- `APP_SECRET`
  登录会话签名密钥
- `APP_ENCRYPTION_KEY`
  服务端加密保存模型 API key 的密钥
- `AMAP_API_KEY`
  可选，高德地图 Key
- `NEXT_PUBLIC_APP_NAME`
  前端显示名称
- `LLM_TEST_TIMEOUT_MS`
  测试连接超时，默认 `20000`
- `LLM_PLANNING_TIMEOUT_MS`
  规划调用超时，默认 `90000`
- `LLM_TEST_RETRIES`
  测试连接重试次数，默认 `0`
- `LLM_PLANNING_RETRIES`
  规划重试次数，默认 `1`
- `ADMIN_EMAIL`
  仅在执行 seed 时可选使用
- `ADMIN_PASSWORD`
  仅在执行 seed 时可选使用
- `AUTO_TRIP_FORCE_MOCK`
  仅用于测试或开发强制 mock，不建议正常运行时开启

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Windows PowerShell 下推荐统一使用：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

## 当前限制

- 没有 `AMAP_API_KEY` 时，候选点来自在线公开资料，通常可用，但营业时间、精确通勤、票务信息仍建议出发前再核对
- 国际目的地仍是 beta 路径
- 本地小模型的结构化输出质量波动较大
- Wikimedia 候选点已经明显优于示例数据，但还达不到专业地图服务的稳定度
- 如果外网无法访问 Wikimedia，又没有高德地图 Key，规划会失败

## 文档索引

- [文档总览](./docs/DOCS_SUMMARY.md)
- [运行手册](./docs/RUNBOOK.md)
- [架构说明](./docs/ARCHITECTURE.md)
- [排障说明](./docs/TROUBLESHOOTING.md)
- [项目状态](./docs/PROJECT_STATUS.md)
