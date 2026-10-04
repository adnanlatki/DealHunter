import { verifySignature } from "../../../../lib/whatsapp";
import { handleIncoming } from "../../../../lib/agent";
import * as instagram from "../../../../lib/channels/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const verifyToken = () => process.env.INSTAGRAM_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;
const appSecret = () => process.env.INSTAGRAM_APP_SECRET || process.env.WHATSAPP_APP_SECRET;

// SLOT: inactive until INSTAGRAM_TOKEN is set. See INTEGRATIONS.md.
export async function GET(req) {
  if (!instagram.enabled()) return new Response("Instagram channel not configured", { status: 404 });
  const p = new URL(req.url).searchParams;
  if (verifyToken() && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === verifyToken()) {
    return new Response(p.get("hub.challenge"), { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req) {
  if (!instagram.enabled()) return new Response("Instagram channel not configured", { status: 404 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret())) return new Response("Bad signature", { status: 401 });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response("ok", { status: 200 }); }
  for (const m of instagram.extractMessages(body)) {
    try { await handleIncoming(m); } catch (e) { console.error("instagram message failed:", e.message); }
  }
  return new Response("ok", { status: 200 });
}
