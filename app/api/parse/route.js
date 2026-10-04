import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../lib/admin";
import { parseStockText } from "../../../lib/parser";

export const maxDuration = 60;

export const POST = withAdmin(async (req) => {
  const { text } = await req.json();
  if (!text || !String(text).trim()) return bad("Nothing to parse.");
  return NextResponse.json({ items: await parseStockText(String(text).slice(0, 12000)) });
});
