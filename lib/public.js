import crypto from "crypto";
import { db } from "./supabase";

export const siteEnabled = () => (process.env.PUBLIC_SITE_ENABLED || "true").toLowerCase() !== "false";

// Public visitors never see seller names, numbers, groups or raw messages.
export const publicRow = (x) => ({
  id: x.id, brand: x.brand, model: x.model, cpu: x.cpu, generation: x.generation,
  ram_gb: x.ram_gb, storage_gb: x.storage_gb, storage_type: x.storage_type,
  price_aed: x.price_aed, qty: x.qty, location: x.location,
});

// Best-effort abuse limit: max N hits per bucket per IP in the last few minutes.
export async function rateLimited(req, bucket, max, minutes = 10) {
  const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  const key = `${bucket}:${crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
  const sb = db();
  const since = new Date(Date.now() - minutes * 60e3).toISOString();
  const r = await sb.from("rate_hits").select("id", { count: "exact", head: true }).eq("key", key).gte("created_at", since);
  if (r.error) throw new Error(r.error.message);
  if ((r.count || 0) >= max) return true;
  await sb.from("rate_hits").insert({ key });
  return false;
}
