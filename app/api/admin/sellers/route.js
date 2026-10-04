import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";
import { toStr } from "../../../../lib/parser";
import { normalizePhone } from "../../../../lib/text";
import { withdrawSeller } from "../../../../lib/sellers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  const sb = db();
  const sellers = must(await sb.from("sellers").select("*").order("created_at", { ascending: false }));
  const live = must(await sb.from("stock").select("seller_id").eq("is_active", true).gt("expires_at", new Date().toISOString()).not("seller_id", "is", null));
  const counts = {};
  live.forEach((x) => (counts[x.seller_id] = (counts[x.seller_id] || 0) + 1));
  return NextResponse.json({ rows: sellers.map((s) => ({ ...s, live_listings: counts[s.id] || 0 })) });
});

// Onboard a seller. Email + password are optional: leave them empty for WhatsApp-only sellers.
export const POST = withAdmin(async (req) => {
  const b = await req.json();
  const company = toStr(b.company_name);
  const phone = normalizePhone(b.whatsapp);
  const email = toStr(b.email)?.toLowerCase() || null;
  const password = toStr(b.password);
  if (!company) return bad("Company name is required.");
  if (phone.length < 11 || phone.length > 15) return bad("Enter the WhatsApp number with country code, e.g. +971 50 123 4567.");
  if (password && (!email || password.length < 8)) return bad("For portal login enter an email and a password of at least 8 characters.");

  const sb = db();
  let authId = null;
  if (email && password) {
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return bad(error.message);
    authId = data.user.id;
  }
  const { error } = await sb.from("sellers").insert({ company_name: company, contact_name: toStr(b.contact_name), whatsapp: phone, email, auth_user_id: authId, status: "approved" });
  if (error) {
    if (authId) await sb.auth.admin.deleteUser(authId);
    return bad(error.code === "23505" ? "A seller with this WhatsApp number already exists." : error.message);
  }
  return NextResponse.json({ ok: true });
});

// Approve again / suspend. Suspending switches off all of that seller's stock and logs it.
export const PATCH = withAdmin(async (req) => {
  const { id, status } = await req.json();
  if (!id || !["approved", "suspended"].includes(status)) return bad("Bad request.");
  const sb = db();
  const seller = must(await sb.from("sellers").select("*").eq("id", id).single());
  if (status === "suspended") await withdrawSeller(sb, seller, "admin");
  else must(await sb.from("sellers").update({ status: "approved" }).eq("id", id).select("id"));
  return NextResponse.json({ ok: true });
});
