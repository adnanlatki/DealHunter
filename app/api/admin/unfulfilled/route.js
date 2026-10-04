import { NextResponse } from "next/server";
import { withAdmin, bad } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  const rows = must(await db().from("unfulfilled_requests").select("*").order("created_at", { ascending: false }).limit(200));
  return NextResponse.json({ rows });
});

export const PATCH = withAdmin(async (req) => {
  const { id, status } = await req.json();
  if (!id || !["open", "forwarded", "replied", "closed"].includes(status)) return bad("Bad request.");
  must(await db().from("unfulfilled_requests").update({ status }).eq("id", id).select("id"));
  return NextResponse.json({ ok: true });
});
