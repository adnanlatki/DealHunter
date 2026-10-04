import crypto from "crypto";
import { NextResponse } from "next/server";
import { handleIncoming } from "../../../../lib/agent";
import * as texnity from "../../../../lib/channels/texnity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const same = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// SLOT: inactive until TEXNITY_WEBHOOK_SECRET is set. See INTEGRATIONS.md.
export async function POST(req) {
  if (!texnity.enabled()) return new Response("Texnity channel not configured", { status: 404 });
  if (!same(req.headers.get("x-webhook-secret"), process.env.TEXNITY_WEBHOOK_SECRET)) return new Response("Unauthorized", { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }
  const msg = texnity.normalizeInbound(body);
  if (!msg.from) return NextResponse.json({ error: "Missing sender" }, { status: 400 });

  const push = texnity.replyMode() === "push";
  try {
    const out = await handleIncoming(msg, { send: push });
    return NextResponse.json(push ? { ok: true } : { reply: out?.reply ?? null });
  } catch (e) {
    console.error("texnity message failed:", e.message);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
