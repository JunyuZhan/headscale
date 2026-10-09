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
