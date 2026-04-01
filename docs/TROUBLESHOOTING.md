# AutoTrip Troubleshooting

## `zsh: command not found: docker`

说明本机没有安装 Docker。

可选方案：

- 安装 Docker Desktop：

```bash
brew install --cask docker
open -a Docker
```

- 或直接使用本机 PostgreSQL，并把 `.env` 中的 `DATABASE_URL` 改到本地实例

## 点击“测试连接”失败

先检查这三项：

- `base URL` 是否是供应商根路径或 `/v1`
- `model` 是否是真实可用的模型名
- `API key` 是否有效

推荐格式：

- `https://api.openai.com/v1`
- `https://your-provider.example/v1`
- `https://your-provider.example/chat/completions`

不要填写：

- `.../responses`

## 规划时提示 `timed out after 20s` 或超时

当前版本已经区分：

- 连通性测试超时：`LLM_TEST_TIMEOUT_MS`
- 正式规划超时：`LLM_PLANNING_TIMEOUT_MS`

如果上游提供方很慢，可以在 `.env` 中调大：

```env
LLM_PLANNING_TIMEOUT_MS=180000
LLM_PLANNING_RETRIES=2
```

修改 `.env` 后必须重启 `npm run dev` 或 `npm run start`。

## 生成了 `长沙美食推荐点 12` 这种占位数据

这说明系统没有拿到真实地图 POI，也没能成功从 LLM fallback 中整理出可用候选点。

优先处理方式：

1. 配置 `AMAP_API_KEY`
2. 保持 LLM 开启
3. 重新生成行程

如果没有地图 key，当前版本仍然能工作，但结果质量会下降。

## 看到很多 schema validation 错误

这通常说明上游模型返回的 JSON 太松散，缺少：

- `id`
- `address`
- `latitude`
- `longitude`

当前版本已经对这些字段做了 relaxed parsing + 补全，但如果返回内容完全偏离结构，仍会 fallback 到 heuristic itinerary。

## 修改了 `.env` 但效果没变

最常见原因是服务没有重启。

请重新启动：

```bash
npm run dev
```

或者：

```bash
npm run build
npm run start
```

## 想确认当前结果是不是高质量地图数据

在主工作台里查看：

- `候选点来源`

可能的值：

- `高德地图`
- `LLM 候选点回退`
- `占位 Mock 数据`

其中：

- `高德地图` 最可信
- `LLM 候选点回退` 次之
- `占位 Mock 数据` 只适合调通流程，不适合真实出游
