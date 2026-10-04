import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";
import { deliver } from "../../../../lib/channels";

// Admin sends a follow-up on the channel the customer used
// (WhatsApp: free text works within 24 hours of the customer's last message).
export const POST = withAdmin(async (req) => {
  const { request_id, text } = await req.json();
  if (!request_id || !text || !text.trim()) return bad("Write a message first.");
  const sb = db();
  const r = must(await sb.from("unfulfilled_requests").select("customer_wa_id,channel").eq("id", request_id).single());
  await deliver(r.channel || "whatsapp", r.customer_wa_id, text.trim());
  must(await sb.from("unfulfilled_requests").update({ status: "replied" }).eq("id", request_id).select("id"));
  return NextResponse.json({ ok: true });
});
