import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type Lang = "zh" | "en";

// English strings are used as keys. Chinese overrides live in `zh`.
// Anything missing from `zh` falls back to the (English) key, so the
// UI degrades gracefully and English is always available via the switcher.
const zh: Record<string, string> = {
  // Layout / navigation
  Overview: "总览",
  Nodes: "节点",
  "My devices": "我的设备",
  Users: "用户",
  "Pre-auth keys": "预授权密钥",
  "ACL Policy": "访问控制策略",
  Workspace: "工作区",
  Administration: "管理",
  "Log out": "退出登录",
  admin: "管理员",
  user: "普通用户",

  // Self-service
  "Joined devices": "已加入的设备",
  "No devices yet.": "暂无设备。",
  "Generate join key (self-service)": "生成接入密钥（自助入网）",
  "Target user": "目标用户",
  "Create a Headscale user first": "请先在「用户」页面创建 Headscale 用户",
  "Join command (key shown once)": "接入命令（密钥仅显示一次）",
  "Copy command": "复制命令",

  // Generic
  "Loading…": "加载中…",
  Refresh: "刷新",
  "Signing in…": "登录中…",
  "Sign in": "登录",

  // Nodes
  Name: "名称",
  User: "用户",
  Addresses: "地址",
  Status: "状态",
  "Last seen": "最近活跃",
  Tags: "标签",
  Actions: "操作",
  online: "在线",
  offline: "离线",
  Live: "实时",
  Rename: "重命名",
  Expire: "过期",
  Delete: "删除",
  "No nodes": "暂无节点",
  "New name": "新名称",
  "Tags (space separated, e.g. tag:server)": "标签（空格分隔，例如 tag:server）",
  "Rename failed": "重命名失败",
  "Set tags failed": "设置标签失败",
  "Delete node": "删除节点",
  "Delete failed": "删除失败",

  // Users
  "New user name": "新用户名",
  Create: "创建",
  "Display name": "显示名称",
  Email: "邮箱",
  "No users": "暂无用户",
  "Create failed": "创建失败",
  "Delete user": "删除用户",

  // Pre-auth keys
  "New key created": "已创建新密钥",
  "Copy it now — it will not be shown again.": "请立即复制——密钥仅显示一次。",
  "User name": "用户名",
  "ACL tags (e.g. tag:server)": "ACL 标签（例如 tag:server）",
  Reusable: "可复用",
  Ephemeral: "临时",
  "Create key": "创建密钥",
  ID: "标识",
  Expiration: "过期时间",
  yes: "是",
  no: "否",
  "No keys": "暂无密钥",
  "User is required": "请填写用户名",
  "Expire failed": "过期操作失败",

  // Policy
  Groups: "分组",
  Hosts: "主机",
  "Tag owners": "标签所有者",
  "ACL rules": "ACL 规则",
  Action: "动作",
  Source: "源",
  Destination: "目标",
  accept: "允许",
  deny: "拒绝",
  Load: "加载",
  Validate: "校验",
  Save: "保存",
  "No policy is stored yet. Saving will create one.":
    "尚未存储策略，保存将创建一条。",
  "Quick add rule": "快速添加规则",
  Add: "添加",
  "Isolated mode": "成员隔离",
  "Mesh mode": "成员互访",
  "— none —": "— 无 —",

  // Invite device
  "Invite device": "邀请设备",
  "Invite a colleague to join": "邀请同事加入本网络",
  "Generate an invite command with a built-in token.":
    "生成一条带内置令牌的邀请命令，同事运行即自动加入（无需登录后台）。",
  "Generate invite command": "生成邀请命令",
  "Key (shown once)": "密钥（仅显示一次）",
  "Linux / macOS": "Linux / macOS",
  "Windows": "Windows",
  "Copy install script": "复制命令",
  "Download script": "下载脚本",
  "Token valid for": "令牌有效期",
  "hours": "小时",
  "Revoke anytime from": "可随时在",
  "Revoke device": "吊销设备",
  "Revoke node": "吊销节点",
  "Target user is required": "请选择目标用户",

  // Invite ledger
  "Applicant": "申请人",
  "Device description": "设备描述",
  "Organization": "单位",
  "Used as node hostname; ASCII only, e.g. zhangsan-laptop":
    "作为节点名（仅 ASCII，例如 zhangsan-laptop）",
  "Invitation ledger": "邀请台账",
  "No invitations yet.": "暂无邀请记录。",
  "Device": "设备",
  "Node name": "节点名",
  "By": "生成人",
  "Expires": "过期时间",
  "未使用": "未使用",
  "已使用": "已使用",
  "已过期": "已过期",
  "已吊销": "已吊销",

  // Change password
  "Change password": "修改密码",
  "Old password": "原密码",
  "New password": "新密码",
  "Confirm password": "确认新密码",
  "Password changed": "密码已修改",
  "Change password failed": "修改密码失败",

  // Activity log (audit)
  "Activity log": "活动日志",
  Notifications: "站内通知",
  "Mark all read": "全部已读",
  "No notifications": "暂无通知",  "Time": "时间",
  "Actor": "操作者",
  "Event": "事件",
  "Target": "对象",
  "Detail": "详情",
  "IP": "来源 IP",
  "No activity yet.": "暂无活动记录。",

  // Mobile onboarding
  "Mobile access": "移动端接入",
  "Download profile (iOS)": "下载描述文件（iOS）",
  "iOS install steps": "iOS 安装步骤",
  "Android access": "Android 接入",
  "Android note":
    "Android 需通过 MDM（Android Enterprise）下发 ServerURL + AuthKey 托管配置，或先将设备设为完全托管设备后再安装 Tailscale。",
  "Managed config (Android)": "Android 托管配置（JSON）",
  "Copy config": "复制配置",
  "Install profile hint":
    "将描述文件通过 AirDrop / 邮件 / 网盘发送到 iPhone 或 iPad，打开「设置 → 已下载的描述文件」安装，再打开 Tailscale 即可自动连接。",
  "Server": "服务器",
  "Auth key embedded": "密钥已内嵌于描述文件（仅显示一次，请妥善保管）",

  // Mail / SMTP settings
  "Mail settings": "邮件设置",
  "Enable email alerts": "启用邮件告警",
  "SMTP configuration": "SMTP 配置",
  "SMTP host": "SMTP 主机",
  "SMTP port": "SMTP 端口",
  "SMTP username": "SMTP 用户名",
  "SMTP password": "SMTP 密码",
  "Leave blank to keep unchanged": "留空表示不修改",
  "From address": "发件地址",
  "Encryption": "加密方式",
  "STARTTLS (587)": "STARTTLS（587）",
  "Implicit TLS (465)": "隐式 TLS（465）",
  "Resend API key": "Resend API 密钥",
  "Resend from": "Resend 发件地址",
  "Alert recipients": "告警收件人",
  "comma-separated emails": "多个邮箱用逗号分隔",
  "Test recipient": "测试收件邮箱",
  "Send test email": "发送测试邮件",
  "Test email sent": "测试邮件已发送",
  "Test recipient required": "请填写测试收件邮箱",
  "Mail not configured": "尚未配置邮件",
};

const STORAGE_KEY = "hs_lang";

function initialLang(): Lang {
  if (typeof localStorage === "undefined") return "zh";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "zh";
}

interface LangCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
}

const LangCtx = createContext<LangCtxValue>({
  lang: "zh",
  setLang: () => {},
  t: (s) => s,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang());

  const setLang = (l: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setLangState(l);
  };

  const t = (s: string) => (lang === "en" ? s : zh[s] ?? s);

  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
      {children}
    </LangCtx.Provider>
  );
}

export function useI18n(): LangCtxValue {
  return useContext(LangCtx);
}
