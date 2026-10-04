import crypto from "crypto";

// Official Meta WhatsApp Cloud API only.
const GRAPH = "https://graph.facebook.com/v21.0";

export function verifySignature(rawBody, header, secret = process.env.WHATSAPP_APP_SECRET) {
  if (!secret || !header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function sendText(to, body) {
  const res = await fetch(`${GRAPH}/${process.env.PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error || {};
    throw new Error(
      e.code === 131047
        ? "WhatsApp only allows free-form replies within 24 hours of the customer's last message."
        : e.message || `WhatsApp error ${res.status}`
    );
  }
  return data;
}

// Files a seller sends (CSV / Excel). Two steps: ask Meta for the file URL, then download it.
export async function downloadMedia(mediaId) {
  const auth = { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` };
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
  const info = await meta.json().catch(() => ({}));
  if (!meta.ok || !info.url) throw new Error("Could not fetch the file from WhatsApp.");
  const file = await fetch(info.url, { headers: auth });
  if (!file.ok) throw new Error("Could not download the file from WhatsApp.");
  return { buf: Buffer.from(await file.arrayBuffer()), mime: info.mime_type || "" };
}
