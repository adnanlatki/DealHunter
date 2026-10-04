"use client";
import { useState } from "react";
import { api, useApi } from "../../../lib/client";
import { field, btnDark, btnRed, th, td, Notice, Badge, when } from "../../../lib/ui";

const EMPTY = { seller_name: "", seller_whatsapp: "", group_name: "", consent_status: "YES", proof_screenshot_url: "", notes: "" };

export default function Consents() {
  const { data, error, loading, reload } = useApi("/api/admin/consents");
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState({});
  const rows = data?.rows || [];

  async function add(body, ok) {
    setMsg({});
    try { await api("/api/admin/consents", { method: "POST", body }); setF(EMPTY); setMsg({ ok }); await reload(); }
    catch (e) { setMsg({ error: e.message }); }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Seller consent log</h1>
      <p className="mt-1 text-sm text-slate-600">Record every seller who replied YES in a group. Stock can only be added from groups with at least one YES here. Withdrawals are added as new NO rows, so history is kept.</p>

      <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add(f, "Consent recorded."); }}>
        <input required className={field} placeholder="Seller name" value={f.seller_name} onChange={set("seller_name")} />
        <input required className={field} placeholder="Group name" value={f.group_name} onChange={set("group_name")} />
        <input className={field} placeholder="Seller WhatsApp (optional)" value={f.seller_whatsapp} onChange={set("seller_whatsapp")} />
        <input className={field} placeholder="Proof screenshot link (optional)" value={f.proof_screenshot_url} onChange={set("proof_screenshot_url")} />
        <select className={field} value={f.consent_status} onChange={set("consent_status")}><option>YES</option><option>NO</option></select>
        <input className={field} placeholder="Notes (optional)" value={f.notes} onChange={set("notes")} />
        <div><button className={btnDark}>Add to consent log</button></div>
      </form>
      <Notice error={error || msg.error} ok={msg.ok} />

      {!loading && rows.length === 0 && <p className="mt-6 text-sm text-slate-500">No consents recorded yet. Add your first seller above.</p>}
      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100"><tr>{["Date", "Seller", "Group", "Status", "Proof", "Notes", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className={`${td} whitespace-nowrap`}>{when(c.created_at)}</td>
                  <td className={td}>{c.seller_name}{c.seller_whatsapp && <div className="text-xs text-slate-500">{c.seller_whatsapp}</div>}</td>
                  <td className={td}>{c.group_name}</td>
                  <td className={td}><Badge color={c.consent_status === "YES" ? "green" : "red"}>{c.consent_status}</Badge></td>
                  <td className={td}>{c.proof_screenshot_url && <a className="text-sky-700 underline" href={c.proof_screenshot_url} target="_blank" rel="noreferrer">View</a>}</td>
                  <td className={td}>{c.notes}</td>
                  <td className={td}>
                    {c.consent_status === "YES" && (
                      <button className={btnRed} onClick={() => confirm(`Record that ${c.seller_name} withdrew consent?`) && add({ ...c, consent_status: "NO", notes: "Consent withdrawn" }, "Withdrawal recorded.")}>Withdraw</button>
                    )}
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
