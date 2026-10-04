"use client";
import { useState } from "react";
import { api, useApi } from "../../../lib/client";
import { field, btnDark, btnLight, btnGreen, Notice, Badge, when } from "../../../lib/ui";
import { wantedText } from "../../../lib/match";

const COLOR = { open: "amber", forwarded: "blue", replied: "green", closed: "slate" };

export default function Unfulfilled() {
  const { data, error, loading, reload } = useApi("/api/admin/unfulfilled");
  const [msg, setMsg] = useState({});
  const [replyFor, setReplyFor] = useState(null);
  const [text, setText] = useState("");
  const rows = data?.rows || [];

  const setStatus = (id, status) => api("/api/admin/unfulfilled", { method: "PATCH", body: { id, status } });
  async function run(fn, ok) {
    setMsg({});
    try { await fn(); setMsg({ ok }); await reload(); } catch (e) { setMsg({ error: e.message }); }
  }
  const copy = (r) =>
    run(async () => {
      await navigator.clipboard.writeText(wantedText(r.parsed, r.requirement_text));
      if (r.status === "open") await setStatus(r.id, "forwarded");
    }, "Copied. Paste it into your seller groups.");

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Unfulfilled requests</h1>
      <p className="mt-1 text-sm text-slate-600">Customers we could not match. Copy the wanted text, paste it in your seller groups, then reply to the customer here.</p>
      <Notice error={error || msg.error} ok={msg.ok} />
      {!loading && rows.length === 0 && <p className="mt-4 text-sm text-slate-500">Nothing here. Every request so far found a match.</p>}
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge color={COLOR[r.status]}>{r.status}</Badge>
              <span className="text-slate-500">{when(r.created_at)} · {r.channel || "whatsapp"} · {(r.channel || "whatsapp") === "instagram" ? "" : "+"}{r.customer_wa_id}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Customer wrote: {r.requirement_text}</p>
            <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm">{wantedText(r.parsed, r.requirement_text)}</p>
            {r.note && <p className="mt-2 text-xs text-slate-500">{r.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={btnDark} onClick={() => copy(r)}>Forward to seller groups (copy)</button>
              <button className={btnLight} onClick={() => { setReplyFor(replyFor === r.id ? null : r.id); setText(""); }}>Reply to customer</button>
              {r.status !== "closed" && <button className={btnLight} onClick={() => run(() => setStatus(r.id, "closed"), "Closed.")}>Close</button>}
            </div>
            {replyFor === r.id && (
              <div className="mt-3">
                <textarea className={`${field} h-24 w-full`} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Good news: Dell 7490 i5 16/256, 20 pcs at AED 680 each. Want me to connect you?" />
                <button className={`${btnGreen} mt-2`} onClick={() => run(async () => { await api("/api/admin/reply", { method: "POST", body: { request_id: r.id, text } }); setReplyFor(null); }, "Reply sent on WhatsApp.")}>Send on WhatsApp</button>
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
