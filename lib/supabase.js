import { createClient } from "@supabase/supabase-js";

// Server-only client (uses the secret service_role key).
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase keys are missing in the environment variables.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function must(res) {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
