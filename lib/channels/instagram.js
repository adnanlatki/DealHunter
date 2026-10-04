// SLOT (switched off until INSTAGRAM_TOKEN is set). UNTESTED: when you connect Instagram,
// verify the endpoint and payload below against Meta's current "Instagram Messaging API" docs.
// Manual steps (Meta app review, linking an Instagram professional account) are in INTEGRATIONS.md.
const GRAPH = "https://graph.instagram.com/v21.0";

export const enabled = () => !!process.env.INSTAGRAM_TOKEN;

export async function send(to, text) {
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}` },
    body: JSON.stringify({ recipient: { id: to }, message: { text } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `Instagram error ${res.status}`);
  return data;
}

// Webhook body -> normalized messages for the shared brain.
export function extractMessages(body) {
  const out = [];
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) {
      if (!m.message || m.message.is_echo) continue;
      out.push({
        channel: "instagram",
        from: m.sender?.id,
        name: null,
        text: m.message.text || null,
        type: m.message.text ? "text" : "other",
        messageId: m.message.mid,
        isPhone: false,
      });
    }
  }
  return out;
}
