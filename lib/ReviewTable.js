"use client";

const COLS = [
  ["brand", "Brand", "text", "w-24"], ["model", "Model", "text", "w-36"], ["cpu", "CPU", "text", "w-20"],
  ["generation", "Gen", "text", "w-16"], ["ram_gb", "RAM GB", "number", "w-20"], ["storage_gb", "Storage GB", "number", "w-24"],
  ["storage_type", "Type", "text", "w-20"], ["price_aed", "Price AED", "number", "w-24"], ["qty", "Qty", "number", "w-16"],
  ["location", "Location", "text", "w-28"],
];

// Editable review table (used by the seller portal).
export default function ReviewTable({ items, setItems }) {
  const edit = (idx, key, type, val) =>
    setItems((p) => p.map((r, i) => (i === idx ? { ...r, [key]: type === "number" ? (val === "" ? null : Number(val)) : val } : r)));
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>{COLS.map(([k, label]) => <th key={k} className="whitespace-nowrap px-2 py-2 font-medium">{label}</th>)}<th /></tr>
        </thead>
        <tbody>
          {items.map((row, idx) => (
            <tr key={idx} className="border-t border-slate-100">
              {COLS.map(([k, , type, w]) => (
                <td key={k} className="px-1 py-1">
                  <input type={type} value={row[k] ?? ""} onChange={(e) => edit(idx, k, type, e.target.value)}
                    className={`${w} rounded border border-transparent px-2 py-1 hover:border-slate-300 focus:border-slate-900 focus:outline-none ${k === "price_aed" && !row.price_aed ? "bg-red-50" : ""}`} />
                </td>
              ))}
              <td className="px-2 py-1"><button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-700">Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
