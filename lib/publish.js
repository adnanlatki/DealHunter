import { must } from "./supabase";
import { normalizeItem } from "./parser";
import { stockKey } from "./match";

// The ONE place stock enters the master inventory (admin paste, seller portal, WhatsApp CONFIRM).
// New listing -> insert. Same listing already live from the same seller -> renew (new price/qty, new 48h).
export async function publishItems(sb, items, o = {}) {
  const { sellerId = null, sellerName = null, sellerWhatsapp = null, group = null, source = "admin", blockedNames = new Set() } = o;

  const live = must(
    await sb.from("stock").select("id,brand,model,cpu,generation,ram_gb,storage_gb,seller_name").eq("is_active", true).gt("expires_at", new Date().toISOString())
  );
  const liveByKey = new Map(live.map((x) => [stockKey(x), x.id]));

  const fresh = [], renew = [];
  let skipped = 0, blocked = 0;
  for (const raw of items) {
    const r = normalizeItem(raw);
    if (sellerName) r.seller_name = sellerName; // trust the account, not the text
    if (r.seller_name && blockedNames.has(r.seller_name.toLowerCase())) { blocked++; continue; }
    if (!(r.brand || r.model) || !(r.price_aed > 0)) { skipped++; continue; }
    const key = stockKey(r);
    if (liveByKey.has(key)) renew.push({ id: liveByKey.get(key), r });
    else {
      fresh.push({ ...r, seller_id: sellerId, seller_whatsapp: sellerWhatsapp, source_group_name: group, source });
      liveByKey.set(key, "pending");
    }
  }

  const exp = new Date(Date.now() + 48 * 3600e3).toISOString();
  if (fresh.length) must(await sb.from("stock").insert(fresh).select("id"));
  await Promise.all(
    renew.filter((x) => x.id !== "pending").map(async ({ id, r }) =>
      must(await sb.from("stock").update({ price_aed: r.price_aed, qty: r.qty, expires_at: exp, is_active: true, raw_text: r.raw_text }).eq("id", id).select("id"))
    )
  );
  return { saved: fresh.length, renewed: renew.length, skipped, blocked };
}
