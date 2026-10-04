import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../lib/admin";
import { parseRequirement } from "../../../lib/parser";
import { searchStock } from "../../../lib/search";

export const dynamic = "force-dynamic";

// GET /api/search-stock?q=Dell i5 16GB under 1500   (admin only)
export const GET = withAdmin(async (req) => {
  const q = new URL(req.url).searchParams.get("q");
  if (!q || !q.trim()) return bad("Add ?q=your requirement");
  const requirement = await parseRequirement(q);
  const results = await searchStock(requirement, 20);
  return NextResponse.json({ requirement, results });
});
