// Run with:  npm test      (Node 18+, no extra packages)
// The lib files use bundler-style imports, so we copy the pure ones to temp .mjs files first.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tmp = mkdtempSync(path.join(tmpdir(), "dh-"));
for (const f of ["match", "parser", "text", "whatsapp"]) copyFileSync(path.join(process.cwd(), "lib", `${f}.js`), path.join(tmp, `${f}.mjs`));
const load = (f) => import(pathToFileURL(path.join(tmp, `${f}.mjs`)).href);
const M = await load("match"), P = await load("parser"), T = await load("text"), W = await load("whatsapp");

const stock = [
  { id: 1, brand: "Dell", model: "Latitude 7490", cpu: "i5", generation: "8th", ram_gb: 16, storage_gb: 256, storage_type: "SSD", price_aed: 650, qty: 10, location: "Bur Dubai" },
  { id: 2, brand: "HP", model: "EliteBook 840 G5", cpu: "Core i5-8350U", generation: "8th", ram_gb: 8, storage_gb: 256, price_aed: 700, qty: 5, location: "Deira" },
  { id: 3, brand: "Dell", model: "Latitude 5490", cpu: "i5", ram_gb: 16, storage_gb: 512, price_aed: 720, qty: 30, location: "Sharjah" },
  { id: 4, brand: "Lenovo", model: "T480", cpu: "i7", ram_gb: 16, storage_gb: 512, price_aed: 900, qty: 3 },
  { id: 5, brand: "Dell", model: "7480", cpu: null, ram_gb: 16, price_aed: 500, qty: 4 },
];

test("matching: 20x Dell/HP i5 16GB under 1500", () => {
  const req = { brands: ["Dell", "HP"], cpu: "i5", min_ram_gb: 16, max_budget_aed: 1500, qty_needed: 20 };
  assert.deepEqual(M.filterAndRank(stock, req).map((x) => x.id), [3, 1]); // qty-fit first, then cheapest
  assert.equal(M.filterAndRank(stock, { ...req, max_budget_aed: 600 }).length, 0);
  assert.equal(M.filterAndRank(stock, { brands: ["Apple"] }).length, 0);
  assert.deepEqual(M.filterAndRank(stock, { cpu: "i7" }).map((x) => x.id), [4]);
  assert.equal(M.filterAndRank(stock, { cpu: "i5", brands: ["hp"] })[0].id, 2);
});

test("customer reply wording", () => {
  assert.equal(M.specsOf(stock[0]), "i5 8th 16GB/256GB SSD");
  assert.equal(M.foundReply(stock[0], 5), "Available ✅ Dell Latitude 7490 i5 8th 16GB/256GB SSD - 10 pcs at AED 650 from trusted seller in Bur Dubai. Want me to connect you directly on WhatsApp? Reply YES");
  assert.match(M.foundReply(stock[0], 20), /You asked for 20; this lot has 10/);
  assert.match(M.NOT_FOUND_REPLY, /update you in 10 mins/);
  assert.equal(M.wantedText({ brands: ["Dell", "HP"], cpu: "i5", min_ram_gb: 16, max_budget_aed: 1500, qty_needed: 20 }), "WANTED: 20x Dell/HP i5 16GB+ RAM laptops, budget AED 1,500 per piece. Reply with model, specs, qty and best price.");
});

test("renew key, consent log, normalizers", () => {
  assert.equal(M.stockKey({ ...stock[0], price_aed: 1 }), M.stockKey({ ...stock[0], model: "latitude-7490", qty: 99 }));
  const latest = M.latestConsents([
    { seller_name: "Khalid", group_name: "G1", consent_status: "YES", created_at: "2026-01-01" },
    { seller_name: "khalid", group_name: "g1", consent_status: "NO", created_at: "2026-02-01" },
    { seller_name: "Raza", group_name: "G1", consent_status: "YES", created_at: "2026-01-05" },
  ]);
  assert.equal(latest.length, 2);
  assert.equal(latest.find((c) => c.seller_name.toLowerCase() === "khalid").consent_status, "NO");
  assert.equal(P.normalizeItem({ brand: " Dell ", price_aed: "1,250" }).price_aed, 1250);
  assert.equal(P.normalizeItem({}).qty, 1);
  assert.deepEqual(P.normalizeRequirement({ brands: ["Dell", ""], qty_needed: "20" }).brands, ["Dell"]);
});

test("seller phone numbers match however they are typed", () => {
  for (const s of ["+971 58 553 7110", "00971585537110", "0585537110", "585537110", "971-58-553-7110"]) assert.equal(T.normalizePhone(s), "971585537110", s);
});

test("spreadsheet rows and text become parser lines", () => {
  assert.deepEqual(
    T.tableToLines(["Item", "Price", "Qty"], [["Dell 7490", 650, 10], ["HP 840", null, 5], [null, "", ""]]),
    ["Item: Dell 7490, Price: 650, Qty: 10", "Item: HP 840, Qty: 5"]
  );
  assert.deepEqual(T.textToLines("a\n\n  b  \r\nc"), ["a", "b", "c"]);
});

test("seller confirmation summary", () => {
  const items = [
    { brand: "Dell", model: "Latitude 7490", cpu: "i5", generation: "8th", ram_gb: 16, storage_gb: 256, storage_type: "SSD", price_aed: 650, qty: 10 },
    { brand: "HP", model: "840 G5", price_aed: null, qty: 5 },
  ];
  const s = M.draftSummary(items);
  assert.match(s, /I read 1 item\(s\):\n1\) Dell Latitude 7490 i5 8th 16GB\/256GB SSD - AED 650 x10/);
  assert.match(s, /1 item\(s\) have no price or model and will be skipped/);
  assert.match(s, /Reply CONFIRM to publish \(live for 48 hours\) or CANCEL\.$/);
  assert.match(M.draftSummary(Array(12).fill(items[0])), /\.\.\.and 2 more/);
});

test("webhook signature (Meta / Instagram)", () => {
  const body = JSON.stringify({ a: 1 });
  const sign = (sec) => "sha256=" + crypto.createHmac("sha256", sec).update(body).digest("hex");
  process.env.WHATSAPP_APP_SECRET = "s3cret";
  assert.equal(W.verifySignature(body, sign("s3cret")), true);
  assert.equal(W.verifySignature(body + " ", sign("s3cret")), false);
  assert.equal(W.verifySignature(body, "sha256=bad"), false);
  assert.equal(W.verifySignature(body, null), false);
  assert.equal(W.verifySignature(body, sign("other"), "other"), true, "explicit secret (Instagram)");
  delete process.env.WHATSAPP_APP_SECRET;
  assert.equal(W.verifySignature(body, sign("s3cret")), false, "no secret = reject");
});
