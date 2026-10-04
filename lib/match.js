// Pure helpers (no external imports) so they are easy to test.
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const fmt = (n) => Number(n).toLocaleString("en-US");

export function filterAndRank(rows, r, limit = 5) {
  const brands = (r.brands || []).map(norm).filter(Boolean);
  const cpu = norm(r.cpu);
  const out = rows.filter((x) => {
    if (r.max_budget_aed && !(x.price_aed <= r.max_budget_aed)) return false;
    if (r.min_ram_gb && !(x.ram_gb >= r.min_ram_gb)) return false;
    if (r.min_storage_gb && !(x.storage_gb >= r.min_storage_gb)) return false;
    if (brands.length) {
      const hay = norm(`${x.brand} ${x.model}`);
      if (!brands.some((b) => hay.includes(b))) return false;
    }
    if (cpu && !norm(x.cpu).includes(cpu)) return false;
    return true;
  });
  const need = r.qty_needed || 1;
  out.sort((a, b) => (b.qty >= need) - (a.qty >= need) || a.price_aed - b.price_aed);
  return out.slice(0, limit);
}

export function modelName(x) {
  return [x.brand, x.model].filter(Boolean).join(" ");
}

export function specsOf(x) {
  const cpu = x.cpu ? (x.generation ? `${x.cpu} ${x.generation}` : x.cpu) : null;
  const mem = x.ram_gb && x.storage_gb
    ? `${x.ram_gb}GB/${x.storage_gb}GB${x.storage_type ? " " + x.storage_type : ""}`
    : x.ram_gb ? `${x.ram_gb}GB RAM` : null;
  return [cpu, mem].filter(Boolean).join(" ");
}

export const NOT_FOUND_REPLY = "Noted. Checking with our seller network. I will update you in 10 mins with best offers.";
export const HELP_REPLY = "Hi! Tell me what laptops you need, for example: Need 20x Dell i5 16GB under AED 1500";

export function foundReply(x, need) {
  let t = `Available ✅ ${modelName(x)} ${specsOf(x)} - ${x.qty} pcs at AED ${fmt(x.price_aed)} from trusted seller${x.location ? " in " + x.location : ""}.`;
  if (need && x.qty < need) t += ` (You asked for ${need}; this lot has ${x.qty}. I will check the network for more.)`;
  return `${t} Want me to connect you directly on WhatsApp? Reply YES`;
}

// Text the admin copies and pastes into seller groups.
export function wantedText(p, raw) {
  if (!p) return raw;
  const bits = [
    p.qty_needed ? `${p.qty_needed}x` : null,
    (p.brands || []).join("/") || null,
    p.cpu,
    p.min_ram_gb ? `${p.min_ram_gb}GB+ RAM` : null,
    p.min_storage_gb ? `${p.min_storage_gb}GB+ storage` : null,
  ].filter(Boolean);
  if (!bits.length) return raw;
  const budget = p.max_budget_aed ? `, budget AED ${fmt(p.max_budget_aed)} per piece` : "";
  return `WANTED: ${bits.join(" ")} laptops${budget}. Reply with model, specs, qty and best price.`;
}

// Same listing from the same seller = renew instead of duplicate.
export function stockKey(x) {
  return [x.brand, x.model, x.cpu, x.generation, x.ram_gb, x.storage_gb, x.seller_name].map(norm).join("|");
}

// Latest decision per seller + group (consent log keeps history; newest row wins).
export function latestConsents(rows) {
  const m = new Map();
  const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  for (const r of sorted) m.set(`${r.group_name}|${r.seller_name}`.toLowerCase(), r);
  return [...m.values()];
}

// What the bot reads back to a seller before anything is published.
export function draftSummary(items) {
  const ok = items.filter((x) => (x.brand || x.model) && x.price_aed > 0);
  const bad = items.length - ok.length;
  const lines = ok.slice(0, 10).map((x, i) => `${i + 1}) ${modelName(x)} ${specsOf(x)} - AED ${fmt(x.price_aed)} x${x.qty ?? 1}`);
  if (ok.length > 10) lines.push(`...and ${ok.length - 10} more`);
  let t = `I read ${ok.length} item(s):\n${lines.join("\n")}`;
  if (bad) t += `\n⚠ ${bad} item(s) have no price or model and will be skipped.`;
  return `${t}\n\nReply CONFIRM to publish (live for 48 hours) or CANCEL.`;
}
