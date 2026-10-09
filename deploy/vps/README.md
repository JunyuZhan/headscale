# VPS 部署（复用既有 host nginx + certbot）

本目录是针对「已有 host nginx 占用 80/443、运行着 securelink 栈」的生产 VPS 改造后的部署方案。与 `deploy/` 根目录的 Caddy 方案不同，这里**不另起 Caddy**，而是把 headscale + web 后端挂到既有 nginx 后面。

## 架构
```
浏览器 ──HTTPS──► 既有 host nginx(80/443, TLS) ──► /ui/api/* → 127.0.0.1:18090 (webbackend)
                                      └─────────► 其余    → 127.0.0.1:18080 (headscale)
```
- headscale + webbackend 共用一个镜像 `headscale-web:local`，两个容器，独立 docker 网络。
- 两个服务都只绑 `127.0.0.1`，公网唯一入口是 host nginx。
- Headscale API Key 只存在于 webbackend 容器内，浏览器永不见。
- SQLite 存储（headscale 库 + web UI 用户库），与 securelink 的 Postgres 隔离。

## 步骤
1. **构建镜像**（在有 Docker 的机器上，仓库根目录）：
   ```shell
   docker build --ignorefile deploy/vps/.dockerignore \
     -f deploy/Dockerfile -t headscale-web:local .
   docker save headscale-web:local | gzip > hs-web.tar.gz
   ```
2. **传到 VPS** 并加载：
   ```shell
   scp hs-web.tar.gz root@<VPS>:/tmp/
   ssh root@<VPS> 'docker load < /tmp/hs-web.tar.gz'
   ```
3. **放部署文件**：`mkdir -p /opt/headscale && cp -r deploy/vps/* /opt/headscale/`
4. **起服务并建 Key**：
   ```shell
   cd /opt/headscale
   docker compose up -d headscale          # 先起 headscale
   KEY=$(docker compose exec -T headscale headscale apikeys create --expiration 87600h)
   cp .env.example .env && sed -i "s|__PASTE_KEY_HERE__|$KEY|" .env
   docker compose up -d webbackend        # 再起 webbackend
   ```
5. **nginx + 证书**（见 `headscale.nginx.conf` 注释）：
   - 先把 `:80` 块启用，`nginx -t && nginx -s reload`
   - `certbot certonly --webroot -w /var/www/html -d hs.sclink.dev`
   - 取消 `:443` 块注释，`nginx -s reload`
6. **验收**：访问 `https://hs.sclink.dev/ui`，用 `.env` 里的 admin 登录。

## 验证链路（端到端）
管理员建 Web 用户 → 用户登录 → 生成 Key → 下载接入命令 → 各端 Tailscale 入网 →
Headscale 看到设备 → Subnet Router 宣告内网网段 → 外网访问内网服务。
