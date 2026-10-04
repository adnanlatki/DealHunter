import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";
import { toStr } from "../../../../lib/parser";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  const rows = must(await db().from("seller_consents").select("*").order("created_at", { ascending: false }).limit(500));
  return NextResponse.json({ rows });
});

// Log a consent decision. History is never overwritten: a withdrawal is a new NO row.
export const POST = withAdmin(async (req) => {
  const b = await req.json();
  const row = {
    seller_name: toStr(b.seller_name),
    seller_whatsapp: toStr(b.seller_whatsapp),
    group_name: toStr(b.group_name),
    consent_status: b.consent_status,
    proof_screenshot_url: toStr(b.proof_screenshot_url),
    notes: toStr(b.notes),
  };
  if (!row.seller_name || !row.group_name) return bad("Seller name and group name are required.");
  if (!["YES", "NO"].includes(row.consent_status)) return bad("Consent must be YES or NO.");
  must(await db().from("seller_consents").insert(row).select("id"));
  return NextResponse.json({ ok: true });
});
