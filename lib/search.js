import { db, must } from "./supabase";
import { filterAndRank } from "./match";

// Only live stock: switched on AND not past its 48h expiry (checked at search time too).
export async function searchStock(req, limit = 5) {
  const rows = must(
    await db().from("stock").select("*").eq("is_active", true).gt("expires_at", new Date().toISOString()).limit(2000)
  );
  return filterAndRank(rows, req, limit);
}
