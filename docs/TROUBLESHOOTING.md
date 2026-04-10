# 排障手册

## 应用无法启动

### PowerShell 拦截了 `npm.ps1`

请改用：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

### 数据库连接失败

检查：

- PostgreSQL 是否已启动
- `DATABASE_URL` 是否正确
- Prisma 迁移是否已执行

常用命令：

```powershell
& 'C:\Program Files\nodejs\npx.cmd' prisma generate
& 'C:\Program Files\nodejs\npx.cmd' prisma migrate dev --name init
```

## 模型连接失败

### Ollama 不可达

先检查：

```powershell
curl.exe http://127.0.0.1:11434/api/tags
```

如果失败：

- 启动 `ollama serve`
- 检查端口是否被占用或拦截

### 模型没拉下来

例如：

```bash
ollama pull deepseek-r1:8b
```

### 模型本身资源不够

如果 Ollama 返回类似：

- `model requires more system memory`

说明是本机资源不足，不是项目业务代码异常。

截至 `2026-04-10`，`glm-4.7-flash:latest` 在当前机器上就出现过这类问题。

## 规划失败

### 没有找到可用候选点

常见原因：

- 模型结构化输出能力不足
- 机器资源不够，模型实际没跑起来
- 目的地或兴趣组合过于苛刻
- 公开网页覆盖较弱

建议：

- 换成已验证模型，如 `deepseek-r1:8b`
- 减少兴趣数量
- 配置 `AMAP_API_KEY`
- 跑一次真实联机校验脚本

### 规划能跑，但结果质量差

常见原因：

- 模型选了较差的网页来源
- 页面内容含糊
- 公开来源对该城市覆盖有限

建议：

- 重新规划一次
- 更换更稳定的模型
- 手动确认必去点
- 对高精度需求配置 `AMAP_API_KEY`

## 候选点明显离谱

当前系统已经会处理：

- 行政区、线路、媒体机构等伪 POI
- 博物馆误标成美食等明显错类
- `甲秀楼` / `甲秀楼夜景` 这类同源变体

如果仍然出现离谱候选点，通常说明：

- 模型引用了很差的网页
- 当前城市在线公开资料过少
- 候选点虽然名字像景点，但本质仍是泛化词

建议：

- 重新规划
- 更换模型
- 配置高德
- 检查输出里的 `candidateSource` 与问题提醒

## 结果看起来不准

没有高德时：

- 通勤时间是启发式估算
- 营业时间可能漂移
- 候选点质量依赖公开网页与模型判断

如果需要更高精度：

- 配置 `AMAP_API_KEY`
- 手动抽查关键 POI 名称、地址和营业时间

## 看到旧的错误行程

如果你看到的是历史里以前生成的旧行程：

- 可以直接删除旧记录
- 再重新生成新行程

旧行程不会自动回溯套用新逻辑。

## 调试命令

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run typecheck
& 'C:\Program Files\nodejs\npm.cmd' run lint
& 'C:\Program Files\nodejs\npm.cmd' run test
& 'C:\Program Files\nodejs\npm.cmd' run verify
```

真实联机调试：

```powershell
$env:APP_ENCRYPTION_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { [byte]9 }))
$env:LIVE_CHECK_MODEL = 'deepseek-r1:8b'
$env:LIVE_CHECK_DESTINATION = '贵阳'
$env:LIVE_CHECK_DEBUG = '1'
& 'C:\Program Files\nodejs\npx.cmd' tsx scripts/verify-live-web-research.ts
```
