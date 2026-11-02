# Drawly

Drawly 是一个基于 tldraw SDK 的本地多人协作画板项目。

## 项目结构

```text
drawly/
├── apps/
│   ├── web/                 # React + Vite 前端
│   │   └── src/
│   │       ├── app/         # 应用入口与全局状态
│   │       ├── components/  # 通用组件
│   │       ├── features/    # auth、account、board、workspace
│   │       ├── lib/         # API、房间等基础设施
│   │       └── styles/      # 全局样式
│   └── server/              # Fastify + tldraw sync 后端
│       └── src/
│           ├── config/      # 环境配置
│           ├── db/          # 应用数据库
│           └── modules/     # auth、assets、sync、unfurl
├── packages/
│   └── shared/              # 前后端共享类型
├── doc/                     # 产品和技术文档
└── .data/                   # 本地运行数据
```

## 已接入

- tldraw 完整画板、默认图形、工具和 UI
- `@tldraw/sync` 浏览器多人同步客户端
- `@tldraw/sync-core` Node.js 同步服务器
- SQLite 房间持久化
- 本地图片和附件存储
- tldraw 评论、@提及和协作授权扩展包（待业务接入）
- 本地账号注册、登录、退出和个人资料
- Argon2id 密码哈希与服务端持久化 Session

## 开发

```bash
npm install
npm run dev
```

- 前端：http://localhost:5757
- 同步/API：http://localhost:5858
- 健康检查：http://localhost:5858/health

默认进入 `welcome` 画板。可通过查询参数切换房间：

```text
http://localhost:5757/?room=team-one
```

在两个浏览器窗口中打开同一房间即可测试多人协作。

## 容器运行

需要 Docker（也可通过 `CONTAINER_ENGINE=podman` 使用 Podman）：

```bash
make build     # 编译 drawly:latest 单体镜像
make start     # 使用已有镜像启动服务
make status    # 查看容器状态
make logs      # 持续查看日志
make restart   # 快速重启现有容器
make stop      # 停止服务，保留数据
```

容器同时提供前端页面、API 和 WebSocket，只暴露一个端口。默认访问地址为
http://localhost:8888，健康检查为 http://localhost:8888/health。
端口或外部访问地址可在命令行覆盖：

```bash
make start \
  APP_ENV=production \
  PORT=8080 \
  ORIGINS=https://draw.example.com
```

应用数据保存在 `drawly-data` 容器卷中；`make clean` 会保留该卷，
`make prune` 会连同数据卷一起删除。

## 本地数据

运行后数据保存在：

```text
.data/
├── app.db     # 用户和 Session
├── rooms/     # 每个画板的 SQLite 数据库
└── assets/    # 图片和附件
```
