export const field = "rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";
const btn = "rounded px-3 py-2 text-sm font-medium disabled:opacity-50";
export const btnDark = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
export const btnLight = `${btn} border border-slate-300 bg-white hover:bg-slate-100`;
export const btnGreen = `${btn} bg-emerald-700 text-white hover:bg-emerald-800`;
export const btnRed = `${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const th = "whitespace-nowrap px-3 py-2 text-left font-medium";
export const td = "px-3 py-2 align-top";

export function Notice({ error, ok }) {
  if (!error && !ok) return null;
  const style = error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <p className={`mt-4 rounded border px-4 py-3 text-sm ${style}`}>{error || ok}</p>;
}

export function Badge({ color = "slate", children }) {
  const c = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-sky-100 text-sky-800",
  }[color];
  return <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export const when = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" }) : "";

export function timeLeft(x) {
  const h = (new Date(x.expires_at) - Date.now()) / 36e5;
  return !x.is_active || h <= 0 ? "Expired" : `${Math.ceil(h)}h left`;
}
