# mneme_frontend

Mneme 的 Vue 3 前端工作台，围绕当前后端已确认的稳定能力构建：

- 认证登录 / 注册
- 知识库切换与创建
- 文档上传、索引状态与手动触发索引
- 基于知识库的 RAG 问答
- 记忆库结构化视图
- 画像与成长分析面板

## 技术栈

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia
- 原生 `fetch` API

## 目录结构

```text
src/
├─ assets/styles/       # 全局样式与设计 token
├─ components/          # 工作台组件
├─ composables/         # 主题与 reduced-motion
├─ lib/                 # API 层与类型
├─ mocks/               # Mock 数据与演示 API
├─ router/              # 路由
├─ stores/              # 会话与工作台状态
└─ views/               # 页面级视图
```

## 运行方式

```bash
npm install
npm run dev
```

默认会读取 `.env` 或 `.env.example` 中的以下配置：

```env
VITE_API_BASE_URL=/api
VITE_API_PREFIX=
VITE_USE_MOCKS=true
```

本地开发时 Vite 会把 `/api` 代理到 `http://127.0.0.1:8000`，因此不需要额外处理浏览器 CORS。

## 域名部署说明

生产环境推荐让浏览器只访问前端域名，再由 Nginx 把 `/api` 反向代理到后端，例如：

```nginx
location /api/ {
  rewrite ^/api/?(.*)$ /$1 break;
  proxy_pass http://124.223.14.145:8000;
  proxy_http_version 1.1;
  proxy_set_header Host $proxy_host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

如果你继续让前端直连后端公网 IP，例如 `VITE_API_BASE_URL=http://124.223.14.145:8000`，那么后端 `.env` 必须把前端页面的实际来源都加入 `CORS_ALLOWED_ORIGINS`：

```env
CORS_ALLOWED_ORIGINS=["http://你的域名","https://你的域名","http://前端服务器IP"]
```

用 IP 访问能登录、用域名访问登录时报后端 `400 Bad Request`，通常就是域名来源没有进入后端 CORS 白名单，浏览器发起的 `OPTIONS` 预检被 FastAPI CORS 中间件拒绝。

## 后端接入说明

当前项目默认开启 Mock 回退，原因是后端工作树里存在部分缺位文件，无法仅凭源码 100% 还原所有响应 schema。前端因此做了两层保护：

1. `VITE_USE_MOCKS=true` 时直接使用本地演示数据
2. `VITE_USE_MOCKS=false` 时优先调用真实接口，失败后自动回退 Mock

另外还增加了两层协议兼容：

1. 自动尝试无前缀路径和 `/api/v1` 路径
2. 自动兼容 `data/items/records/knowledge_bases/documents/profile/growth` 等常见包裹结构

切到真实后端时建议：

1. 先确认后端允许前端域名的 CORS
2. 按实际接口 schema 调整 `src/lib/api.ts`
3. 如果上传接口字段名不同，优先调整 `uploadDocuments`

## 设计取向

这个前端没有做成通用 SaaS 模板，而是围绕 Mneme 的“个人记忆型 RAG”定位设计：

- 视觉上强调 archive / workspace / memory atlas
- 信息架构上强调“上下文切换”和“证据可追溯”
- 动效上保留微交互，但遵守 `prefers-reduced-motion`
- 响应式覆盖桌面与移动端，不依赖 hover 才能完成核心操作
