// Talks to the web backend (NOT directly to Headscale). The backend holds the
// Headscale API key server-side and proxies every call, so the browser never
// sees the key. Authentication is a session cookie (HttpOnly) set by the
// backend on login; we send it with credentials: "include".

const PROXY_BASE = "/ui/api/proxy"; // backend strips this and calls Headscale /api/v1
const AUTH_BASE = "/ui/api/auth";

export interface Me {
  username: string;
  role: "admin" | "user";
  headscale_user: string;
}

export interface User {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  profilePicUrl?: string;
}

export interface Node {
  id: string;
  name: string;
  givenName?: string;
  user?: User | null;
  online?: boolean;
  connected?: boolean;
  lastSeen?: string;
  expiry?: string;
  addresses?: string[];
  ipAddresses?: string[]; // actual field returned by Headscale /api/v1/node
  machineKey?: string;
  nodeKey?: string;
  tags?: string[];
  primaryRoutes?: string[];
  subnetRoutes?: string[];
}

export interface PreAuthKey {
  id: string;
  key?: string;
  user?: User | string;
  reusable?: boolean;
  ephemeral?: boolean;
  expiration?: string;
  createdAt?: string;
  aclTags?: string[];
}

export interface Invite {
  id: number;
  applicant: string;
  device_desc: string;
  org: string;
  target_user: string;
  key_prefix: string;
  hostname: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  status: string;
}

export interface Policy {
  policy: string;
  updatedAt?: string;
}

// Audit / activity log entry recorded by the web backend.
export interface Event {
  id: number;
  time: string;
  actor: string;
  type: string;
  target: string;
  detail: string;
  ip: string;
}

// Mail / SMTP configuration (runtime-editable from the console). The SMTP
// password and Resend API key are write-only on the backend: GET returns them
// empty, and PUT keeps the existing secret when the field is left blank.
export interface MailSettings {
  enabled: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_username: string;
  smtp_password: string;
  smtp_from: string;
  smtp_tls: string; // starttls | ssl
  resend_api_key: string;
  resend_from: string;
  resend_notify_to: string;
}

export interface MailSettingsResp {
  mail: MailSettings;
  has_smtp_password: boolean;
  has_resend_key: boolean;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${PROXY_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error as string;
      else if (body?.message) msg = body.message as string;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
}

export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(`${AUTH_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error as string;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
}

export const auth = {
  login: (username: string, password: string) =>
    authFetch<Me>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => authFetch<{ ok: boolean }>("/logout", { method: "POST" }),
  me: () => authFetch<Me>("/me"),
};

// Calls the web backend's own endpoints (auth + self-service), distinct from the
// Headscale proxy. Requires the session cookie.
async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(`/ui/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error as string;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : undefined) as T;
}

export const self = {
  info: () => backendFetch<{ username: string; role: string; headscale_user: string; nodes?: unknown }>("/me"),
  createKey: (
    reusable: boolean,
    ephemeral: boolean,
    expiration_hours: number,
    headscale_user?: string,
    applicant?: string,
    device_desc?: string,
    org?: string,
  ) =>
    backendFetch<{
      key: string;
      server_url: string;
      headscale_user: string;
      commands: Record<string, string>;
      expiration_hours: number;
    }>("/me/preauthkey", {
      method: "POST",
      body: JSON.stringify({
        reusable,
        ephemeral,
        expiration_hours,
        headscale_user,
        applicant,
        device_desc,
        org,
      }),
    }),
  changePassword: (oldP: string, newP: string) =>
    backendFetch<{ ok: boolean }>("/me/password", {
      method: "POST",
      body: JSON.stringify({ old: oldP, new: newP }),
    }),
};

export const api = {
  listNodes: () => apiFetch<{ nodes: Node[] }>("/node"),
  deleteNode: (id: string) =>
    apiFetch<void>(`/node/${id}`, { method: "DELETE" }),
  expireNode: (id: string) =>
    apiFetch<{ node: Node }>(`/node/${id}/expire`, {
      method: "POST",
      body: "{}",
    }),
  renameNode: (id: string, name: string) =>
    apiFetch<{ node: Node }>(
      `/node/${id}/rename/${encodeURIComponent(name)}`,
      { method: "POST" },
    ),
  setNodeTags: (id: string, tags: string[]) =>
    apiFetch<{ node: Node }>(`/node/${id}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags }),
    }),

  listUsers: () => apiFetch<{ users: User[] }>("/user"),
  createUser: (name: string) =>
    apiFetch<{ user: User }>("/user", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteUser: (id: string) =>
    apiFetch<void>(`/user/${id}`, { method: "DELETE" }),

  listPreAuthKeys: () =>
    apiFetch<{ preAuthKeys: PreAuthKey[] }>("/preauthkey"),
  createPreAuthKey: (
    user: string,
    reusable: boolean,
    ephemeral: boolean,
    expiration?: string,
    aclTags?: string[],
  ) =>
    apiFetch<{ preAuthKey: PreAuthKey }>("/preauthkey", {
      method: "POST",
      body: JSON.stringify({ user, reusable, ephemeral, expiration, aclTags }),
    }),
  expirePreAuthKey: (id: string) =>
    apiFetch<void>("/preauthkey/expire", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  deletePreAuthKey: (id: string) =>
    apiFetch<void>(`/preauthkey?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  getPolicy: () => apiFetch<Policy>("/policy"),
  setPolicy: (policy: string) =>
    apiFetch<Policy>("/policy", {
      method: "PUT",
      body: JSON.stringify({ policy }),
    }),
  checkPolicy: (policy: string) =>
    apiFetch<void>("/policy/check", {
      method: "POST",
      body: JSON.stringify({ policy }),
    }),
};

// Web-backend admin-only endpoints (require the session cookie + admin role).
export const admin = {
  listInvites: () => backendFetch<Invite[]>("/admin/invites"),
  events: () => backendFetch<Event[]>("/admin/events"),
  mailSettings: () => backendFetch<MailSettingsResp>("/admin/settings/mail"),
  saveMailSettings: (m: MailSettings) =>
    backendFetch<MailSettingsResp>("/admin/settings/mail", {
      method: "PUT",
      body: JSON.stringify(m),
    }),
  testMail: (to: string) =>
    backendFetch<{ ok: boolean; error?: string }>("/admin/settings/mail/test", {
      method: "POST",
      body: JSON.stringify({ to }),
    }),
};
