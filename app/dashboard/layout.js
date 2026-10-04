"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/client";

const NAV = [
  ["/dashboard", "Overview"],
  ["/dashboard/ingest", "Add stock"],
  ["/dashboard/stock", "Stock"],
  ["/dashboard/search", "Search"],
  ["/dashboard/enquiries", "Enquiries"],
  ["/dashboard/unfulfilled", "Unfulfilled"],
  ["/dashboard/sellers", "Sellers"],
  ["/dashboard/consents", "Consents"],
];

export default function DashboardLayout({ children }) {
  const [ready, setReady] = useState(false);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => (data.session ? setReady(true) : router.replace("/login")));
  }, [router]);

  if (!ready) return <p className="p-8 text-sm text-slate-500">Loading...</p>;

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 text-sm">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={`whitespace-nowrap rounded px-3 py-1.5 ${path === href ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
              {label}
            </Link>
          ))}
          <button
            className="ml-auto whitespace-nowrap rounded px-3 py-1.5 text-slate-500 hover:bg-slate-100"
            onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}
          >
            Sign out
          </button>
        </nav>
      </header>
      {children}
      <footer className="mx-auto max-w-6xl p-4 text-xs text-slate-500 sm:px-8">
        Official Meta WhatsApp Cloud API only. No number extraction. Stock is added by hand from groups where sellers have given consent.
      </footer>
    </div>
  );
}
