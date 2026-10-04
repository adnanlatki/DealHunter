const STOCK_PROMPT = `You extract laptop stock listings from WhatsApp seller messages or spreadsheet rows (UAE market, prices in AED).
Return ONLY JSON: {"items":[ ... ]} with one item per distinct laptop listing.
Each item has: brand (e.g. "Dell","HP","Lenovo","Apple"), model (e.g. "Latitude 7490","840 G5" - do not invent a model line not in the text), cpu (e.g. "i5","i7","Ryzen 5"), generation (e.g. "8th"), ram_gb (number), storage_gb (number; 1TB = 1024), storage_type ("SSD","HDD","NVMe" or null), price_aed (number, per unit, in AED), qty (number; "10 Qty","10pcs","x10" = 10; 1 if not stated), location (e.g. "Bur Dubai"), seller_name (person or company if stated), raw_text (the original line this item came from).
Rules: never invent data, use null when missing. "16/256" means 16GB RAM / 256GB storage. Ignore greetings and chit-chat. Never output phone numbers. If the price is not in AED set price_aed to null.`;

const REQ_PROMPT = `You read a customer's WhatsApp message to a laptop wholesaler in the UAE and extract their requirement.
Return ONLY JSON: {"is_requirement": boolean, "brands": string[], "cpu": string|null, "min_ram_gb": number|null, "min_storage_gb": number|null, "max_budget_aed": number|null, "qty_needed": number|null}
- is_requirement is true only if the customer wants to buy/find laptops. Greetings, thanks and unrelated messages are false.
- brands: ["Dell","HP"] for "Dell/HP"; [] if no brand is mentioned.
- cpu: "i5", "i7", "Ryzen 5" etc., or null.
- max_budget_aed is PER UNIT in AED. If the customer gives a total for N units, divide it by N.
- "20x", "20 pcs", "need 20" => qty_needed 20; null if not stated.
Never invent values.`;

export const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const toStr = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

export function normalizeItem(i) {
  return {
    brand: toStr(i.brand), model: toStr(i.model), cpu: toStr(i.cpu), generation: toStr(i.generation),
    ram_gb: toNum(i.ram_gb), storage_gb: toNum(i.storage_gb), storage_type: toStr(i.storage_type),
    price_aed: toNum(i.price_aed), qty: toNum(i.qty) ?? 1,
    location: toStr(i.location), seller_name: toStr(i.seller_name), raw_text: toStr(i.raw_text),
  };
}

export function normalizeRequirement(p) {
  return {
    is_requirement: p.is_requirement !== false,
    brands: Array.isArray(p.brands) ? p.brands.map(toStr).filter(Boolean) : [],
    cpu: toStr(p.cpu),
    min_ram_gb: toNum(p.min_ram_gb),
    min_storage_gb: toNum(p.min_storage_gb),
    max_budget_aed: toNum(p.max_budget_aed),
    qty_needed: toNum(p.qty_needed),
  };
}

async function chatJson(system, user, timeoutMs = 20000) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing in the environment variables.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } finally {
    clearTimeout(timer);
  }
}

export async function parseStockText(text) {
  const parsed = await chatJson(STOCK_PROMPT, text, 50000);
  return (Array.isArray(parsed.items) ? parsed.items : []).map(normalizeItem);
}

// Customer messages must be answered fast, so a short timeout.
export async function parseRequirement(text) {
  return normalizeRequirement(await chatJson(REQ_PROMPT, text, 8000));
}

// Many lines (a whole price list): parsed in small batches, a few at a time, in parallel.
export async function parseLines(lines, { batch = 15, concurrency = 5 } = {}) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += batch) chunks.push(lines.slice(i, i + batch).join("\n"));
  const out = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const res = await Promise.all(chunks.slice(i, i + concurrency).map((c) => parseStockText(c)));
    res.forEach((r) => out.push(...r));
  }
  return out;
}
