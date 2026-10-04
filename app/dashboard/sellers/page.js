"use client";
import { useState } from "react";
import { api, useApi } from "../../../lib/client";
import { field, btnDark, btnLight, btnRed, th, td, Notice, Badge, when } from "../../../lib/ui";

const EMPTY = { company_name: "", contact_name: "", whatsapp: "", email: "", password: "" };

export default function Sellers() {
  const { data, error, loading, reload } = useApi("/api/admin/sellers");
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState({});
  const rows = data?.rows || [];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function run(fn, ok) {
    setMsg({});
    try { await fn(); setMsg({ ok }); await reload(); } catch (e) { setMsg({ error: e.message }); }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Sellers</h1>
      <p className="mt-1 text-sm text-slate-600">
        Onboard sellers here. Their WhatsApp number lets them send stock to your seller number; an email and password also gives them the web portal at /seller/login. Sellers accept the terms on first use (portal or by replying AGREE on WhatsApp).
      </p>

      <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api("/api/admin/sellers", { method: "POST", body: f }); setF(EMPTY); }, "Seller added."); }}>
        <input required className={field} placeholder="Company name" value={f.company_name} onChange={set("company_name")} />
        <input className={field} placeholder="Contact person" value={f.contact_name} onChange={set("contact_name")} />
        <input required className={field} placeholder="WhatsApp number (+971...)" value={f.whatsapp} onChange={set("whatsapp")} />
        <input className={field} type="email" placeholder="Portal email (optional)" value={f.email} onChange={set("email")} />
        <input className={field} type="text" placeholder="Portal password, 8+ chars (optional)" value={f.password} onChange={set("password")} />
        <div><button className={btnDark}>Add seller</button></div>
      </form>
      <Notice error={error || msg.error} ok={msg.ok} />

      {!loading && rows.length === 0 && <p className="mt-6 text-sm text-slate-500">No sellers yet. Add your first one above.</p>}
      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100"><tr>{["Company", "WhatsApp", "Portal login", "Terms", "Live listings", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className={td}>{s.company_name}<div className="text-xs text-slate-500">{s.contact_name}</div></td>
                  <td className={td}>+{s.whatsapp}</td>
                  <td className={td}>{s.auth_user_id ? s.email : "WhatsApp only"}</td>
                  <td className={td}>{s.terms_accepted_at ? <Badge color="green">{when(s.terms_accepted_at)}</Badge> : <Badge color="amber">Not yet</Badge>}</td>
                  <td className={td}>{s.live_listings}</td>
                  <td className={td}><Badge color={s.status === "approved" ? "green" : "red"}>{s.status}</Badge></td>
                  <td className={td}>
                    {s.status === "approved"
                      ? <button className={btnRed} onClick={() => confirm(`Suspend ${s.company_name}? Their stock is switched off.`) && run(() => api("/api/admin/sellers", { method: "PATCH", body: { id: s.id, status: "suspended" } }), "Seller suspended.")}>Suspend</button>
                      : <button className={btnLight} onClick={() => run(() => api("/api/admin/sellers", { method: "PATCH", body: { id: s.id, status: "approved" } }), "Seller re-approved. They must accept the terms again.")}>Re-approve</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
