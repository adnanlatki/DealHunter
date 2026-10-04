// SLOT (switched off until TEXNITY_WEBHOOK_SECRET is set). Generic "third-party messaging platform" adapter.
// When you know Texnity's real formats, edit ONLY normalizeInbound() and send() in this file.
//
// Inbound: the platform POSTs each customer message to  /api/channels/texnity  with header
//          x-webhook-secret: <TEXNITY_WEBHOOK_SECRET>.
// Reply modes (TEXNITY_REPLY_MODE):
//   inline (default): our JSON response contains {"reply": "..."} and the platform sends it.
//   push: we call TEXNITY_SEND_URL ourselves (send() below).
export const enabled = () => !!process.env.TEXNITY_WEBHOOK_SECRET;
export const replyMode = () => (process.env.TEXNITY_REPLY_MODE || "inline").toLowerCase();

// ADJUST to Texnity's payload. Assumed shape: { from, name, text, message_id, channel }
export function normalizeInbound(body) {
  const platform = String(body.channel || body.platform || "").toLowerCase();
  return {
    channel: "texnity",
    from: String(body.from || body.sender || body.user_id || ""),
    name: body.name || null,
    text: body.text || body.message || null,
    type: body.text || body.message ? "text" : "other",
    messageId: body.message_id || body.id || null,
    isPhone: platform === "whatsapp", // only phone numbers can be matched to registered sellers
  };
}

// ADJUST to Texnity's send API (used only in push mode).
export async function send(to, text) {
  if (!process.env.TEXNITY_SEND_URL) throw new Error("TEXNITY_SEND_URL is not set.");
  const res = await fetch(process.env.TEXNITY_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TEXNITY_API_KEY || ""}` },
    body: JSON.stringify({ to, text }),
  });
  if (!res.ok) throw new Error(`Texnity send failed (${res.status}).`);
  return res.json().catch(() => ({}));
}
