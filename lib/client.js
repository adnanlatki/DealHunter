"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

let sb;
export function supabase() {
  if (!sb) sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return sb;
}

// Calls our own API with the logged-in user's token.
export async function api(path, opts = {}) {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const loginPath = window.location.pathname.startsWith("/seller") ? "/seller/login" : "/login";
  if (!token) {
    window.location.href = loginPath;
    throw new Error("Please sign in.");
  }
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) window.location.href = loginPath;
  if (!res.ok) throw new Error(json.error || "Request failed.");
  return json;
}

export function useApi(path) {
  const [s, setS] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    setS((p) => ({ ...p, loading: true }));
    return api(path)
      .then((data) => setS({ data, error: null, loading: false }))
      .catch((e) => setS({ data: null, error: e.message, loading: false }));
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...s, reload: load };
}
