import { NextResponse } from "next/server";
import { bad } from "../../../../lib/admin";
import { db } from "../../../../lib/supabase";
import { getSellerCtx } from "../../../../lib/seller-auth";
import { acceptTerms } from "../../../../lib/sellers";
import { TERMS_SHORT } from "../../../../lib/terms";

export const dynamic = "force-dynamic";

async function who(req) {
  const { user, seller } = await getSellerCtx(req);
  if (!user) return { err: bad("Please sign in.", 401) };
  if (!seller) return { err: bad("This account is not a seller account.", 403) };
  return { seller };
}

export async function GET(req) {
  try {
    const { seller, err } = await who(req);
    if (err) return err;
    const { company_name, status, terms_accepted_at, whatsapp } = seller;
    return NextResponse.json({ seller: { company_name, status, terms_accepted_at, whatsapp }, terms: TERMS_SHORT });
  } catch (e) { return bad(e.message, 500); }
}

export async function POST(req) {
  try {
    const { seller, err } = await who(req);
    if (err) return err;
    const { accept } = await req.json();
    if (!accept) return bad("Nothing to do.");
    if (seller.status !== "approved") return bad("Your seller account is not active. Contact support.", 403);
    if (!seller.terms_accepted_at) await acceptTerms(db(), seller, "seller portal");
    return NextResponse.json({ ok: true });
  } catch (e) { return bad(e.message, 500); }
}
