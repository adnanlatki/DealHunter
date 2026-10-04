"use client";
import { useApi } from "../../../lib/client";
import { th, td, Notice, Badge, when } from "../../../lib/ui";

export default function Enquiries() {
  const { data, error, loading } = useApi("/api/admin/enquiries");
  const rows = data?.rows || [];
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Customer enquiries</h1>
      <Notice error={error} />
      {!loading && rows.length === 0 && <p className="mt-4 text-sm text-slate-500">No enquiries yet. Messages sent to your WhatsApp business number show up here.</p>}
      {rows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100"><tr>{["Time", "Customer", "Message", "AI reply", "Result"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-t border-slate-100">
                  <td className={`${td} whitespace-nowrap`}>{when(x.created_at)}</td>
                  <td className={td}>{x.customer_name || ""}<div className="text-xs text-slate-500">{x.channel || "whatsapp"} · {(x.channel || "whatsapp") === "instagram" ? "" : "+"}{x.customer_wa_id}</div></td>
                  <td className={`${td} max-w-xs`}>{x.message_text}</td>
                  <td className={`${td} max-w-sm`}>{x.reply_text}{x.reply_error && <div className="mt-1 text-xs text-red-700">Not delivered: {x.reply_error}</div>}</td>
                  <td className={td}>
                    {x.matched === true && <Badge color="green">Matched</Badge>}
                    {x.matched === false && <Badge color="amber">Not found</Badge>}
                    {x.connect_requested && <div className="mt-1"><Badge color="blue">Wants connect</Badge></div>}
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
