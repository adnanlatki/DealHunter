"use client";
import { useState } from "react";
import { api } from "../../../lib/client";
import { field, btnDark, th, td, Notice } from "../../../lib/ui";
import { specsOf, foundReply, NOT_FOUND_REPLY } from "../../../lib/match";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setError(null);
    try { setRes(await api(`/api/search-stock?q=${encodeURIComponent(q)}`)); } catch (x) { setError(x.message); }
    setBusy(false);
  }

  const r = res?.requirement;
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Search like a customer</h1>
      <p className="mt-1 text-sm text-slate-600">Type what a customer would send. You will see exactly what the bot would find and reply.</p>
      <form onSubmit={go} className="mt-4 flex gap-3">
        <input className={`${field} w-full max-w-xl`} placeholder="Need 20x Dell i5 16GB under AED 1500" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btnDark} disabled={busy}>{busy ? "Searching..." : "Search"}</button>
      </form>
      <Notice error={error} />
      {res && (
        <>
          <p className="mt-4 text-sm text-slate-600">
            Understood: {[r.qty_needed && `${r.qty_needed} pcs`, r.brands.join("/"), r.cpu, r.min_ram_gb && `${r.min_ram_gb}GB+ RAM`, r.min_storage_gb && `${r.min_storage_gb}GB+ storage`, r.max_budget_aed && `max AED ${r.max_budget_aed} each`].filter(Boolean).join(", ") || "nothing specific"}
          </p>
          <p className="mt-2 rounded border border-slate-200 bg-white p-3 text-sm">
            <span className="font-medium">Bot would reply: </span>
            {!r.is_requirement ? "(asks the customer what they need)" : res.results.length ? foundReply(res.results[0], r.qty_needed) : NOT_FOUND_REPLY}
          </p>
          {res.results.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100"><tr>{["Item", "Specs", "Price AED", "Qty", "Location", "Seller"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {res.results.map((x) => (
                    <tr key={x.id} className="border-t border-slate-100">
                      <td className={td}>{[x.brand, x.model].filter(Boolean).join(" ")}</td><td className={td}>{specsOf(x)}</td>
                      <td className={td}>{Number(x.price_aed).toLocaleString()}</td><td className={td}>{x.qty}</td>
                      <td className={td}>{x.location}</td><td className={td}>{x.seller_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
