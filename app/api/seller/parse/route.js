import { NextResponse } from "next/server";
import { withSeller } from "../../../../lib/seller-auth";
import { bad } from "../../../../lib/admin";
import { parseLines } from "../../../../lib/parser";
import { textToLines } from "../../../../lib/text";
import { fileToLines } from "../../../../lib/sheet";

export const maxDuration = 60;

// Seller pastes text and/or uploads a CSV/Excel file -> structured rows to review.
export const POST = withSeller(async (req) => {
  const { text, file } = await req.json();
  let lines = textToLines(text);
  if (file?.data) {
    if (file.data.length > 4_200_000) return bad("File too large (max about 3 MB).");
    lines = lines.concat(await fileToLines(Buffer.from(file.data, "base64"), file.name || "", ""));
  }
  if (!lines.length) return bad("Paste your stock or choose a file first.");
  const truncated = lines.length > 300;
  const items = await parseLines(lines.slice(0, 300));
  return NextResponse.json({ items, truncated });
});
