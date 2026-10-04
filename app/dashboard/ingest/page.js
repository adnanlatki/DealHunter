"use client";
import { useState } from "react";
import Papa from "papaparse";
import { api, useApi } from "../../../lib/client";
import { field, btnDark, btnLight, btnGreen, Notice } from "../../../lib/ui";

const COLS = [
  ["brand", "Brand", "text", "w-24"], ["model", "Model", "text", "w-36"], ["cpu", "CPU", "text", "w-20"],
  ["generation", "Gen", "text", "w-16"], ["ram_gb", "RAM GB", "number", "w-20"], ["storage_gb", "Storage GB", "number", "w-24"],
  ["storage_type", "Type", "text", "w-20"], ["price_aed", "Price AED", "number", "w-24"], ["qty", "Qty", "number", "w-16"],
  ["location", "Location", "text", "w-28"], ["seller_name", "Seller", "text", "w-28"],
];

export default function IngestPage() {
  const [group, setGroup] = useState("");
  const [text, setText] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({});
  const consents = useApi("/api/admin/consents");
  const groups = [...new Set((consents.data?.rows || []).filter((c) => c.consent_status === "YES").map((c) => c.group_name))];

  const parse = (chunk) => api("/api/parse", { method: "POST", body: { text: chunk } }).then((d) => d.items);

  async function parseMessage() {
    if (!text.trim()) return setMsg({ error: "Paste a stock message first." });
    setBusy(true); setMsg({});
    try {
      const found = await parse(text);
      if (!found.length) setMsg({ error: "No laptops found in that text." });
      else { setItems((p) => [...p, ...found]); setText(""); setMsg({ ok: `Found ${found.length} item(s). Check the table, fix anything wrong, then save.` }); }
    } catch (e) { setMsg({ error: e.message }); }
    setBusy(false);
  }

  function onCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        const lines = data.map((row) => Object.entries(row).filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${v}`).join(", ")).filter(Boolean);
        if (!lines.length) return setMsg({ error: "That CSV has no rows." });
        setBusy(true);
        try {
          const all = [];
          for (let i = 0; i < lines.length; i += 15) {
            setMsg({ info: `Parsing rows ${i + 1}-${Math.min(i + 15, lines.length)} of ${lines.length}...` });
            all.push(...(await parse(lines.slice(i, i + 15).join("\n"))));
          }
          setItems((p) => [...p, ...all]);
          setMsg({ ok: `Found ${all.length} item(s) from ${lines.length} rows. Check the table, then save.` });
        } catch (err) { setMsg({ error: err.message }); }
        setBusy(false);
      },
    });
  }

  const edit = (idx, key, type, val) =>
    setItems((p) => p.map((r, i) => (i === idx ? { ...r, [key]: type === "number" ? (val === "" ? null : Number(val)) : val } : r)));

  async function save() {
    setBusy(true); setMsg({});
    try {
      const d = await api("/api/stock", { method: "POST", body: { items, source_group_name: group } });
      setItems([]);
      const extra = [d.renewed && `${d.renewed} renewed`, d.skipped && `${d.skipped} skipped (no model/price)`, d.blocked && `${d.blocked} blocked (seller withdrew consent)`].filter(Boolean).join(", ");
      setMsg({ ok: `Saved ${d.saved} new item(s)${extra ? ", " + extra : ""}. Stock lasts 48 hours.` });
    } catch (e) { setMsg({ error: e.message }); }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Add stock</h1>
      <p className="mt-1 text-sm text-slate-600">Paste a stock message you copied from a seller group, or upload a CSV. Check the table, then save.</p>

      <label className="mt-6 block max-w-md text-sm">
        <span className="mb-1 block font-medium">Source group (must have seller consent)</span>
        <input list="groups" className={`${field} w-full`} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Dubai Laptop Traders" />
        <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </label>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium">Stock message</span>
        <textarea className={`${field} h-36 w-full font-mono`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Dell 7490 i5 8th 16GB/256GB - 650 AED - 10 Qty - Bur Dubai - Khalid" />
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={parseMessage} disabled={busy} className={btnDark}>{busy ? "Working..." : "Parse with AI"}</button>
        <label className={`${btnLight} cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          Upload CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} disabled={busy} />
        </label>
      </div>

      {msg.info && <p className="mt-4 rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{msg.info}</p>}
      <Notice error={msg.error} ok={msg.ok} />

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Review ({items.length})</h2>
          {items.length > 0 && (
            <div className="flex gap-3">
              <button onClick={() => setItems([])} disabled={busy} className={btnLight}>Clear all</button>
              <button onClick={save} disabled={busy} className={btnGreen}>Save {items.length} to stock</button>
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing to review yet. Parse a message or upload a CSV to see items here.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>{COLS.map(([k, label]) => <th key={k} className="whitespace-nowrap px-2 py-2 font-medium">{label}</th>)}<th /></tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    {COLS.map(([k, , type, w]) => (
                      <td key={k} className="px-1 py-1">
                        <input type={type} value={row[k] ?? ""} onChange={(e) => edit(idx, k, type, e.target.value)}
                          className={`${w} rounded border border-transparent px-2 py-1 hover:border-slate-300 focus:border-slate-900 focus:outline-none ${k === "price_aed" && !row.price_aed ? "bg-red-50" : ""}`} />
                      </td>
                    ))}
                    <td className="px-2 py-1"><button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-700">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {items.some((r) => !r.price_aed) && <p className="mt-2 text-sm text-red-700">Rows with a red price have no price. Add one, or they are skipped on save.</p>}
      </section>
    </main>
  );
}
