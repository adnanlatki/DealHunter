import { NextResponse } from "next/server";
import { parseRequirement } from "../../../../lib/parser";
import { searchStock } from "../../../../lib/search";
import { publicRow, siteEnabled, rateLimited } from "../../../../lib/public";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The website's AI search bar: same brain as the WhatsApp bot, anonymized results.
export async function POST(req) {
  if (!siteEnabled()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  try {
    const { q } = await req.json();
    if (!q || !String(q).trim() || String(q).length > 300) return NextResponse.json({ error: "Type what you need (max 300 characters)." }, { status: 400 });
    if (await rateLimited(req, "search", 15)) return NextResponse.json({ error: "Too many searches. Please try again in a few minutes." }, { status: 429 });
    const requirement = await parseRequirement(String(q));
    const results = requirement.is_requirement ? await searchStock(requirement, 20) : [];
    return NextResponse.json({ requirement, results: results.map(publicRow) });
  } catch (e) {
    console.error("public search error:", e.message);
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 500 });
  }
}
