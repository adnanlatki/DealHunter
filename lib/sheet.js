import Papa from "papaparse";
import { tableToLines } from "./text";

// CSV or Excel (.xlsx) file bytes -> text lines for the AI parser.
export async function fileToLines(buf, filename = "", mime = "") {
  const name = String(filename).toLowerCase();
  const type = String(mime).toLowerCase();
  if (name.endsWith(".csv") || type.includes("csv")) {
    const { data } = Papa.parse(buf.toString("utf8"), { header: true, skipEmptyLines: true });
    return tableToLines(Object.keys(data[0] || {}), data.map((r) => Object.values(r)));
  }
  if (name.endsWith(".xlsx") || type.includes("spreadsheetml")) {
    const { default: readXlsxFile } = await import("read-excel-file/node");
    const rows = await readXlsxFile(buf);
    return tableToLines(rows[0] || [], rows.slice(1));
  }
  throw new Error("Unsupported file. Please send text, a .csv or a .xlsx file.");
}
