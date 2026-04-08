# AutoTrip 排障说明

这份文档按“你最容易碰到的问题”组织，优先给出最短修复路径。

## 1. `npm` 无法识别，或 `npm.ps1` 被系统拦截

你可能会看到：

- `npm : 无法将“npm”项识别为 cmdlet...`
- `npm.ps1 ... 在此系统上禁止运行脚本`

最短解决方案：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

如果想从根上解决当前用户的 PowerShell 限制：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

然后重开终端。

## 2. `ollama serve` 提示 11434 端口已被占用

常见报错：

```text
Error: listen tcp 127.0.0.1:11434: bind: Only one usage of each socket address...
```

这通常不是坏事，而是说明：

- Ollama 已经在后台运行
- 或其它进程占用了同一个端口

优先检查：

```powershell
curl.exe http://127.0.0.1:11434/api/tags
```

如果能返回模型列表，说明 Ollama 已经可用，不需要再次执行 `ollama serve`。

## 3. 登录页或首页报数据库连接错误

常见报错：

```text
Can't reach database server at `localhost:5432`
```

说明 PostgreSQL 没有运行，或者 `DATABASE_URL` 不对。

检查顺序：

1. 确认 PostgreSQL 服务已经启动
2. 确认 `.env` 中的 `DATABASE_URL` 指向正确实例
3. 确认数据库名、用户名、密码正确
4. 执行 Prisma 初始化命令

常用命令：

```bash
npx prisma generate
npx prisma migrate dev --name init
```

如果使用 Docker：

```bash
docker compose up -d postgres
```

## 4. 打开 `http://localhost:3001/login` 后显示 `Unable to sign in.`

这个报错本身比较泛，它的真实原因通常在后端日志里。

最常见的两类原因：

- 数据库不可达
- 账号密码不对

额外说明：

- 如果数据库里还没有管理员，第一次登录会自动创建该账号
- 如果数据库里已经有管理员，再用别的密码登录会失败

如果你不确定当前库里有没有管理员，可以：

1. 换一个空库重新初始化
2. 或用 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 执行一次 seed

## 5. 模型配置保存时报 `temperature` 太大

典型报错：

```json
[
  {
    "code": "too_big",
    "maximum": 2,
    "message": "Number must be less than or equal to 2",
    "path": ["temperature"]
  }
]
```

原因很直接：

- 当前后端 schema 要求 `temperature` 必须在 `0 ~ 2` 之间

建议值：

- 本地小模型：`0.2 ~ 0.4`
- 想更稳地输出结构化 JSON：优先用较低值
- 不建议随便拉到 `1.5+`

## 6. `Temperature` 到底是什么意思

简化理解：

- 越低，越保守，越稳定，越适合结构化 JSON
- 越高，越发散，越容易“自由发挥”

在 AutoTrip 里：

- 候选点和行程细化都更偏结构化任务
- 所以温度通常不需要太高

推荐：

- 本地 Ollama：`0.2 ~ 0.4`
- 远程更强模型：先从 `0.3` 开始

## 7. 为什么开发时看到 “Compiling / ... in 5s”

这通常是正常现象。

你看到的这类日志：

```text
✓ Ready in 1953ms
○ Compiling / ...
✓ Compiled / in 5s (718 modules)
```

代表：

- Next.js 首次访问页面时会按需编译
- 首屏第一次进来通常最慢
- 后续同一路由会快很多

什么时候才算异常：

- 每次刷新都要几十秒甚至几分钟
- 模型请求已经结束，但页面长期无响应

如果只是 `2 ~ 6s` 级别，通常是可接受的开发态编译时间。

## 8. 测试连接失败

先检查这几项：

- `Base URL` 是否正确
- `Model` 是否真实存在
- `API key` 是否可用
- 远程 provider 是否真的兼容 OpenAI `chat/completions`

推荐格式：

- `https://api.openai.com/v1`
- `https://your-provider.example/v1`
- `http://127.0.0.1:11434/v1`

不要填：

- `.../responses`

对于本地 Ollama：

- `Base URL` 用 `http://127.0.0.1:11434/v1`
- `API key` 可以留空
- 模型必须先 `ollama pull`

例如：

```bash
ollama pull qwen2.5:3b
ollama pull deepseek-r1:8b
```

## 9. 模型列表为空

如果模型发现按钮没有返回任何模型：

1. 确认 Ollama 正在运行
2. 打开 `http://127.0.0.1:11434/api/tags`
3. 确认本地真的有模型
4. 重新打开模型设置面板再试一次

如果 `/api/tags` 本身都打不开，问题不在 AutoTrip，而在 Ollama 环境。

## 10. 规划时报 “No map provider is configured ...”

如果你还看到类似这类提示，通常说明以下至少有一项不成立：

- 没有 `AMAP_API_KEY`
- 机器无法访问 Wikimedia
- 系统没有拿到足够可信的在线候选点

现在的默认逻辑已经不是“没有高德就用假数据”，而是：

1. 有高德：优先高德
2. 没高德：优先 Wikimedia 在线资料
3. 再让模型在已有候选点上做细化
4. 候选点不够可靠就直接失败

排查顺序：

1. 先确认当前机器能访问公开互联网
2. 再确认模型配置已保存并启用
3. 再看是否确实需要更高质量的地图级 POI

如果你只是想“先能用”，不一定需要 `AMAP_API_KEY`。
如果你要更稳的通勤和营业时间，还是建议补高德。

## 11. 工作区里还是英文 POI、片区词或明显奇怪的地点

先区分两种情况。

### 情况 A：你打开的是旧历史记录

如果这条记录是早期版本生成的，它可能包含：

- 英文片区
- 示例地址
- mock 候选点

解决方法：

1. 删除旧 trip
2. 重新规划同一目的地

### 情况 B：这是新规划结果

说明当前联网候选点仍然有边界。

现在的规则已经会尽量压低：

- 道路
- 片区
- 泛概念
- 普通楼宇

但没有高德时，数据源毕竟还是公开资料，不可能完全等同于专业地图。

## 12. 规划后看到 “LLM returned an empty response”

这通常表示模型没有完成结构化输出，常见原因：

- 模型太小
- 模型本身不擅长稳定 JSON
- 模型内部超时
- 上游接口虽然通了，但实际响应为空

建议顺序：

1. 先换更稳的模型，例如 `deepseek-r1:8b`
2. 把 `temperature` 降低
3. 重新测试连接
4. 必要时增大 `.env` 里的超时

示例：

```env
LLM_PLANNING_TIMEOUT_MS=180000
LLM_PLANNING_RETRIES=2
```

说明：

- 当前版本已经会优先保留可执行的规则行程
- 尤其在候选点来自 Wikimedia 且本地 Ollama 只是“细化没补全”时，不会再默认给用户一个很吵的失败提醒

## 13. 没有配置高德，为什么还是能规划

这是当前版本的设计目标之一，不是异常。

默认顺序是：

1. 高德地图
2. Wikimedia 在线资料
3. 模型细化

所以：

- 不配置 `AMAP_API_KEY` 依然可以规划
- 但精度和稳定性通常低于高德

## 14. 为什么结果不如我预期那么“专业”

当前版本已经解决了这些问题：

- 不再用假示例 POI 冒充真实结果
- 默认有联网候选点来源
- 规则排程比早期版本更像真实出游节奏

但它仍然不是地图服务或人工旅行编辑：

- 开放时间未必完整
- 景点热度判断仍偏启发式
- 同城“最经典路线”没有完整人工策展层

如果你追求更高稳定度：

- 配置 `AMAP_API_KEY`
- 使用更强模型
- 在生成后手动微调工作区

## 15. `.env` 改了但没生效

最常见原因是：

- 你改完 `.env` 没有重启 Next.js 开发服务

重启：

```bash
npm run dev
```

Windows PowerShell：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

## 16. 端口被占用

如果 `3000` 或 `3001` 被占用，可以手动换端口：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev -- --port 3005
```

然后使用终端里显示的新地址。

## 17. 如何判断当前结果来自哪条数据路径

看工作区中的候选点来源：

- `高德地图`
  最高置信度
- `联网检索（Wikimedia）`
  当前默认无 Key 路线
- `本地模型候选点 + 规则排程`
  更少见，通常只在特定回退或测试路径出现
- `占位 Mock 数据`
  仅测试 / 强制 mock 时出现，正常使用不应依赖

## 18. 推荐的最小可用运行方式

如果你只是想尽快跑起来，最短路径是：

1. 启动 PostgreSQL
2. 跑 Prisma migration
3. 启动 Ollama
4. 拉一个本地模型
5. 启动 Next.js
6. 登录
7. 配置 `http://127.0.0.1:11434/v1`
8. 不填 `AMAP_API_KEY` 先直接规划

这就是 AutoTrip 当前默认最推荐的本地优先路径。
