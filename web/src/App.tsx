import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { auth, type Me } from "./api/client";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Nodes from "./pages/Nodes";
import Users from "./pages/Users";
import PreAuthKeys from "./pages/PreAuthKeys";
import Policy from "./pages/Policy";
import SelfService from "./pages/SelfService";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-slate-400">Loading…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          me ? (
            <Navigate to="/" replace />
          ) : (
            <Login onLogin={() => auth.me().then(setMe)} />
          )
        }
      />
      {me ? (
        <Route element={<Layout me={me} onLogout={() => { setMe(null); }} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nodes" element={<Nodes />} />
          <Route path="/myself" element={<SelfService />} />
          {me.role === "admin" && (
            <>
              <Route path="/users" element={<Users />} />
              <Route path="/keys" element={<PreAuthKeys />} />
              <Route path="/policy" element={<Policy />} />
            </>
          )}
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
