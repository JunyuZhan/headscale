import { useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { auth, self, type Me } from "../api/client";
import { useI18n } from "../i18n";

const baseNav = [
  { to: "/", key: "Overview", end: true },
  { to: "/nodes", key: "Nodes", end: false },
  { to: "/myself", key: "My devices", end: false },
];

const adminNav = [
  { to: "/users", key: "Users", end: false },
  { to: "/keys", key: "Pre-auth keys", end: false },
  { to: "/policy", key: "ACL Policy", end: false },
  { to: "/invite", key: "Invite device", end: false },
];

export default function Layout({
  me,
  onLogout,
}: {
  me: Me;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const nav = me.role === "admin" ? [...baseNav, ...adminNav] : baseNav;

  const logout = async () => {
    try {
      await auth.logout();
    } catch {
      /* ignore */
    }
    onLogout();
    navigate("/login");
  };

  const [pwOpen, setPwOpen] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwMsg("");
    if (pwNew.length < 6) {
      setPwError(`${t("New password")} ≥ 6`);
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError(t("Confirm password") + " ⚠");
      return;
    }
    setPwBusy(true);
    try {
      await self.changePassword(pwOld, pwNew);
      setPwMsg(t("Password changed"));
      setPwOld("");
      setPwNew("");
      setPwConfirm("");
      setTimeout(() => setPwOpen(false), 1200);
    } catch (e) {
      setPwError((e as Error).message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 p-4 flex flex-col">
        <div className="text-brand-500 font-bold text-lg mb-6 px-2">
          Headscale
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 py-2 text-xs text-slate-500">
          {me.username} · {t(me.role)}
          {me.role === "user" && me.headscale_user
            ? ` · ${me.headscale_user}`
            : ""}
        </div>
        <button
          className="mt-2 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-slate-800 text-left"
          onClick={() => setPwOpen(true)}
        >
          {t("Change password")}
        </button>
        <button
          className="mt-2 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-slate-800 text-left"
          onClick={logout}
        >
          {t("Log out")}
        </button>
      </aside>

      {pwOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setPwOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-lg p-5 w-80 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">
              {t("Change password")}
            </h3>
            {pwError && <div className="text-red-400 text-sm">{pwError}</div>}
            {pwMsg && <div className="text-emerald-400 text-sm">{pwMsg}</div>}
            <form onSubmit={changePassword} className="space-y-2">
              <input
                type="password"
                value={pwOld}
                onChange={(e) => setPwOld(e.target.value)}
                placeholder={t("Old password")}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
              />
              <input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                placeholder={t("New password")}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
              />
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                placeholder={t("Confirm password")}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-slate-200"
              />
              <button
                type="submit"
                disabled={pwBusy}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {pwBusy ? t("Loading…") : t("Change password")}
              </button>
            </form>
          </div>
        </div>
      )}
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="text-xs text-slate-400 border border-slate-700 rounded px-2 py-1 hover:bg-slate-800"
            title="Language / 语言"
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
        <Outlet context={me} />
      </main>
    </div>
  );
}
