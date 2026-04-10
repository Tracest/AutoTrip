# 运行手册

这份文档用于本地拉起、健康检查和真实联机校验。

## 运行要求

- Node.js
- PostgreSQL
- 可选：Ollama
- 可选：`AMAP_API_KEY`

## 标准启动流程

### 1. 安装依赖

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

### 2. 配置 `.env`

必须配置：

- `DATABASE_URL`
- `APP_SECRET`
- `APP_ENCRYPTION_KEY`

可选配置：

- `AMAP_API_KEY`
- `LLM_TEST_TIMEOUT_MS`
- `LLM_PLANNING_TIMEOUT_MS`
- `LLM_TEST_RETRIES`
- `LLM_PLANNING_RETRIES`

### 3. 启动 PostgreSQL

如果使用 Docker：

```bash
docker compose up -d postgres
```

### 4. 初始化 Prisma

```powershell
& 'C:\Program Files\nodejs\npx.cmd' prisma generate
& 'C:\Program Files\nodejs\npx.cmd' prisma migrate dev --name init
```

### 5. 启动 Ollama

```bash
ollama serve
```

拉取至少一个模型：

```bash
ollama pull deepseek-r1:8b
```

### 6. 启动应用

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

## 推荐模型配置

本机 Ollama 推荐先用：

- Base URL：`http://127.0.0.1:11434/v1`
- API Key：留空
- Model：`deepseek-r1:8b`

说明：

- `deepseek-r1:8b` 已在当前项目里验证通过。
- 更大的模型请先确认机器资源足够。

## 规划模式

### 配置了 `AMAP_API_KEY`

- 候选点与通勤矩阵来自高德
- 精度更高

### 没有 `AMAP_API_KEY`

- 由模型自行联网搜索与抓页
- TypeScript 负责校验、清洗、补齐与排程
- 必要时会并入城市种子点保证最低可用性

## 基础冒烟检查

启动后至少确认：

1. `/login` 能打开
2. 登录成功
3. 模型连通性测试成功
4. 发起一次规划请求
5. 历史行程中出现新记录
6. 工作区能保存编辑

建议请求：

- 目的地：`贵阳`
- 天数：`3`
- 人数：`2`
- 兴趣：`美食 / 夜景 / 自然`

## 真实联机校验

项目提供了联机校验脚本：

```powershell
$env:APP_ENCRYPTION_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { [byte]9 }))
$env:LIVE_CHECK_MODEL = 'deepseek-r1:8b'
$env:LIVE_CHECK_DESTINATION = '贵阳'
& 'C:\Program Files\nodejs\npx.cmd' tsx scripts/verify-live-web-research.ts
```

可选调试模式：

```powershell
$env:LIVE_CHECK_DEBUG = '1'
```

## 健康检查命令

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run typecheck
& 'C:\Program Files\nodejs\npm.cmd' run lint
& 'C:\Program Files\nodejs\npm.cmd' run test
& 'C:\Program Files\nodejs\npm.cmd' run verify
```

## 备注

- 在这个仓库里，PowerShell 下优先使用 `npm.cmd` 与 `npx.cmd`
- `AUTO_TRIP_FORCE_MOCK=1` 仅用于测试或调试
- 文档更新不需要额外跑测试，但功能变更必须做最小充分验证
