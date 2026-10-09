# 设备入网与访问控制 实施计划

> 创建：2026-10-09 ｜ 状态：**计划中 → 实施中**
> 范围：内部同事一键入网（token）+ 成员隔离仅可达 192.168.50.0/24 + 后台可吊销。
> 关联文档：`FEATURES.md`（功能清单与路线图）、`.workbuddy/memory/`。

---

## 一、已确认的需求（用户拍板）

1. **入网方式**：内部同事通过 **token 命令一键入网**；无需为每人建 Web 账号。
2. **访问隔离**：成员之间**互不可达**；成员**只能访问整个 `192.168.50.0/24` 内网子网**（经 debian10 子网路由）。
3. **吊销**：后台**必须可以随时吊销**任意设备（设备即节点）。
4. **审批门**：**不启用**"逐个后台批准才进网"（采用 token 自动入网）。
5. **移动端描述文件**（iOS .mobileconfig + Android 指引）：本轮**不做**，按 FEATURES.md 排期在 Subnet Router 落地后补。

---

## 二、方案要点

### 2.1 限制性 ACL（替换当前 allow-all）
- 当前为方便跑通，写的是 **allow-all**。改为**默认 deny + 仅放行** 节点 → `192.168.50.0/24`。
- Tailscale/Headscale ACL 默认即 deny-all，只需写入一条 `accept` 规则：
  - `src: ["*"]` → `dst: ["internal-net:*"]`，其中 `internal-net = 192.168.50.0/24`（hosts 别名）。
- 成员之间、出网等一切其它流量均被默认拒绝。
- 子网路由 `192.168.50.0/24` 已由 `autoApprovers.routes` 自动批准；ACL 只控制"谁能使用这条路由"，本策略已放行。
- 注意：`policy.mode = database`，ACL 存于 Headscale DB（此前已 PUT 过 allow-all）。新策略通过 `PUT /api/v1/policy` 写入（Web 后台「ACL 策略」页保存，或 VPS CLI `headscale policy set`）。

### 2.2 入网命令打包「安装 + join」
- 当前后端 `joinCommands`（server.go）只输出 `tailscale up ...`，**未含安装客户端**。
- 增强为带安装步骤的全平台命令：
  - Linux/macOS：`curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --login-server <url> --authkey <key>`
  - Windows：安装 `tailscale-ipn.msi` + `tailscale up ...`（提供独立 Windows 块）。
- 向后兼容：新增字段，旧字段保留。

### 2.3 专用「邀请设备」页面（admin）
- 新增前端页 `web/src/pages/Invite.tsx`，侧边栏新增「邀请设备」菜单（仅 admin 可见）。
- 表单：目标 Headscale 用户（下拉，admin 选择）、可复用、有效期(1–720h)、ACL tags。
- 提交 → 复用现有 `POST /ui/api/me/preauthkey`（admin 传 `headscale_user` 选目标用户）→ 返回 key + 全平台命令。
- 展示：key（仅显示一次）、各平台命令一键复制、下载脚本（.sh / .ps1）。

### 2.4 吊销能力（已具备，复核 + 文案优化）
- `Nodes.tsx` 已有「删除 / 过期」。将「删除」明确标注为 **「吊销设备」** 并加二次确认（硬吊销 = 删除节点）。
- 此为"后台随时吊销"的落地，无需新端点。

---

## 三、实施步骤（含文件清单）

- [ ] 1. 准备限制性 ACL 文本（`internal-net = 192.168.50.0/24`；accept `* → internal-net:*`）。
- [ ] 2. `hscontrol/webbackend/server.go`：增强 `joinCommands`，增加安装步骤（Linux/macOS 合并 + Windows 安装块）。
- [ ] 3. `web/src/pages/Invite.tsx`：新增「邀请设备」页（admin），复用 `self.createKey`。
- [ ] 4. `web/src/App.tsx` + `web/src/components/Layout.tsx`：注册路由 + 侧边栏菜单项（admin 可见）。
- [ ] 5. `web/src/i18n.tsx`：补充中文文案（邀请设备 / 复制脚本 / 下载脚本 / 吊销设备 等）。
- [ ] 6. `web/src/pages/Nodes.tsx`：将「删除」改「吊销设备」并加二次确认。
- [ ] 7. 构建 + 部署：本地 `npm run build` → 打包 `web/` → scp → VPS 重建镜像 `headscale-web:local` → `docker compose up -d --force-recreate`。
- [ ] 8. 应用 ACL：VPS 上 `headscale policy set` 写入限制性策略（或后台策略页保存）。
- [ ] 9. 验证：登录 200、生成邀请命令含安装步骤、`GET /policy` 200、`Nodes` 列表 + 吊销可用、`tailscale status` 复核（用户侧）。

---

## 四、本轮不做（已排期）

- 移动端描述文件（iOS .mobileconfig + Android 指引）—— Subnet Router 落地后补。
- 节点审批门（若将来要求"进网需后台批准"再做）。
- Web 内子网路由批准/禁用、Exit Node 开关、DNS/DERP 配置、OIDC/LDAP、日志/metrics/实时推送——见 `FEATURES.md` 路线图。

---

## 五、风险与注意

- 限制性 ACL 写入后为**全局策略**，影响整个 tailnet：生效后成员互访/出网会被切断，仅保留到 `192.168.50.0/24` 的访问——这正是目标，但需知会内部同事。
- 安装命令依赖公网可达 `tailscale.com` 安装源；此前 debian10 已能访问，确认内网机器出网可达。
- ACL 改动前先在小范围（1 台测试机）确认目标内网服务可达，再全员推开。
