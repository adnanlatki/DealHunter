"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, supabase, useApi } from "../../lib/client";
import ReviewTable from "../../lib/ReviewTable";
import { field, btnDark, btnLight, btnGreen, btnRed, th, td, Notice, Badge, timeLeft } from "../../lib/ui";
import { specsOf } from "../../lib/match";

export default function SellerPortal() {
  const router = useRouter();
  const me = useApi("/api/seller/me");
  const stock = useApi("/api/seller/stock");
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({});

  const seller = me.data?.seller;
  const ready = seller?.status === "approved" && seller?.terms_accepted_at;
  const signOut = async () => { await supabase().auth.signOut(); router.replace("/seller/login"); };

  async function run(fn) {
    setBusy(true); setMsg({});
    try { await fn(); } catch (e) { setMsg({ error: e.message }); }
    setBusy(false);
  }

  const readStock = (file) => run(async () => {
    let payload = { text };
    if (file) {
      if (file.size > 3 * 1024 * 1024) throw new Error("File too large (max 3 MB).");
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      payload = { text, file: { name: file.name, data } };
    }
    const d = await api("/api/seller/parse", { method: "POST", body: payload });
    if (!d.items.length) throw new Error("No laptops found. Check the text or file.");
    setItems((p) => [...p, ...d.items]);
    setMsg({ ok: `Found ${d.items.length} item(s)${d.truncated ? " (first 300 lines only)" : ""}. Check the table, fix anything wrong, then publish.` });
  });

  const publish = () => run(async () => {
    const d = await api("/api/seller/publish", { method: "POST", body: { items } });
    setItems([]); setText("");
    setMsg({ ok: `Published ${d.saved} new, renewed ${d.renewed}${d.skipped ? `, ${d.skipped} skipped (no price/model)` : ""}. Live for 48 hours.` });
    await stock.reload();
  });

  const rows = stock.data?.rows || [];
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{seller ? seller.company_name : "Seller portal"}</h1>
        <button className={btnLight} onClick={signOut}>Sign out</button>
      </div>
      <Notice error={me.error} />

      {seller && !seller.terms_accepted_at && (
        <section className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Please accept the seller terms to start.</p>
          <p className="mt-2">{me.data.terms}</p>
          <button className={`${btnGreen} mt-3`} disabled={busy} onClick={() => run(async () => { await api("/api/seller/me", { method: "POST", body: { accept: true } }); await me.reload(); })}>I accept</button>
        </section>
      )}

      {ready && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Add or update stock</h2>
          <p className="mt-1 text-sm text-slate-600">Paste your list in any format, or upload a CSV / Excel (.xlsx) file. Posting the same item again renews it.</p>
          <textarea className={`${field} mt-3 h-32 w-full font-mono`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dell Latitude 7490 i5 8th 16/256 650 AED 10 Qty" />
          <div className="mt-3 flex flex-wrap gap-3">
            <button className={btnDark} disabled={busy || !text.trim()} onClick={() => readStock(null)}>{busy ? "Working..." : "Read my stock"}</button>
            <label className={`${btnLight} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
              Upload CSV / Excel
              <input type="file" accept=".csv,.xlsx" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readStock(f); }} />
            </label>
          </div>
          <Notice error={msg.error} ok={msg.ok} />
          {items.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Review ({items.length})</h3>
                <div className="flex gap-3">
                  <button className={btnLight} disabled={busy} onClick={() => setItems([])}>Clear</button>
                  <button className={btnGreen} disabled={busy} onClick={publish}>Publish {items.length}</button>
                </div>
              </div>
              <ReviewTable items={items} setItems={setItems} />
              {items.some((r) => !r.price_aed) && <p className="mt-2 text-sm text-red-700">Rows with a red price will be skipped.</p>}
            </div>
          )}
        </section>
      )}
      {!ready && seller && <Notice error={msg.error} />}

      {seller && (
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">My listings ({rows.length})</h2>
            {ready && <button className={btnLight} onClick={() => run(async () => { const d = await api("/api/seller/stock", { method: "PATCH", body: {} }); setMsg({ ok: `Renewed ${d.renewed} listing(s) for 48 hours.` }); await stock.reload(); })}>Renew all (48h)</button>}
          </div>
          {rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">No listings yet.</p> : (
            <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100"><tr>{["Item", "Specs", "Price AED", "Qty", "Status", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.id} className="border-t border-slate-100">
                      <td className={td}>{[x.brand, x.model].filter(Boolean).join(" ")}</td>
                      <td className={td}>{specsOf(x)}</td>
                      <td className={td}>{Number(x.price_aed).toLocaleString()}</td>
                      <td className={td}>{x.qty}</td>
                      <td className={td}><Badge color={timeLeft(x) === "Expired" ? "red" : "green"}>{timeLeft(x)}</Badge></td>
                      <td className={td}><button className={btnRed} onClick={() => confirm("Delete this listing?") && run(async () => { await api(`/api/seller/stock?id=${x.id}`, { method: "DELETE" }); await stock.reload(); })}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-6 text-xs text-slate-500">You can also manage stock by WhatsApp: send your list, then reply CONFIRM. RENEW keeps it live; STOP leaves the network.</p>
        </section>
      )}
    </main>
  );
}
