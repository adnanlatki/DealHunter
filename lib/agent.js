import { db } from "./supabase";
import { parseRequirement } from "./parser";
import { searchStock } from "./search";
import { deliver } from "./channels";
import { handleSeller } from "./seller-agent";
import { normalizePhone } from "./text";
import { foundReply, NOT_FOUND_REPLY, HELP_REPLY } from "./match";

const YES = /^\s*(yes|y|yeah|yep|yup|ok|okay|sure|please|haan)\W*$/i;

// One brain for every channel (WhatsApp, Instagram, Texnity...).
// msg = { channel, from, name, text, type, messageId, media, isPhone }
// Registered sellers (matched by phone number) get the seller flow; everyone else is a customer.
export async function handleIncoming(msg, { send = true } = {}) {
  const sb = db();
  const { channel, from } = msg;

  if (msg.messageId) {
    const { error } = await sb.from("message_log").insert({ message_id: `${channel}:${msg.messageId}` });
    if (error) {
      if (error.code === "23505") return null; // already handled (Meta retry)
      throw new Error(error.message);
    }
  }

  if (msg.isPhone) {
    const { data: seller } = await sb.from("sellers").select("*").eq("whatsapp", normalizePhone(from)).maybeSingle();
    if (seller) {
      let reply;
      try { reply = await handleSeller(seller, msg); }
      catch (e) { console.error("seller flow error:", e.message); reply = "Sorry, I could not process that. Please try again, or send fewer rows."; }
      if (send) await deliver(channel, from, reply).catch((e) => console.error("seller reply failed:", e.message));
      return { reply, role: "seller" };
    }
  }
  return handleCustomer(sb, msg, send);
}

async function handleCustomer(sb, msg, send) {
  const { channel, from, name, text, type } = msg;
  const { data: enq, error } = await sb
    .from("enquiries")
    .insert({ channel, customer_wa_id: from, customer_name: name || null, message_text: text || `[${type} message]`, wa_message_id: msg.messageId ? `${channel}:${msg.messageId}` : null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const update = {};
  let reply;
  const addUnfulfilled = (parsed, note) =>
    sb.from("unfulfilled_requests").insert({ enquiry_id: enq.id, channel, customer_wa_id: from, requirement_text: text || "", parsed: parsed || null, note: note || null });

  try {
    if (!text) {
      reply = "Please send your requirement as a text message, for example: Need 20x Dell i5 16GB under AED 1500";
    } else if (YES.test(text)) {
      // Customer accepted an offer: flag it for the admin. Seller details are never handed out automatically.
      const since = new Date(Date.now() - 24 * 3600e3).toISOString();
      const { data: prev } = await sb.from("enquiries").select("id").eq("channel", channel).eq("customer_wa_id", from).eq("matched", true).eq("connect_requested", false).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
      if (prev?.length) {
        await sb.from("enquiries").update({ connect_requested: true }).eq("id", prev[0].id);
        reply = "Thank you! Our team will connect you with the seller shortly.";
      } else reply = HELP_REPLY;
    } else {
      let req = null;
      try { req = await parseRequirement(text); } catch (e) { console.error("parseRequirement failed:", e.message); }
      update.parsed = req;
      if (req && !req.is_requirement) {
        reply = HELP_REPLY;
      } else {
        const results = req ? await searchStock(req, 1) : [];
        if (results.length) {
          const best = results[0];
          update.matched = true;
          update.matched_stock_id = best.id;
          reply = foundReply(best, req.qty_needed);
          if (req.qty_needed && best.qty < req.qty_needed) await addUnfulfilled(req, `Partial: needs ${req.qty_needed}, best lot has ${best.qty}`);
        } else {
          update.matched = false;
          reply = NOT_FOUND_REPLY;
          await addUnfulfilled(req, req ? null : "AI could not read this message");
        }
      }
    }
  } catch (e) {
    console.error("agent error:", e.message);
    update.matched = false;
    reply = NOT_FOUND_REPLY;
    await addUnfulfilled(null, `System error: ${e.message}`);
  }

  update.reply_text = reply;
  if (send) {
    try { await deliver(channel, from, reply); } catch (e) { update.reply_error = e.message; }
  }
  await sb.from("enquiries").update(update).eq("id", enq.id);
  return { reply, role: "customer" };
}
