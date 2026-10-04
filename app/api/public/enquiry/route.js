import { NextResponse } from "next/server";
import { db } from "../../../../lib/supabase";
import { parseRequirement, toStr } from "../../../../lib/parser";
import { normalizePhone } from "../../../../lib/text";
import { siteEnabled, rateLimited } from "../../../../lib/public";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// A website visitor leaves a number. Shows up in the admin Enquiries (and Unfulfilled if no stock was chosen).
export async function POST(req) {
  if (!siteEnabled()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  try {
    const b = await req.json();
    const phone = normalizePhone(b.phone);
    const message = toStr(b.note) || toStr(b.query);
    if (phone.length < 9 || phone.length > 15) return NextResponse.json({ error: "Please enter a valid WhatsApp number." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Tell us what you need." }, { status: 400 });
    if (await rateLimited(req, "enquiry", 5)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

    const sb = db();
    const stockId = /^[0-9a-f-]{36}$/i.test(String(b.stock_id || "")) ? String(b.stock_id) : null;
    const text = message.slice(0, 500);
    const { data: enq, error } = await sb.from("enquiries").insert({
      channel: "website", customer_wa_id: phone, customer_name: toStr(b.name)?.slice(0, 80) || null,
      message_text: text, matched: !!stockId, matched_stock_id: stockId, connect_requested: true,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (!stockId) {
      let parsed = null;
      try { parsed = await parseRequirement(text); } catch {}
      await sb.from("unfulfilled_requests").insert({ enquiry_id: enq.id, channel: "website", customer_wa_id: phone, requirement_text: text, parsed });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("public enquiry error:", e.message);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
  }
}
