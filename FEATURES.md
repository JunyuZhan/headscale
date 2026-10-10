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
| 本次新增 | **邀请设备（admin）+ 限制性 ACL + 吊销**：新增 `web/src/pages/Invite.tsx`（admin 选目标 Headscale 用户生成 PreAuthKey，返回含自动安装步骤的全平台命令，可复制 / 下载 `.sh` `.ps1` 脚本）；后端 `joinCommands` 增强为「安装 + join」一行命令；`Nodes` 页「删除」改为「吊销设备」并加二次确认；服务端写入限制**子网** ACL（默认 deny，仅放行 `internal-net = 192.168.50.0/24`）。 |
| 本次新增（v2） | **邀请台账 + 节点归属 + 自助改密码 + ACL 预设切换**：① 新增 `Invite` 模型与 `POST /ui/api/admin/invites` 列表接口，邀请设备时填写**申请人 / 设备描述 / 单位**，后台留存可查列表（谁、什么设备、单位、状态、过期时间）；② `joinCommands` 注入 `--hostname`（用设备描述），连入后节点名即设备名，`Nodes` 页可识别归属；③ 新增 `POST /ui/api/me/password`（自助改密码）+ `POST /ui/api/admin/webusers/:id/password`（admin 重置），前端 Layout 用户菜单加「修改密码」弹窗；④ ACL 改为 **tag 驱动、后台可切换预设**（成员隔离：仅放行 → `tag:server`；成员互访：全互通），不再写死任何物理子网。 |
| `2d8a67cc` | **Web UI 美化重构 + 修改 admin 默认密码**：Dashboard/Nodes/Policy 统一样式（卡片、focus-ring、状态药丸、统一按钮）；`Layout` 用户菜单加「修改密码」；部署侧将 admin 默认密码改掉。 |
| `fd271669` | **统一美化 + 移动端接入 + 收窄代理白名单**：重写 `Users.tsx`/`PreAuthKeys.tsx` 对齐设计；`Invite.tsx` 增「移动端接入」卡片（iOS `.mobileconfig` + Android 托管配置）；**后端 `handleProxy` 收窄白名单**（仅放行 node/user/preauthkey/policy 对应 method/path，其余 tailnet/apikey/derp 等一律 403）。 |
| `6b7bfe0b` | **移动接入公共库 + 自助页补 Windows/移动端**：抽取 `web/src/lib/mobileconfig.ts`（`buildMobileConfig` iOS / `buildAndroidConfig` Android），`Invite.tsx`/`SelfService.tsx` 共用；`SelfService` 此前缺 Windows 命令块与移动端接入，现已补齐（非管理员 iPhone 用户也能拿描述文件）。已用线上真实密钥经 esbuild 跑通库代码并 `plistlib` 解析校验。 |
| `5dd28cce` | **修复代理白名单误伤节点管理（严重 bug）**：上一轮 `proxyAllowed` 过严，`POST/DELETE /node/...` 被拦，导致 Nodes 页打标签/删除/过期/改名全部静默失败（实测 403 `forbidden: proxy endpoint not allowed`）。改为放行 `/node/` 前缀，并对非管理员加节点变更/删除 403 护栏。 |
| `d1804810` | **修复 Windows 安装包 URL 404（严重 bug）**：`joinCommands` 原引用 `tailscale-ipn.msi`/`setup.exe`（curl 实测 404），改为官方现行可用的 `tailscale-setup-latest.exe` + `Start-Process -Wait ... '/S'`。grep 运行中二进制确认一致。 |
| `9042c523` | **修复两处节点显示 bug（真机容器节点实测）**：① 改名无效——Headscale 改名端点改的是 `givenName`，前端只渲染 `n.name`，改为 `n.givenName ?? n.name`；② 状态灯恒显离线——API 返回 `online` 而前端读 `n.connected`（永不填充），改为 `n.online ?? n.connected`。`SelfService` 的 `NodeRow` 同步补字段。 |
| `166037b1` | **安全 + 可靠性套件**：① 审计日志（`Event` 模型 + `/admin/events` + `/me/events` + 新增「活动日志」页，登录/建删账号/改密/建密钥/套用策略/节点操作/代理均落库）；② 邮件告警（Resend REST，best-effort）；③ **登录限流**（同 IP+用户名 5 次失败锁 15 分钟→429）；④ **改密即注销该用户全部会话**；⑤ **节点上下线监控**（`startWatcher` 每 60s 轮询 Headscale，记录 node_join/node_offline，不依赖邮件密钥即运行）。 |
| `d5abb16c` | **SMTP 发信支持**：新增 SMTP 通道（STARTTLS 587 / 隐式 TLS 465，Resend 用户名恒为 `resend`、密码=API key），配置 `SMTP_HOST` 时优先走 SMTP，否则回退 Resend REST；`SMTP_PASSWORD` 缺省复用 `RESEND_API_KEY`。本地用 Go `net/smtp` 对 `smtp.resend.com:587` 实跑 STARTTLS 握手（TLS1.3、证书 OK）+ 确认服务端提供 AUTH。 |
| `e94ec0e8` | **邮件设置后台可配 + Dashboard 在线数修复 + 在线灯呼吸动画**：① 新增 `Setting` 表持久化邮件配置，启动从 env 播种进库（现有 `RESEND_API_KEY`/`SMTP_*` 部署无需改 `.env` 即沿用）；`GET/PUT /admin/settings/mail`（密码/密钥掩码、空值不覆盖）+ `POST /mail/test` 真实发测试信并回报成败；新增「邮件设置」页（admin 侧边栏：启用开关/SMTP/Resend/告警收件人/发送测试邮件）；② **修复 Dashboard 在线数恒为 0**（原用 `x.connected` → 改 `x.online ?? x.connected`）；③ 在线绿灯加 `.status-pulse` 呼吸动画。 |
| `ca58ae66` | **节点列表 SSE 实时推送**：① 后端新增 SSE hub + `startNodeStream`（5s 轮询 Headscale `/api/v1/node`，按 `(id,online)` 签名变化才广播，非阻塞投递，慢客户端不影响广播）+ 端点 `GET /ui/api/nodes/stream`（复用会话 Cookie 鉴权、hello 事件、25s keepalive、`X-Accel-Buffering:no` 让 host nginx 不缓冲）；② 前端新增 `web/src/lib/useNodeStream.ts`（EventSource + 断线 5s 重连 + 卸载清理）；Nodes 页接入并加「实时」绿点指示，Dashboard 计数器随上下线自动刷新，无需手动点「刷新」。 |
| `623ee152` | **修复节点「地址」列全空**：Headscale `/api/v1/node` 返回字段是 **`ipAddresses`（驼峰）**，前端却读 `n.addresses`（永不填充）→ 地址列恒为「—」。修复：`client.ts` Node 接口补 `ipAddresses`；Nodes/SelfService 渲染改为 `(n.ipAddresses ?? n.addresses)`。 |
| `b417817d` | **修复「创建用户」403**：`proxyAllowed()` 的 POST 分支漏了 `rest == "/user"`，前端「创建用户」恒返回 403。修复：POST 分支补 `/user`。线上实测修复前 403 → 修复后 200。 |
| `4ace25c1` | **站内通知（铃铛未读红点 + 下拉列表 + 实时 Toast）**：① 后端新增 SSE 事件 hub（`broadcastEvent` 在 `recordEvent` 落库后广播 Event）+ 端点 `GET /ui/api/events/stream`（管理员收全部、普通用户仅收自己）；② 前端新增 `useEventStream.ts` + `Notifications.tsx`（顶栏铃铛 + 未读红点计数 + 下拉 30 条 + 新事件实时 Toast + 「全部已读」，未读基于 localStorage 与事件 id 比较）。 |

#### 2026-10-10 真机验证要点（五轮自检）
本轮在 debian/hk/aly/VPS 真实组网环境完成 5 轮、每轮落实验证，核心结论：
- **`tailscale ping` 测的是 WireGuard 控制端口 41641，永不受 ACL 约束、永远 pong，不能证明数据流量通断**；ACL 生效必须用真实 TCP（对 Tailscale IP 起 `python3 -m http.server` 再用对端 `curl`）。
- ACL 隔离：member（aly/debian）TCP 可达 `tag:server`（hk-node），member 之间互相超时（隔离）；server→member 同样被正确隔离（纠正了 ping 假阳性误判）。
- 预设：MESH 互访 200 → 回退 ISOLATED 隔离生效；生产保持 ISOLATED。
- 安全审计：非管理员 `sectest` 对 policy/user/admin 列表/邀请/webusers/节点变更 全部 403；自助建 key 200。
- 已修复并验证上线：代理白名单 403、Windows 404、givenName/online 两处显示 bug。

### 部署侧（实现的一部分）
- VPS（`156.225.20.242`）真机上线：`headscale-web:local` 镜像，host nginx 做 TLS 终止 + 反代（`/ui/api/*` → 18090，`/` → 302 → `/ui/`，其余 → 18080）。
- 修复多处原始部署配置错误（config 键名 `database:`、缺 `dns:` / `noise`、`DERP` 地图地址、根路径跳转、certbot 选项文件）。
- **纯节点方案**：内网服务器自身装 Tailscale 客户端加入 VPN、打 `tag:server` 暴露，已**移除 `autoApprovers`**（不再靠子网路由宣告整个 /24）；ACL 改为 tag 预设，初始默认「成员隔离」。

---

## 四、Web 界面尚未暴露的能力（待规划）

- 节点**子网路由的批准/禁用**、Exit Node 开关（当前靠 `autoApprovers` 或 `headscale` CLI）。
- 节点审批（registered vs 待审）、设备分享（sharing machine to another user）。
- DNS 设置、DERP 地图、OIDC 用户注册的 Web 配置（OIDC 本体支持但本 fork 的 Web 未接入）。
- **metrics 可视化**（`/metrics` 已开但无界面；审计日志 / 活动日志页 `166037b1` 已实现，不在此列）。
- **节点列表实时推送**：✅ 已实现（`ca58ae66`，SSE），不再在此列。
- **移动端描述文件真机装机验证**：iOS `.mobileconfig` / Android 托管配置代码（`6b7bfe0b`）已生成并经 plist/JSON 解析校验，但环境无移动设备，**未做真机安装验证**。

---

## 五、功能规划与优先级（用户决策，2026-10-09 → 2026-10-10 更新）

- **设备入网与访问控制（v2）**：✅ 已完成并上线。token 命令一键入网（无需每人建账号）+ **ACL tag 驱动可切换预设**（成员隔离 / 成员互访）+ **邀请台账**（申请人 / 设备 / 单位可查）+ **节点归属 hostname** + 后台可随时**吊销** + **自助改密码**。不做"逐个审批门"。详见 `PLAN-设备入网与隔离.md`。
- **纯节点方案**：内网服务器作为节点（`tag:server`）加入 VPN，不再用子网路由宣告整个 /24；debian10 不再当 subnet router（已移除 `autoApprovers`）。
- **移动端描述文件**：✅ 代码已完成（`6b7bfe0b`，iOS `.mobileconfig` + Android 托管配置，公共库 `web/src/lib/mobileconfig.ts`），⚠️ 真机装机未验证。
- **安全 + 可靠性套件**：✅ 已完成（`166037b1`）：审计日志 / 活动日志页、邮件告警（Resend + SMTP）、登录限流（5 次失败锁 15 分钟）、改密注销全部会话、节点上下线监控。
- **邮件设置后台可配**：✅ 已完成（`e94ec0e8`）：「邮件设置」页（admin）可配置 SMTP/Resend/告警收件人 + 一键发测试邮件；配置持久化到 `Setting` 表，启动时从 env 播种。
- **节点列表实时推送（SSE）**：✅ 已完成（`ca58ae66`）：`GET /ui/api/nodes/stream`，5s 轮询节点签名变化即推送，Nodes/Dashboard 自动刷新。
- **站内通知**：✅ 已完成（`4ace25c1`）：顶栏铃铛 + 未读红点 + 下拉列表 + 实时 Toast（`GET /ui/api/events/stream`）。
- **登录页等 UI 细节打磨**：⬜ 用户原则「先功能后美化」，仍排在功能完善之后（Dashboard/Nodes/Users/Keys/Policy 已统一美化，登录页等细化待做）。
- **Exit Node 开关**：有人提需求再做（on-demand）。
- **节点审批**：已决定**不做**（采用 token 自动入网）。
- **DNS / DERP / OIDC 配置界面**：继续暂缓。
- **metrics 可视化**：⏳ 仍排最后。

### 配置方式一览（哪些后台可配、哪些仍硬编码）

> 澄清：本项目**绝大部分业务参数仍硬编码于代码**，只有**邮件设置**做成了后台可配（用户要求「想要邮件告警的就配置一下」）。改动硬编码项需改代码并重建镜像。

| 配置项 | 位置 | 是否后台可配 | 生效方式 |
|---|---|---|---|
| SMTP / Resend / 告警收件人 / 启用开关 | `Setting` 表（key `mail`） | ✅ **后台可配**（「邮件设置」页） | UI 保存即生效，无需重启 |
| Headscale 地址 / API Key / 监听地址 / DB 路径 / Cookie Secure / 初始管理员 | 环境变量（`docker-compose.yml`） | ⬜ 仅 env | 改 env + 重建容器 |
| 会话时长 `12h` | `LoadConfig`（写死） | ❌ 硬编码 | 改代码 + 重建 |
| 密钥过期默认 `24h` / 上限 `30d` | `handleCreateSelfKey`（写死） | ❌ 硬编码 | 改代码 + 重建 |
| ACL 预设 `ISOLATED` / `MESH` | `web/src/pages/Policy.tsx`（TS 常量） | ❌ 硬编码（但可在 UI 切预设并保存到 Headscale） | 改代码 + 重建 |
| tag 拥有者 `owner@hsnet.sclink.dev`、`tag:server` 约定 | 前端常量 + 文案 | ❌ 硬编码 | 改代码 + 重建 |

- **不做的**：通用「系统设置」配置页（用户定「不做配置页，先完善功能」；邮件是唯一例外）。

---

## 六、开发任务清单（2026-10-10 梳理，持续更新）

用户原则：**先功能后美化**；**不做通用配置页**（邮件设置是例外，已后台可配）。下分三类。

### A. 代码已完成，仅差真实环境验证（非开发，是测试）
| # | 任务 | 卡点 | 状态 |
|---|---|---|---|
| A1 | 邮件真实发信端到端验证 | 缺 `SMTP_PASSWORD`（= Resend API key）+ 测试收件人 | ⬜ 待用户给 key |
| A2 | 移动端真机装机（iOS `.mobileconfig` / Android 托管配置） | 环境无移动设备 | ⬜ 待真机 |
| A3 | 真内网服务器用邀请命令入网并打 `tag:server`（debian/hk/aly） | 待真实服务器 | ⬜ 待真实环境 |

### B. 尚未开发的功能（按价值排序）
| # | 任务 | 说明 / 依赖 | 状态 |
|---|---|---|---|
| B1 | **节点列表实时推送（SSE）** | 复用已跑的 watcher，加 `EventSource` 端点，节点上下线自动刷新页面；无需外部资源 | ✅ 已完成（`ca58ae66`） |
| B2 | 子网路由 Web 批准/禁用 + Exit Node 开关 | 当前靠 `autoApprovers`/CLI，无界面；Exit Node 用户定"有人提需求再做" | ⬜ 未开始 |
| B3 | 设备分享（share machine to another user） | Headscale 原生支持，UI 未暴露 | ⬜ 未开始 |
| B4 | DNS / DERP 地图 / OIDC 注册 Web 配置 | 用户定"继续暂缓" | ⬜ 暂缓 |
| B5 | 硬编码业务参数后台化（可选） | 会话时长 `12h`、密钥过期 `24h/30d`、ACL 预设 ISOLATED/MESH、`tag:server` 约定、tag 拥有者 `owner@...` 仍写死；邮件已例外后台化 | ⬜ 待定（默认不做） |

### C. UI 打磨（排最后）
| # | 任务 | 状态 |
|---|---|---|
| C1 | 登录页细化 + 整体视觉一致性收尾 | ⬜ 待功能完善后 |

### 下一步
- ✅ **B1 节点实时推送已完成并上线**（`ca58ae66`）。
- ✅ **站内通知（铃铛/未读/Toast）已完成**（`4ace25c1`）。
- A 类三项依赖用户提供的资源（key / 真机 / 真服务器），无法自主推进。
- 次优可自主推进：**B2 子网路由批准/禁用（Web 化）**（Exit Node 仍 on-demand）。
