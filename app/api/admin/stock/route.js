import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (req) => {
  const p = new URL(req.url).searchParams;
  const brand = (p.get("brand") || "").replace(/[,()%*]/g, "").trim();
  const s = (p.get("q") || "").replace(/[,()%*]/g, "").trim();
  let q = db().from("stock").select("*").order("created_at", { ascending: false }).limit(300);
  if (p.get("show") !== "all") q = q.eq("is_active", true).gt("expires_at", new Date().toISOString());
  if (brand) q = q.ilike("brand", `%${brand}%`);
  if (s) q = q.or(`model.ilike.%${s}%,cpu.ilike.%${s}%,seller_name.ilike.%${s}%,brand.ilike.%${s}%`);
  return NextResponse.json({ rows: must(await q) });
});

// Extend expiry (renew)
export const PATCH = withAdmin(async (req) => {
  const { id, hours = 48 } = await req.json();
  if (!id) return bad("Missing id.");
  const exp = new Date(Date.now() + Number(hours) * 3600e3).toISOString();
  must(await db().from("stock").update({ expires_at: exp, is_active: true }).eq("id", id).select("id"));
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin(async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("Missing id.");
  must(await db().from("stock").delete().eq("id", id).select("id"));
  return NextResponse.json({ ok: true });
});
