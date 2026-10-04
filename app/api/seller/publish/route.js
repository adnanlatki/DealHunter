import { NextResponse } from "next/server";
import { withSeller } from "../../../../lib/seller-auth";
import { bad } from "../../../../lib/admin";
import { db } from "../../../../lib/supabase";
import { publishItems } from "../../../../lib/publish";

export const POST = withSeller(async (req, seller) => {
  const { items } = await req.json();
  if (!Array.isArray(items) || !items.length) return bad("No items to publish.");
  if (items.length > 500) return bad("Max 500 items at once.");
  const r = await publishItems(db(), items, { sellerId: seller.id, sellerName: seller.company_name, sellerWhatsapp: seller.whatsapp, source: "portal" });
  if (!r.saved && !r.renewed) return bad("Nothing to publish: every row is missing a model or a price.");
  return NextResponse.json(r);
});
