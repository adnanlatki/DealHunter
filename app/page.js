"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { field, btnDark, btnLight, btnGreen, th, td, Notice } from "../lib/ui";
import { specsOf } from "../lib/match";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Something went wrong.");
  return d;
}

export default function PublicHome() {
  const [q, setQ] = useState("");
  const [f, setF] = useState({ brand: "", cpu: "", min_ram: "", max_price: "" });
  const [rows, setRows] = useState([]);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lead, setLead] = useState({ name: "", phone: "", note: "" });
  const [sent, setSent] = useState(null);

  async function loadCatalog(filters) {
    setBusy(true); setError(null); setSelected(null);
    try {
      const p = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const res = await fetch(`/api/public/catalog?${p}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load stock.");
      setRows(d.rows);
      setInfo(`${d.rows.length} item(s) in stock`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }
  useEffect(() => { loadCatalog({ brand: "", cpu: "", min_ram: "", max_price: "" }); }, []);

  async function aiSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setError(null); setSelected(null);
    try {
      const d = await post("/api/public/search", { q });
      setRows(d.results);
      setInfo(!d.requirement.is_requirement
        ? "Tell us what laptops you need, for example: Need 20x Dell i5 16GB under AED 1500"
        : d.results.length ? `${d.results.length} match(es) for your request.` : "No match right now. Leave your number below and we will find it for you.");
    } catch (x) { setError(x.message); }
    setBusy(false);
  }

  async function submitLead(e) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/public/enquiry", { ...lead, stock_id: selected?.id, query: q });
      setSent("Thank you! We will contact you on WhatsApp shortly.");
      setLead({ name: "", phone: "", note: "" });
      setSelected(null);
    } catch (x) { setError(x.message); }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-3xl font-semibold">Deal Hunter</h1>
      <p className="mt-1 text-slate-600">Wholesale laptop stock from trusted sellers, refreshed daily.</p>

      <form onSubmit={aiSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input className={`${field} w-full`} placeholder="Tell us what you need: Need 20x Dell i5 16GB under AED 1500" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} />
        <button className={btnDark} disabled={busy}>{busy ? "Searching..." : "Search"}</button>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); loadCatalog(f); }} className="mt-4 flex flex-wrap items-end gap-3">
        <input className={field} placeholder="Brand" value={f.brand} onChange={set("brand")} />
        <input className={field} placeholder="CPU (i5, i7...)" value={f.cpu} onChange={set("cpu")} />
        <select className={field} value={f.min_ram} onChange={set("min_ram")}>
          <option value="">Any RAM</option>{[4, 8, 16, 32].map((n) => <option key={n} value={n}>{n}GB+</option>)}
        </select>
        <input className={field} type="number" placeholder="Max price AED" value={f.max_price} onChange={set("max_price")} />
        <button className={btnLight} disabled={busy}>Filter stock</button>
      </form>

      <Notice error={error} ok={sent} />
      <p className="mt-4 text-sm text-slate-600">{info}</p>

      {rows.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100"><tr>{["Item", "Specs", "Price AED", "Qty", "Location", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className={`border-t border-slate-100 ${selected?.id === x.id ? "bg-emerald-50" : ""}`}>
                  <td className={td}>{[x.brand, x.model].filter(Boolean).join(" ")}</td>
                  <td className={td}>{specsOf(x)}</td>
                  <td className={td}>{Number(x.price_aed).toLocaleString()}</td>
                  <td className={td}>{x.qty}</td>
                  <td className={td}>{x.location}</td>
                  <td className={td}><button className={btnLight} onClick={() => { setSelected(x); setSent(null); }}>Enquire</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8 max-w-xl rounded border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Interested? We will connect you.</h2>
        {selected && <p className="mt-1 text-sm text-slate-600">About: {[selected.brand, selected.model].filter(Boolean).join(" ")} {specsOf(selected)}</p>}
        <form onSubmit={submitLead} className="mt-3 space-y-3">
          <input className={`${field} w-full`} placeholder="Your name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
          <input required className={`${field} w-full`} placeholder="Your WhatsApp number (with country code)" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
          <textarea className={`${field} h-20 w-full`} placeholder="What do you need? (quantity, specs, budget)" value={lead.note} onChange={(e) => setLead({ ...lead, note: e.target.value })} />
          <button className={btnGreen}>Send request</button>
        </form>
      </section>

      <footer className="mt-10 text-xs text-slate-500">
        <Link href="/seller/login" className="underline">Seller login</Link> · <Link href="/login" className="underline">Staff login</Link>
      </footer>
    </main>
  );
}
