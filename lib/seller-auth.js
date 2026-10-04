import { NextResponse } from "next/server";
import { db } from "./supabase";
import { bad } from "./admin";

export async function getSellerCtx(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return {};
  const sb = db();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return {};
  const { data: seller } = await sb.from("sellers").select("*").eq("auth_user_id", data.user.id).maybeSingle();
  return { user: data.user, seller };
}

export function withSeller(handler, { needTerms = true } = {}) {
  return async (req, ctx) => {
    try {
      const { user, seller } = await getSellerCtx(req);
      if (!user) return bad("Please sign in.", 401);
      if (!seller) return bad("This account is not a seller account.", 403);
      if (seller.status !== "approved") return bad("Your seller account is not active. Contact support.", 403);
      if (needTerms && !seller.terms_accepted_at) return bad("Please accept the seller terms first.", 403);
      return await handler(req, seller, ctx);
    } catch (e) {
      return bad(e.message, 500);
    }
  };
}
