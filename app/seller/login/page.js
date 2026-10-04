"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/client";
import { field, btnDark, Notice } from "../../../lib/ui";

export default function SellerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setBusy(false); }
    else router.replace("/seller");
  }

  return (
    <main className="mx-auto max-w-sm p-6 pt-24">
      <h1 className="text-2xl font-semibold">Seller sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Deal Hunter seller network</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="email" required className={`${field} w-full`} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required className={`${field} w-full`} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} className={`${btnDark} w-full`}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
      <Notice error={error} />
      <p className="mt-6 text-xs text-slate-500">No login? You can also send your stock by WhatsApp to the seller number you were given.</p>
    </main>
  );
}
