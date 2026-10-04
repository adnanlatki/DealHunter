import { NextResponse } from "next/server";
import { db } from "./supabase";

// Logged-in Supabase user AND email must be on the ADMIN_EMAILS list.
export async function getAdmin(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  if (error || !data?.user) return null;
  const allowed = (process.env.ADMIN_EMAILS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes((data.user.email || "").toLowerCase()) ? data.user : null;
}

export const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

export function withAdmin(handler) {
  return async (req, ctx) => {
    try {
      const user = await getAdmin(req);
      if (!user) return bad("Not allowed. Sign in with an admin account.", 401);
      return await handler(req, user, ctx);
    } catch (e) {
      return bad(e.message, 500);
    }
  };
}
