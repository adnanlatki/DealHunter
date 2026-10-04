import { NextResponse } from "next/server";
import { db, must } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

// Vercel Cron calls this automatically (see vercel.json). Housekeeping:
// switch off stock past its 48h, expire old WhatsApp drafts, prune the website rate-limit log.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sb = db();
  const now = new Date().toISOString();
  const day = new Date(Date.now() - 24 * 3600e3).toISOString();
  const rows = must(await sb.from("stock").update({ is_active: false }).eq("is_active", true).lt("expires_at", now).select("id"));
  const drafts = must(await sb.from("inventory_drafts").update({ status: "expired" }).eq("status", "pending").lt("created_at", day).select("id"));
  must(await sb.from("rate_hits").delete().lt("created_at", day).select("id"));
  return NextResponse.json({ expired: rows.length, drafts_expired: drafts.length });
}
