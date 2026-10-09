# 一体化部署（Docker Compose + Caddy）

把 **Headscale（含内嵌 Web UI）**、**Web 后端**、**Caddy（HTTPS 单入口）** 编排在一起，对外只暴露一个域名。

## 拓扑

```
浏览器 ──HTTPS──► Caddy (自动 TLS) ─┬─ /ui/*      → headscale(:8080，静态 SPA + /api)
                                   └─ /ui/api/*  → webbackend(:8090，会话鉴权 + 代理 Headscale)
                                                   持有 HEADSCALE_API_KEY
```

## 步骤

1. 编辑 `headscale-config.yaml`：把 `server_url` 里的 `vpn.example.com` 换成你的真实域名（**三处**都要一致：这里、`.env` 的 `DOMAIN`、`Caddyfile` 的 `{$DOMAIN}`）。
2. 复制环境变量模板并填写：
   ```shell
   cp .env.example .env
   # 编辑 .env：DOMAIN、WEBUI_BOOTSTRAP_ADMIN(改掉默认密码)
   ```
3. 先不填 `HEADSCALE_API_KEY`，启动 headscale 与 Caddy：
   ```shell
   docker compose up -d headscale caddy
   ```
4. 生成 API Key（web 后端内部调用 Headscale 用）：
   ```shell
   docker compose exec headscale headscale apikeys create --expiration 8760h
   ```
   把输出值填入 `.env` 的 `HEADSCALE_API_KEY`。
5. 启动 web 后端（它会用 `WEBUI_BOOTSTRAP_ADMIN` 创建首个管理员）：
   ```shell
   docker compose up -d webbackend
   ```
6. 浏览器打开 `https://<你的域名>/ui`，用 `WEBUI_BOOTSTRAP_ADMIN` 的账号登录。

## 日常使用

- 管理员：在"用户管理"建 Headscale 用户；在 web 后端用 API 或下一步给同事建 Web 账号并映射。
- 同事（普通用户）：登录 → "我的设备" → 一键生成密钥 → 复制命令 → 设备安装 Tailscale 客户端运行即入网。

## 数据持久化

- `hs_data`：Headscale 数据库（SQLite）。
- `webui_data`：Web 后端用户表（SQLite）。
- `caddy_data` / `caddy_config`：证书与配置。

## 内网 Subnet Router（组网部分，非本仓库范围）

在你要暴露的内网里选一台常开 Linux 机器安装 Tailscale 客户端，宣告网段并开启 IP 转发，再在 Headscale 服务端批准该路由：

```shell
# 内网机器
tailscale up --login-server https://<域名> --advertise-routes=192.168.1.0/24
sudo sysctl -w net.ipv4.ip_forward=1
# 服务端批准（用 Web 后端的"节点"页或 CLI）
```

> 本仓库提供的是"控制中枢 + 管理/自助 Web"。设备入网、Subnet Router、可选自建 DERP 仍按 Headscale 官方文档操作。
