import { db, must } from "./supabase";
import { parseLines } from "./parser";
import { publishItems } from "./publish";
import { draftSummary } from "./match";
import { textToLines } from "./text";
import { fileToLines } from "./sheet";
import { downloadMedia } from "./whatsapp";
import { acceptTerms, withdrawSeller } from "./sellers";
import { TERMS_WHATSAPP } from "./terms";

const MAX_ROWS = 90; // WhatsApp replies must be quick; bigger lists go through the seller portal.

const HELP = `Seller commands:
• Send your stock as text, CSV or Excel and I will read it back
• CONFIRM - publish what I read
• CANCEL - discard it
• RENEW - keep all your stock live for another 48h
• STOCK - see how many listings are live
• STOP - leave the network (your stock is removed)`;

export async function handleSeller(seller, msg) {
  const sb = db();
  const text = (msg.text || "").trim();
  const cmd = text.toUpperCase().replace(/[^A-Z]/g, "");
  const ago = (ms) => new Date(Date.now() - ms).toISOString();

  if (seller.status !== "approved") return "Your seller account is not active. Please contact support.";

  if (cmd === "STOP") {
    await withdrawSeller(sb, seller, "WhatsApp");
    return "Understood. Your stock has been removed and you are no longer listed. Contact support if you want to rejoin.";
  }

  if (!seller.terms_accepted_at) {
    if (cmd === "AGREE") {
      await acceptTerms(sb, seller, "WhatsApp");
      return `Thank you, terms accepted ✅\n\n${HELP}`;
    }
    return `${TERMS_WHATSAPP}\n\nReply AGREE to accept.`;
  }

  if (!text && !msg.media) return "Please send your stock as text, a CSV or an Excel file. Reply HELP for commands.";
  if (["HELP", "HI", "HELLO"].includes(cmd)) return HELP;

  if (cmd === "CONFIRM") {
    const drafts = must(await sb.from("inventory_drafts").select("*").eq("seller_id", seller.id).eq("status", "pending").gte("created_at", ago(24 * 3600e3)).order("created_at", { ascending: false }).limit(1));
    if (!drafts.length) return "Nothing is waiting to be confirmed. Send me your stock first.";
    const r = await publishItems(sb, drafts[0].items, { sellerId: seller.id, sellerName: seller.company_name, sellerWhatsapp: seller.whatsapp, source: "whatsapp" });
    must(await sb.from("inventory_drafts").update({ status: "confirmed" }).eq("id", drafts[0].id).select("id"));
    const skip = r.skipped ? ` (${r.skipped} skipped: no price/model)` : "";
    return `✅ Published ${r.saved} new and renewed ${r.renewed}${skip}. Live for 48 hours. Reply RENEW any time to extend.`;
  }

  if (cmd === "CANCEL") {
    must(await sb.from("inventory_drafts").update({ status: "cancelled" }).eq("seller_id", seller.id).eq("status", "pending").select("id"));
    return "Cancelled. Nothing was published.";
  }

  if (cmd === "RENEW") {
    const exp = new Date(Date.now() + 48 * 3600e3).toISOString();
    const rows = must(await sb.from("stock").update({ expires_at: exp, is_active: true }).eq("seller_id", seller.id).gte("created_at", ago(7 * 24 * 3600e3)).select("id"));
    return rows.length ? `✅ Renewed ${rows.length} listing(s) for 48 hours.` : "You have no recent listings to renew. Send me your stock.";
  }

  if (cmd === "STOCK") {
    const r = await sb.from("stock").select("id", { count: "exact", head: true }).eq("seller_id", seller.id).eq("is_active", true).gt("expires_at", new Date().toISOString());
    return `You have ${r.count || 0} live listing(s).`;
  }

  // Anything else = stock. Text lines and/or an attached CSV/Excel file.
  let lines = textToLines(text);
  if (msg.media) {
    try {
      const { buf, mime } = await downloadMedia(msg.media.id);
      lines = lines.concat(await fileToLines(buf, msg.media.filename || "", msg.media.mime || mime));
    } catch (e) {
      return `I could not read that file: ${e.message}`;
    }
  }
  if (!lines.length) return "I could not find any stock in that. Reply HELP for commands.";
  let note = "";
  if (lines.length > MAX_ROWS) {
    lines = lines.slice(0, MAX_ROWS);
    note = `\n(Only the first ${MAX_ROWS} lines were read. For bigger lists use the seller portal.)`;
  }

  const items = await parseLines(lines);
  if (!items.length) return "I could not find any laptops in that. Example: Dell 7490 i5 8th 16/256 - 650 AED - 10 Qty";

  must(await sb.from("inventory_drafts").update({ status: "cancelled" }).eq("seller_id", seller.id).eq("status", "pending").select("id"));
  must(await sb.from("inventory_drafts").insert({ seller_id: seller.id, items, raw_text: lines.join("\n").slice(0, 20000) }).select("id"));
  return draftSummary(items) + note;
}
