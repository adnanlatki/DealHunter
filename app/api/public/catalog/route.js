import { NextResponse } from "next/server";
import { searchStock } from "../../../../lib/search";
import { publicRow, siteEnabled } from "../../../../lib/public";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!siteEnabled()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  try {
    const p = new URL(req.url).searchParams;
    const filters = {
      brands: p.get("brand") ? [p.get("brand").slice(0, 40)] : [],
      cpu: p.get("cpu") ? p.get("cpu").slice(0, 20) : null,
      min_ram_gb: Number(p.get("min_ram")) || null,
      max_budget_aed: Number(p.get("max_price")) || null,
    };
    const rows = await searchStock(filters, 200);
    return NextResponse.json({ rows: rows.map(publicRow) });
  } catch (e) {
    console.error("catalog error:", e.message);
    return NextResponse.json({ error: "Could not load stock." }, { status: 500 });
  }
}
