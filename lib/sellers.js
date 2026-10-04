import { must } from "./supabase";
import { TERMS_VERSION } from "./terms";

// Accepting terms is logged in the consent log, same as group consents.
export async function acceptTerms(sb, seller, via) {
  must(await sb.from("sellers").update({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() }).eq("id", seller.id).select("id"));
  must(await sb.from("seller_consents").insert({
    seller_name: seller.company_name, seller_whatsapp: seller.whatsapp,
    group_name: `Seller platform (terms v${TERMS_VERSION})`, consent_status: "YES", notes: `Accepted via ${via}`,
  }).select("id"));
}

// Leaving the network: account suspended, stock switched off, terms must be re-accepted if they return.
export async function withdrawSeller(sb, seller, via) {
  must(await sb.from("sellers").update({ status: "suspended", terms_accepted_at: null }).eq("id", seller.id).select("id"));
  must(await sb.from("stock").update({ is_active: false }).eq("seller_id", seller.id).select("id"));
  must(await sb.from("seller_consents").insert({
    seller_name: seller.company_name, seller_whatsapp: seller.whatsapp,
    group_name: `Seller platform (terms v${TERMS_VERSION})`, consent_status: "NO", notes: `Withdrawn via ${via}`,
  }).select("id"));
}
