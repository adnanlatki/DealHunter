import { NextResponse } from "next/server";
import { withAdmin } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";
import { latestConsents } from "../../../../lib/match";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  const sb = db();
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 3600e3); // "today" in UAE time
  uae.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(uae.getTime() - 4 * 3600e3).toISOString();

  const count = async (q) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.count || 0; };
  const [active, today, open, platform, consents] = await Promise.all([
    count(sb.from("stock").select("id", { count: "exact", head: true }).eq("is_active", true).gt("expires_at", now.toISOString())),
    count(sb.from("enquiries").select("id", { count: "exact", head: true }).gte("created_at", todayStart)),
    count(sb.from("unfulfilled_requests").select("id", { count: "exact", head: true }).in("status", ["open", "forwarded"])),
    count(sb.from("sellers").select("id", { count: "exact", head: true }).eq("status", "approved")),
    sb.from("seller_consents").select("*").then(must),
  ]);
  const sellers = new Set(latestConsents(consents).filter((c) => c.consent_status === "YES" && !c.group_name.startsWith("Seller platform")).map((c) => c.seller_name.toLowerCase()));
  return NextResponse.json({ active_stock: active, sellers_yes: sellers.size, sellers_platform: platform, enquiries_today: today, unfulfilled_open: open });
});
