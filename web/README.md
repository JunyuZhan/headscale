# Headscale Web 管理界面（内嵌 SPA + 独立 Web 后端）

一套面向 **Headscale 的管理 + 自助服务**界面，分两部分：

1. **内嵌 SPA**（`/ui`）：React + TypeScript + TailwindCSS，编译进 `headscale` 二进制，由 headscale 自身托管。
2. **独立 Web 后端**（`hscontrol/webbackend`，单独二进制 `webbackend`）：持有 Headscale API Key、自建用户表与登录会话、**服务端代理**所有 Headscale 操作，并暴露自助服务功能。

> 为什么拆成两个进程？因为 Headscale 的数据库使用严格的迁移摘要校验，无法直接塞入 Web 用户表；且把 API Key 留在后端（而不是浏览器）正是原始需求"Key 不暴露在前端、后端做代理"的实现方式。

## 关键安全改进（相对旧版）

- 浏览器**永不见 Headscale API Key**：Key 只在 Web 后端的环境变量里，前端只持有一个 HttpOnly 会话 Cookie。
- 登录方式是**账号密码**（Web 后端自建用户表），不再是"粘贴 API Key"。
- 角色隔离：管理员（`admin`）可见/管理全部；普通用户（`user`）被代理层限制在**自己映射的 Headscale 用户**内（只看自己的设备、只能给自己生成密钥、不能碰用户/ACL 管理）。

## 功能

- **登录**：账号密码（首次部署用 `WEBUI_BOOTSTRAP_ADMIN` 创建管理员）。
- **概览**：节点 / 用户 / 密钥数量。
- **节点**：列表、改名、打标签、过期、删除（普通用户只看自己的）。
- **我的设备（自助服务）**：查看自己已加入的设备；一键生成 **Pre-Auth Key + 接入命令**，复制后在设备安装 Tailscale 客户端运行即可自动入网。
- **用户管理（仅管理员）**：创建/删除 Headscale 用户。
- **预授权密钥（仅管理员）**：创建/列表/过期/删除。
- **ACL 策略（仅管理员）**：解析 HuJSON 可视化展示 groups/hosts/tagOwners/ACL 规则，支持快速添加规则、校验、保存（需 `policy.mode: database`）。

## 架构

```
浏览器 ── 同一域名(HTTPS，由 Caddy 终结 TLS) ─┬─ /ui/*        → headscale(静态 SPA + /api)
                                              └─ /ui/api/*    → webbackend(会话鉴权 + 代理 Headscale)
                                                    │ 持有 HEADSCALE_API_KEY
                                                    └─► headscale /api/v1
```

- 前端源代码：`web/`（Vite 工程）。
- 前端构建产物：`hscontrol/webui/dist`（被 `//go:embed` 编入 headscale）。
- Web 后端：`hscontrol/webbackend/`（包）+ `cmd/webbackend/main.go`（入口）。
- 部署编排：`deploy/`（Dockerfile / docker-compose.yml / Caddyfile / 配置模板）。

## 构建

单二进制（headscale，含 SPA）：

```shell
make web && go build -o headscale ./cmd/headscale
```

Web 后端（单独二进制）：

```shell
go build -o webbackend ./cmd/webbackend
```

或一次性 Docker 镜像（同时产出两个二进制）：见 `deploy/`。

## 本地启动（拆分进程，便于调试）

```shell
# 1) 启动 headscale（监听 8080）
./headscale serve -c config.yaml

# 2) 启动 web 后端（另开终端）
HEADSCALE_URL=http://127.0.0.1:8080 \
HEADSCALE_API_KEY=$(./headscale apikeys create -c config.yaml) \
WEBUI_LISTEN=:8090 WEBUI_DB=./webui.db WEBUI_COOKIE_SECURE=false \
WEBUI_BOOTSTRAP_ADMIN=admin:admin123 \
./webbackend

# 3) 本地用 Caddy / Nginx 把 /ui 和 /ui/api 反代到上面两个服务（同源）
```

> 浏览器必须通过**同一个域名**访问 `/ui` 和 `/ui/api`（否则会话 Cookie 与跨域会失败）。开发态可用 `web/vite.config.ts` 里配置的 dev proxy，或本地反代。

## 初始化管理员 & 创建普通用户

1. 用 `WEBUI_BOOTSTRAP_ADMIN=用户:密码` 首次启动 web 后端，自动建管理员。
2. 管理员登录后，在"用户管理"创建 Headscale 用户（如 `alice`）。
3. 在 web 后端用管理员调 `POST /ui/api/admin/webusers` 创建普通 Web 账号并 `headscale_user: alice` 映射。
4. 普通用户登录后，在"我的设备"自助生成密钥入网。

## API 对照（前端经 Web 后端代理到 Headscale）

| 模块 | Headscale 资源 |
|------|----------------|
| 节点 | `GET /node`、`DELETE /node/{id}`、`POST /node/{id}/expire`、`POST /node/{id}/rename/{name}`、`POST /node/{id}/tags` |
| 用户 | `GET /user`、`POST /user`、`DELETE /user/{id}` |
| 预授权密钥 | `GET /preauthkey`、`POST /preauthkey`（**需用数字用户 ID，Web 后端已自动把用户名解析为 ID**）、`POST /preauthkey/expire`、`DELETE /preauthkey?id=` |
| ACL 策略 | `GET /policy`、`PUT /policy`、`POST /policy/check` |
