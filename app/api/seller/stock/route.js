import { NextResponse } from "next/server";
import { withSeller } from "../../../../lib/seller-auth";
import { bad } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export const GET = withSeller(async (_req, seller) => {
  const rows = must(await db().from("stock").select("*").eq("seller_id", seller.id).order("created_at", { ascending: false }).limit(300));
  return NextResponse.json({ rows });
}, { needTerms: false });

// Renew one listing (id) or all recent ones (no id) for another 48h.
export const PATCH = withSeller(async (req, seller) => {
  const { id } = await req.json().catch(() => ({}));
  const exp = new Date(Date.now() + 48 * 3600e3).toISOString();
  let q = db().from("stock").update({ expires_at: exp, is_active: true }).eq("seller_id", seller.id);
  q = id ? q.eq("id", id) : q.gte("created_at", new Date(Date.now() - 7 * 24 * 3600e3).toISOString());
  return NextResponse.json({ renewed: must(await q.select("id")).length });
});

export const DELETE = withSeller(async (req, seller) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("Missing id.");
  must(await db().from("stock").delete().eq("id", id).eq("seller_id", seller.id).select("id"));
  return NextResponse.json({ ok: true });
}, { needTerms: false });
