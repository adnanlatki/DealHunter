// Pure helpers (no imports) so they are easy to test.
// Turns any phone format into digits with country code (UAE-aware).
export function normalizePhone(s) {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "971" + d.slice(1); // 0585537110
  if (d.length === 9 && d.startsWith("5")) d = "971" + d;           // 585537110
  return d;
}

export function textToLines(text, max = 300) {
  return String(text || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, max);
}

// Spreadsheet rows -> "Header: value, Header: value" lines the AI parser can read.
export function tableToLines(headers, rows, max = 300) {
  const h = headers.map((x) => String(x ?? "").trim());
  return rows
    .slice(0, max)
    .map((r) =>
      r
        .map((v, i) => (v !== null && v !== undefined && String(v).trim() !== "" ? `${h[i] || "col" + (i + 1)}: ${String(v).trim()}` : null))
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean);
}
