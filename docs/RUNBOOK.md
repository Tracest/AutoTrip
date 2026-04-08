# AutoTrip 运行手册

这份文档面向“我要把项目跑起来并确认它现在是健康的”这个场景。

如果你刚接手项目，建议和 `README.md` 配合阅读。

## 一、启动前检查

先确认这几项：

- Node.js 已安装
- PostgreSQL 可用
- `.env` 已存在
- `DATABASE_URL`、`APP_SECRET`、`APP_ENCRYPTION_KEY` 已配置
- 如果要使用本地模型，Ollama 已安装

推荐的最小可用模式：

- PostgreSQL
- Ollama
- 无 `AMAP_API_KEY`
- Wikimedia 在线候选点

## 二、标准启动顺序

### 1. 启动数据库

如果你用 Docker：

```bash
docker compose up -d postgres
```

如果你用本机 PostgreSQL：

- 确认服务已启动
- 确认 `DATABASE_URL` 能连通

### 2. 初始化 Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 3. 启动 Ollama

```bash
ollama serve
```

如果提示 `11434` 端口已被占用，先不要急着重启，优先检查：

```powershell
curl.exe http://127.0.0.1:11434/api/tags
```

如果有返回，说明 Ollama 已经在运行。

### 4. 拉取模型

最小推荐：

```bash
ollama pull qwen2.5:3b
```

更稳一些：

```bash
ollama pull deepseek-r1:8b
```

### 5. 启动前端与后端

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

如果 `3000` 被占用：

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev -- --port 3001
```

## 三、首次登录与初始化

打开：

- `http://localhost:3000/login`
- 或你实际使用的新端口

首次登录规则：

- 如果当前数据库里没有管理员
- 第一次登录输入的邮箱和密码会直接创建管理员账号

推荐一个本地开发账号：

- 邮箱：`admin@autotrip.local`
- 密码：`autotrip123`

## 四、模型配置标准值

如果使用本地 Ollama：

- `Base URL`: `http://127.0.0.1:11434/v1`
- `API Key`: 留空即可
- `Model`: `qwen2.5:3b` 或 `deepseek-r1:8b`
- `Temperature`: `0.2 ~ 0.4`

推荐先做两步：

1. 点击“测试连接”
2. 点击“保存配置”

如果模型列表为空，优先检查：

- `http://127.0.0.1:11434/api/tags`

## 五、最小烟雾测试

建议每次启动后按这个顺序自检。

### 1. 页面可打开

确认：

- `/login` 能打开
- 登录成功后会跳到首页

### 2. 数据库正常

确认：

- 首页不再报 `Can't reach database server at localhost:5432`
- 历史行程区域可以正常加载

### 3. 模型可用

确认：

- 测试连接成功
- 模型配置保存成功
- 模型发现接口能列出本地模型

### 4. 规划可用

推荐测试请求：

- 目的地：`上海`
- 天数：`3`
- 人数：`2`
- 兴趣：`历史 / 美食 / 夜景`

期望现象：

- 可以开始规划
- 结果是中文
- 候选点来源应显示为：
  - `高德地图`
  - 或 `联网检索（Wikimedia）`

不应出现：

- 示例地址
- `POI 1` / `示例点`
- 英文片区词充满整个行程

## 六、如何判断当前结果是否“正常”

### 正常结果的典型特征

- 候选点来源明确
- 结果是中文优先
- 能继续拖拽、锁定、保存
- 工作区里不是 mock 示例数据
- 即使模型细化失败，也仍保留一份可编辑规则行程

### 仍需人工留意的地方

- 开放时间
- 闭馆日
- 景点远近
- 是否过于冷门

如果没有 `AMAP_API_KEY`，这些本来就需要你做最后确认。

## 七、日常操作手册

### 保存编辑

适用场景：

- 你拖拽调整了顺序
- 你锁定了关键项目

操作：

- 点击“保存编辑”

### 重排未锁定项目

适用场景：

- 有些项目已经满意
- 只想让系统重排剩余部分

操作：

- 先锁定不想动的项目
- 点击“重排未锁定项目”

### 删除旧行程

适用场景：

- 你看到的是早期版本遗留的示例数据
- 想重新生成一条新纪录

操作：

- 在历史行程列表中删除旧记录
- 再重新规划

## 八、当前推荐运行模式

### 轻量本地模式

- PostgreSQL
- Ollama
- `qwen2.5:3b`
- 无 `AMAP_API_KEY`

适合：

- 开发
- 体验流程
- 验证功能是否跑通

### 更稳的本地模式

- PostgreSQL
- Ollama
- `deepseek-r1:8b`
- 无 `AMAP_API_KEY`

适合：

- 更关注中文可用性
- 更希望结构化输出稳定一些

### 更高精度模式

- PostgreSQL
- Ollama 或远程模型
- 配置 `AMAP_API_KEY`

适合：

- 更关注真实 POI、通勤和置信度

## 九、健康检查清单

如果你要快速判断项目今天是否健康，可以看这 6 项：

1. PostgreSQL 可连
2. Next.js 服务能打开首页
3. 登录可用
4. Ollama `/api/tags` 可用
5. 模型测试连接成功
6. 新规划结果不是示例数据

满足这 6 项，项目基本就处于可用状态。

## 十、当前最常见的故障入口

如果某一步失败，优先查这里：

- `npm` / PowerShell 问题：看 `docs/TROUBLESHOOTING.md`
- PostgreSQL 连接问题：看 `docs/TROUBLESHOOTING.md`
- Ollama 端口 / 模型发现问题：看 `docs/TROUBLESHOOTING.md`
- 规划结果异常：先删旧行程，再重新规划，再看 `docs/TROUBLESHOOTING.md`

## 十一、交接建议

如果你要把项目交给别人继续维护，建议对方按这个顺序接手：

1. 读 `README.md`
2. 按本手册跑一次完整启动
3. 看 `docs/PROJECT_STATUS.md`
4. 再读 `docs/ARCHITECTURE.md`
