import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../lib/admin";
import { db, must } from "../../../lib/supabase";
import { toStr } from "../../../lib/parser";
import { latestConsents } from "../../../lib/match";
import { publishItems } from "../../../lib/publish";

// Admin saves reviewed stock. Compliance: only from groups with a recorded YES consent.
export const POST = withAdmin(async (req) => {
  const { items, source_group_name } = await req.json();
  if (!Array.isArray(items) || !items.length) return bad("No items to save.");
  if (items.length > 500) return bad("Max 500 items per save.");
  const group = toStr(source_group_name);
  if (!group) return bad("Enter the source group name.");

  const sb = db();
  const latest = latestConsents(must(await sb.from("seller_consents").select("*")));
  const g = group.toLowerCase();
  const inGroup = latest.filter((c) => c.group_name.toLowerCase() === g);
  if (!inGroup.some((c) => c.consent_status === "YES"))
    return bad(`No seller consent is recorded for "${group}". Add it under Consents first.`);
  const blockedNames = new Set(inGroup.filter((c) => c.consent_status === "NO").map((c) => c.seller_name.toLowerCase()));

  const r = await publishItems(sb, items, { group, source: "admin", blockedNames });
  if (!r.saved && !r.renewed) return bad("Nothing to save: every row is missing a model or price, or the seller withdrew consent.");
  return NextResponse.json(r);
});
