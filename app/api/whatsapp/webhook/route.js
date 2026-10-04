import { verifySignature } from "../../../../lib/whatsapp";
import { handleIncoming } from "../../../../lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Meta calls this once when you press "Verify and save" in the developer console.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new Response(p.get("hub.challenge"), { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Meta calls this for every incoming message (official Cloud API webhook).
export async function POST(req) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("Bad signature", { status: 401 });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return new Response("ok", { status: 200 }); }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const names = {};
      (v.contacts || []).forEach((c) => (names[c.wa_id] = c.profile?.name));
      for (const m of v.messages || []) {
        const doc = m.type === "document" ? m.document : null;
        try {
          await handleIncoming({
            channel: "whatsapp",
            isPhone: true,
            from: m.from,
            name: names[m.from],
            text: m.type === "text" ? m.text?.body : doc?.caption || null,
            media: doc ? { id: doc.id, mime: doc.mime_type, filename: doc.filename } : null,
            type: m.type,
            messageId: m.id,
          });
        } catch (e) {
          console.error("webhook message failed:", e.message);
        }
      }
    }
  }
  return new Response("ok", { status: 200 }); // always 200 so Meta does not keep retrying
}
