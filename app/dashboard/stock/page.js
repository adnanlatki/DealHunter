"use client";
import { useState } from "react";
import { api, useApi } from "../../../lib/client";
import { field, btnDark, btnLight, btnRed, th, td, Notice, Badge, when, timeLeft } from "../../../lib/ui";
import { specsOf } from "../../../lib/match";

export default function StockPage() {
  const [f, setF] = useState({ brand: "", q: "", show: "active" });
  const [applied, setApplied] = useState(f);
  const [msg, setMsg] = useState({});
  const { data, error, loading, reload } = useApi(`/api/admin/stock?${new URLSearchParams(applied)}`);
  const rows = data?.rows || [];

  async function act(fn) {
    setMsg({});
    try { await fn(); await reload(); } catch (e) { setMsg({ error: e.message }); }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Stock</h1>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setApplied(f); }}>
        <input className={field} placeholder="Brand (Dell, HP...)" value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} />
        <input className={field} placeholder="Search model, CPU, seller" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.show === "all"} onChange={(e) => setF({ ...f, show: e.target.checked ? "all" : "active" })} /> Include expired
        </label>
        <button className={btnDark}>Filter</button>
      </form>
      <Notice error={error || msg.error} />
      <p className="mt-4 text-sm text-slate-600">{loading ? "Loading..." : `${rows.length} item(s)`}</p>

      {rows.length === 0 && !loading ? (
        <p className="mt-3 text-sm text-slate-500">No stock found. Add some under Add stock.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100"><tr>
              {["Item", "Specs", "Price AED", "Qty", "Location", "Seller", "Group", "Expiry", ""].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-t border-slate-100">
                  <td className={td}>{[x.brand, x.model].filter(Boolean).join(" ")}</td>
                  <td className={td}>{specsOf(x)}</td>
                  <td className={td}>{Number(x.price_aed).toLocaleString()}</td>
                  <td className={td}>{x.qty}</td>
                  <td className={td}>{x.location}</td>
                  <td className={td}>{x.seller_name}</td>
                  <td className={td}>{x.source_group_name}</td>
                  <td className={td}><Badge color={timeLeft(x) === "Expired" ? "red" : "green"}>{timeLeft(x)}</Badge><div className="mt-1 text-xs text-slate-500">added {when(x.created_at)}</div></td>
                  <td className={`${td} whitespace-nowrap`}>
                    <button className={btnLight} onClick={() => act(() => api("/api/admin/stock", { method: "PATCH", body: { id: x.id, hours: 48 } }))}>Extend 48h</button>{" "}
                    <button className={btnRed} onClick={() => confirm("Delete this stock row?") && act(() => api(`/api/admin/stock?id=${x.id}`, { method: "DELETE" }))}>Delete</button>
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
