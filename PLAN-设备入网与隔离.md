# 设备入网与访问控制 实施计划 (v2)

> 创建：2026-10-09 ｜ 更新：2026-10-09（v2：架构改为"服务器即节点" + ACL tag 化 + 新增自助改密码）｜ 状态：**计划中 → 实施中**
> 关联文档：`FEATURES.md`（功能清单与路线图）、`.workbuddy/memory/2026-10-09.md`。

---

## 一、已确认需求（用户拍板，多轮讨论收敛）

1. **入网方式**：内部同事通过 **token 命令一键入网**；无需为每人建 Web 账号。
2. **吊销**：后台**必须可以随时吊销**任意设备（设备即节点）。
3. **审批门**：**不启用**"逐个后台批准才进网"（token 自动入网）。
4. **邀请台账（必做）**：发放密钥时填写 **申请人 / 设备描述 / 单位**，后台留存可查列表（谁、什么设备、key 状态、是否已用、过期时间）。
5. **节点归属可见（必做）**：join 命令带 `--hostname`（设备描述），连入后节点名即设备名，Nodes 页一眼识别归属。
6. **自助修改密码（新增，必做）**：Web 增加登录用户自助改密码功能；admin 可额外重置他人密码。
7. **ACL 设计原则（用户决策）**：
   - **不写死、不硬编码任何物理子网**（如 `192.168.50.0/24`）。
   - 围绕 **tag** 设计，灵活覆盖多场景——支持"成员互访"与"每设备只能访问指定设备"两种模式，后台可切换预设。
   - 目标内网服务器**作为节点**（装 Tailscale 客户端加入 VPN，打 `tag:server`）暴露，而非靠 subnet router 宣告整个 /24。

---

## 二、方案要点

### 2.1 ACL：tag 驱动的灵活策略（替代硬编码 /24）

**放弃**"放行整个 `192.168.50.0/24` 子网"的写法——那等于把整段局域网暴露给 VPN 成员，且写死了物理网段。

**改为**：让内网服务器自身装 Tailscale 客户端加入 VPN，成为 `100.64.x.x` 节点，打 `tag:server`。ACL 只放行 **成员 → `tag:server`**，成员之间、其他地址默认 deny（Tailscale 默认即 deny-all，无匹配即拒绝）。

> 关于"全局策略"的澄清：Tailscale/Headscale **只有一份全局策略文件**，但全局策略≠不能细分——通过 **tags / groups / hosts** 可以把规则精确到"某个 tag 的设备只能访问另一个 tag 的设备"。所以"每设备只访问指定设备"完全能在全局策略内表达。

**两种预设（后台可切换，本质是重写策略文本）**：
- **模式A「成员隔离」**（最安全，推荐起步）：deny-all + `accept src:["*"] dst:["tag:server:*"]`。成员只能访问内网服务器节点，彼此不互通、不能出网。
- **模式B「成员互访」**：deny-all + `accept src:["tag:client"] dst:["tag:client:*"]` + `accept src:["*"] dst:["tag:server:*"]`。成员之间可互通，且都能访问服务器。
- **进阶「每设备指定目标」**：在策略中用 `groups` / `hosts` 精确写 `src:[某设备/组] → dst:[目标设备/组]`；可通过现有「ACL 策略」页手编 HuJSON，或后续做可视化规则编辑器。

**tag 分配**：
- 内网服务器节点加入后由 admin 打 `tag:server`（提供 `headscale nodes tag` 命令，或后续加后台按钮）。
- 成员设备默认 `tag:client`（邀请时可附带，或后台打）。

### 2.2 自助修改密码（新增）

- **后端**：新增 `POST /ui/api/me/password`（校验旧密码 bcrypt 比对 + 更新 `webui_data` 库的 `WebUser.Password`）；admin 额外 `POST /ui/api/admin/webusers/:id/password` 重置他人密码。
- **前端**：右上角用户名菜单增加「修改密码」项 → 弹窗/页：旧密码、新密码、确认；调用接口。
- **安全**：失败不泄露用户是否存在；简单失败计数/限流（至少不响应式爆破）。
- **i18n**：补充中文文案。无需改 DB schema（仅新增端点）。
- 此项同时交付"改初始密码"的治本方案（之前只有"服务端直改库"的临时办法）。

### 2.3 邀请台账（必做，已确认）

- **后端**：新增 `Invite` 表（gorm `AutoMigrate`）：`id, applicant(申请人), device_desc(设备描述), org(单位), target_user, key_prefix, created_at, expires_at, status(未用/已用/过期/吊销), created_by`。
  - 邀请页生成 key 时一并写台账；提供「邀请记录」列表接口（admin）。
- **前端**：`Invite.tsx` 表单增加 **申请人 / 设备描述 / 单位** 字段；页面下方展示台账列表（谁、什么设备、单位、状态、过期时间）。

### 2.4 入网命令带 hostname（已确认）

- 邀请页生成命令时，把"设备描述"写入 `--hostname`，连入后节点名即设备名，Nodes 页可识别归属。
- 入网命令安装+join 步骤（2.5）已在上轮实现，保留。

### 2.5 入网命令打包「安装 + join」（已实现，保留）

- 后端 `joinCommands` 已输出：Linux/macOS `curl … install.sh | sh && sudo tailscale up …`；Windows msi 安装+up。保留。

### 2.6 吊销能力（已实现，保留）

- Nodes 页「吊销设备」+ 二次确认（硬吊销=删除节点）。保留。

---

## 三、实施步骤（含文件清单）

- [ ] 1. ACL 文本改为 tag 驱动两种预设：`deploy/vps/acl-server.hujson`（隔离）、`deploy/vps/acl-mesh.hujson`（互访）；含 `tagOwners`。
- [ ] 2. `hscontrol/webbackend/server.go`：
  - 新增密码端点 `me/password` + `admin/webusers/:id/password`；
  - 新增 `Invite` 模型 + `AutoMigrate`；邀请写台账；新增「邀请记录」列表接口。
- [ ] 3. `web/src/pages/Invite.tsx`：表单加 **申请人/设备描述/单位** 字段；命令带 `--hostname`；下方展示台账列表。
- [ ] 4. 新增「修改密码」组件（弹窗）：Layout 右上角用户菜单加项，调用 `me/password`。
- [ ] 5. `web/src/App.tsx` + `web/src/components/Layout.tsx`：路由 + 菜单（密码入口、邀请记录）。
- [ ] 6. `web/src/i18n.tsx`：补充文案（修改密码 / 申请人 / 设备描述 / 单位 / 邀请记录 / 状态：未用·已用·过期·吊销 等）。
- [ ] 7. 构建 + 部署：本地 `npm run build` → 打包 → scp `/opt/hsbuild` → `docker build` 重建 `headscale-web:local` → `docker compose up -d --force-recreate`。
- [ ] 8. 应用 ACL 预设（按用户选择的初始模式）；验证：登录 / 改密码 / 生成邀请(带 hostname + 台账) / 策略 200 / 节点吊销。

---

## 四、本轮不做 / 延后

- 移动端描述文件（iOS .mobileconfig + Android 指引）—— 排期在设备入网稳定后。
- 节点审批门、Web 子网路由批准/禁用、Exit Node 开关、DNS/DERP 配置、OIDC/LDAP、日志/metrics/实时推送 —— 见 `FEATURES.md` 路线图。
- 可视化「每设备精确 ACL 规则编辑器」—— 先用预设 + 手编 HuJSON 覆盖，后续再做。

---

## 五、风险与注意

- ACL 是**全局策略**，误配会切断访问；生效前先小范围（1 台测试机）验证目标服务器节点可达。
- 密码端点需防暴破（失败计数/限流，不泄露用户存在）。
- 安装命令依赖公网可达 `tailscale.com` 安装源；内网机器出网需可达。
- 若保留 subnet router（debian10）作"访问服务器之外局域网设备"的备用，则 `autoApprovers` 与 ACL 放行对应子网需另行配置，不与节点方案冲突。
