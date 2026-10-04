"use client";
import Link from "next/link";
import { useApi } from "../../lib/client";
import { Notice } from "../../lib/ui";

const CARDS = [
  ["active_stock", "Active stock", "/dashboard/stock"],
  ["sellers_platform", "Approved sellers (platform)", "/dashboard/sellers"],
  ["sellers_yes", "Group consents (YES)", "/dashboard/consents"],
  ["enquiries_today", "Customer enquiries today", "/dashboard/enquiries"],
  ["unfulfilled_open", "Unfulfilled requests", "/dashboard/unfulfilled"],
];

export default function Overview() {
  const { data, error, loading } = useApi("/api/admin/stats");
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <Notice error={error} />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {CARDS.map(([k, label, href]) => (
          <Link key={k} href={href} className="rounded border border-slate-200 bg-white p-4 hover:border-slate-400">
            <div className="text-3xl font-semibold">{loading ? "-" : data?.[k] ?? 0}</div>
            <div className="mt-1 text-sm text-slate-600">{label}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
