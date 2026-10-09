# 功能清单（FEATURES）

> 本文档基于代码与提交记录整理，描述本项目当前已实现的功能。
> 项目构成：juanfont/Headscale（协调服务器本体）＋ 一个 fork 出的内置 Web 管理界面
> （commit `1308cb5b` 引入）。架构要点：**前端只与 webbackend 通信，Headscale API Key 仅存于服务端**，
> 浏览器通过 HttpOnly 会话 Cookie 鉴权，webbackend 按角色做作用域隔离后代理转发。

---

## 一、Headscale 本体（原始项目）核心功能

Web 界面只是它的"遥控器"，底层能力都来自这里：

- **自托管 Tailscale 控制服务器**：开源替代，单 tailnet，适合个人/小团队。
- **WireGuard 节点协调**：为节点分配 `100.64.0.0/10` 地址、交换公钥、建立点对点连接、NAT 穿透。
- **节点（machine）管理**：注册、Noise 握手、在线/离线、过期与续期、改名、打标签。
- **用户（user/namespace）隔离**：多用户、用户间网络隔离。
- **预授权密钥（Pre-Auth Key）**：设备无交互加入；支持可复用 / 临时（ephemeral）/ 过期时间 / ACL tags。
- **ACL 访问控制**：策略 v1（HuJSON：groups / hosts / tagOwners / acls），以及仓库已落地的 **policy v2（grants / via-route）**。
- **子网路由与 Exit Node**：节点可宣告子网路由（`--advertise-routes`），服务端批准；可作出口节点（`autoApprovers` 可自动批准路由）。
- **MagicDNS / 自定义 DNS**：内置 `base_domain`、全局 nameserver（本部署：1.1.1.1 / 8.8.8.8）。
- **DERP 中继**：可连官方 DERP，也支持自建 DERP server（仓库含 `Dockerfile.derper`）。
- **标签与 tag owners**：控制谁能给节点打某类标签。
- **存储**：SQLite / Postgres（本部署用 SQLite，`hs_data` 卷）。
- **OIDC 登录**：Headscale 本体支持 OIDC（本 fork 的 Web 未接入，暂缓）。

---

## 二、Web 管理界面（fork 原始实现）功能

对应文件：`web/src/pages/*`、`hscontrol/webbackend/server.go`。

### 认证与账号体系
- 登录页 + 登出 + `/me` 查询（会话 Cookie `HttpOnly`，默认 12h 过期）。
- 两类角色：`admin`（看全部）、`user`（映射到一个 Headscale 用户，只能碰自己的资源）。
- 后台账号管理（仅 admin）：列出 / 创建 / 删除 Web 登录账号（用户名、密码、绑定 Headscale 用户、角色）。
- 首次启动用 `WEBUI_BOOTSTRAP_ADMIN` 自动建初始管理员。

### 概览 Dashboard
- 统计卡片：节点数、密钥数；admin 额外看用户数。

### 节点管理（`/nodes`）
- 列表：名称、所属用户、地址、在线状态、最近活跃、标签。
- 操作：**改名、设标签、过期（expire）、删除**。

### 用户管理（admin，`/users`）
- 列出（名称 / 显示名 / 邮箱）、**创建、删除** Headscale 用户。

### 预授权密钥（admin，`/keys`）
- 列出、新建（用户 / 可复用 / 临时 / 过期时间 / ACL tags）、**过期、删除**；密钥只显示一次。

### ACL 策略（admin，`/policy`）
- 读取 / 保存 / **校验** HuJSON 策略。
- 可视化展示 groups / hosts / tagOwners / acl 规则。
- "快速添加规则"表单（accept / deny + 源 + 目的）。

### 自助服务（"我的设备" `/myself`）
- 普通用户：查看自己映射用户下的已加入设备。
- **生成接入密钥**（可复用 / 临时 / 有效期 1–720h），直接返回带 `--login-server` 的 join 命令（Linux/macOS、Windows 两版），一键复制。
- admin 在此生成密钥时需**先选目标 Headscale 用户**。

---

## 三、本会话（fork 维护）新增 / 改造

| 提交 | 内容 |
|---|---|
| `97097506` | **中文化 + 语言切换**：新增 `i18n.tsx`（英文作 key 的 zh 覆盖、缺失回退英文），默认中文，右上角「中/EN」切换，localStorage 持久化；9 个页面/组件接入 `t()`。 |
| `bd65eb83` | **admin 自助服务修复**：admin 生成密钥原被 403，改为必须选择目标 Headscale 用户；**空策略 500 归一化**：Headscale 无 ACL 时 `GET /policy` 返回 500，代理层归一化为 `200 {"policy":""}`，并写入 allow-all 策略从源头消除报错。 |
| `e3e90bfd` | **PreAuthKey 渲染崩溃修复**：该 Headscale 版本返回的 `user` 是完整 User 对象而非字符串，表格直接渲染导致 React #31 崩溃；改为取 `.name` 并放宽类型。 |
| 本次新增 | **邀请设备（admin）+ 限制性 ACL + 吊销**：新增 `web/src/pages/Invite.tsx`（admin 选目标 Headscale 用户生成 PreAuthKey，返回含自动安装步骤的全平台命令，可复制 / 下载 `.sh` `.ps1` 脚本）；后端 `joinCommands` 增强为「安装 + join」一行命令（Linux/macOS：`curl … install.sh \| sh && sudo tailscale up …`；Windows：msi 安装 + up）；`Nodes` 页「删除」改为「吊销设备」并加二次确认；服务端写入**限制性 ACL**（默认 deny，仅放行 `internal-net = 192.168.50.0/24`），实现成员彼此隔离、只能访问内网子网。 |

### 部署侧（实现的一部分）
- VPS（`156.225.20.242`）真机上线：`headscale-web:local` 镜像，host nginx 做 TLS 终止 + 反代（`/ui/api/*` → 18090，`/` → 302 → `/ui/`，其余 → 18080）。
- 修复多处原始部署配置错误（config 键名 `database:`、缺 `dns:` / `noise`、`DERP` 地图地址、根路径跳转、certbot 选项文件）。
- 加 `autoApprovers.routes: [192.168.50.0/24]`，内网子网路由入网即自动批准。

---

## 四、Web 界面尚未暴露的能力（待规划）

- 节点**子网路由的批准/禁用**、Exit Node 开关（当前靠 `autoApprovers` 或 `headscale` CLI）。
- 节点审批（registered vs 待审）、设备分享（sharing machine to another user）。
- DNS 设置、DERP 地图、OIDC 用户注册的 Web 配置。
- 日志 / metrics 可视化（`/metrics` 已开但无界面）。
- 节点列表实时推送（当前为手动刷新）。

---

## 五、功能规划与优先级（用户决策，2026-10-09）

- **Subnet Router 落地 + 成员隔离**：✅ 已完成。token 命令一键入网（无需每人建账号）+ 限制性 ACL（成员互不可达，仅可访问 `192.168.50.0/24`）+ 后台可随时吊销；不做"逐个审批门"。详见 `PLAN-设备入网与隔离.md`。
- **移动端描述文件**：Subnet Router 完成后补（iOS `.mobileconfig` + Android 指引）。
- **子网路由 Web 批准**：值得做，但不紧急（当前靠 `autoApprovers`）。
- **Exit Node 开关**：有人提需求再做（on-demand）。
- **节点审批**：已决定**不做**（采用 token 自动入网）。
- **DNS / DERP / OIDC 配置界面**：继续暂缓。
- **日志 / metrics / 实时推送**：最后做。
