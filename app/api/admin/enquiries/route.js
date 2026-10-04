import { NextResponse } from "next/server";
import { withAdmin } from "../../../../lib/admin";
import { db, must } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  const rows = must(await db().from("enquiries").select("*").order("created_at", { ascending: false }).limit(200));
  return NextResponse.json({ rows });
});
