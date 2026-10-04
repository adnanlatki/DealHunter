# Deal Hunter STOCK NETWORK: Developer Handover & Deployment Guide

Audience: a Node.js developer taking this project from "written, never run" to production.
Owner/CEO: non-technical. Anything needing a business decision or an account login is flagged **[OWNER]**.

---
## 0. Read this first (honest status)

| Item | Status |
|---|---|
| Code written | Yes, complete for the scope below |
| `npm test` (7 pure-logic tests: matching, replies, phone normalization, consent log, signatures, sheet-to-lines, seller read-back) | Passing |
| All files parse; all relative imports/exports resolve | Verified |
| `npm install` / `npm run build` | **NEVER RUN.** The authoring environment had no internet |
| Any call to Supabase, OpenAI, Meta Graph API | **NEVER EXECUTED.** All integration code is untested |
| Excel (.xlsx) intake via `read-excel-file` | **Untested, highest-risk dependency** |
| Instagram and Texnity adapters | Switched-off slots. Instagram written from memory, Texnity is a generic placeholder |
| Automated tests for agent/seller flow/API routes | **Do not exist** |

Treat the first build as the first real test. Expect some small fixes. Budget a few hours to get green, then a staged rollout (section 12).

**Business number to use: +971 58 553 7110** (digits `971585537110`). **[OWNER]** Earlier correspondence also mentioned +971 58 553 9110. Confirm which number is real before registering anything with Meta. The number is NOT hardcoded anywhere; the app uses Meta's `PHONE_NUMBER_ID`, so only Meta registration and the docs depend on it.

---
## 1. What the product does

UAE laptop wholesale marketplace. One master stock inventory (table `stock`, every listing auto-expires after 48h unless renewed), fed three ways and searched through three doors.

```
STOCK IN                                          CUSTOMERS OUT
(a) Admin pastes / uploads CSV (from seller       (1) WhatsApp bot  (Meta Cloud API)
    groups with recorded consent)                 (2) Public website (AI search + filters + enquiry form)
(b) Sellers WhatsApp the business number ->       (3) Optional later: Instagram DMs, Texnity (slots, off)
    bot reads back -> seller replies CONFIRM
(c) Seller web portal (/seller)                   No match -> admin "Unfulfilled" page -> admin forwards
        \                                         the request to seller groups MANUALLY and replies from
         +--> lib/publish.js --> stock <--------  the dashboard
```

Key business rules:
- **Official Meta WhatsApp Cloud API only.** No Baileys / whatsapp-web.js / scraping / bulk number extraction. Stock from groups is copied in by a human admin.
- Customers get **templated** replies. The LLM only extracts structured filters; it never writes free text to customers.
- Seller identity is never sent to customers or exposed on `/api/public/*`. The customer saying YES only flags the admin, who connects the parties by hand.
- Consent is logged (append-only): group YES consents, seller terms acceptance, withdrawals.

---
## 2. Tech stack

Next.js 14.2 App Router (plain JS, no TypeScript) · Tailwind 3 · Supabase (Postgres + Auth) · OpenAI `gpt-4o-mini` via raw `fetch` (no SDK) · Meta WhatsApp Cloud API (Graph `v21.0`) · `papaparse` (CSV) · `read-excel-file` v5 (XLSX) · Vercel (hosting + cron). Node >= 18.17.

---
## 3. Repository map

```
app/
  page.js                          public website (client component)
  login/                           admin sign-in
  dashboard/{page,ingest,stock,search,enquiries,unfulfilled,consents,sellers}   admin UI (layout.js gates on session)
  seller/{login,page}              seller portal
  api/
    whatsapp/webhook               Meta webhook (GET verify, POST messages)
    instagram/webhook              SLOT (404 until INSTAGRAM_TOKEN set)
    channels/texnity               SLOT (404 until TEXNITY_WEBHOOK_SECRET set)
    cron/expire                    housekeeping (Bearer CRON_SECRET)
    parse, stock, search-stock     admin ingest / save / customer-style search
    admin/{stats,stock,enquiries,unfulfilled,reply,consents,sellers}
    seller/{me,stock,parse,publish}
    public/{catalog,search,enquiry}
lib/
  agent.js           handleIncoming(): dedupe -> seller? -> customer flow. ONE brain for all channels
  seller-agent.js    seller WhatsApp state machine (AGREE/CONFIRM/CANCEL/RENEW/STOCK/HELP/STOP + stock intake)
  publish.js         publishItems(): the ONLY way stock enters (insert, or renew if same listing live)
  search.js          loads active non-expired stock, ranks via match.js
  match.js           PURE: filterAndRank, foundReply, draftSummary, wantedText, stockKey, latestConsents
  text.js            PURE: normalizePhone, textToLines, tableToLines
  parser.js          OpenAI calls: parseStockText, parseLines (batched, parallel), parseRequirement; normalizers
  sheet.js           CSV/XLSX bytes -> lines
  whatsapp.js        sendText, downloadMedia, verifySignature
  channels/          adapters {enabled(), send()} for whatsapp | instagram | texnity ; index.js deliver()
  sellers.js         acceptTerms, withdrawSeller (both write to consent log)
  admin.js           getAdmin / withAdmin  | seller-auth.js  getSellerCtx / withSeller
  public.js          publicRow() anonymizer, rateLimited(), siteEnabled()
  supabase.js        db() service-role client, must()  | client.js  browser client, api(), useApi()
  terms.js           seller terms text + version (TEMPLATE, needs legal review)
  ui.js, ReviewTable.js   shared UI
supabase/schema.sql  idempotent (safe to re-run)
tests/logic.test.mjs `npm test`
vercel.json          cron: GET /api/cron/expire daily 02:00 UTC
```

---
## 4. Data model (all tables have RLS enabled with NO policies; only the service-role key reads/writes)

| Table | Purpose / notes |
|---|---|
| `stock` | Master inventory. `expires_at` default now()+48h, `is_active`, `seller_id`, `seller_whatsapp`, `source` (admin/portal/whatsapp), `source_group_name`, `raw_text` |
| `sellers` | Registered sellers. `whatsapp` = digits with country code (unique). `auth_user_id` (portal login, optional). `status` pending/approved/suspended (only approved/suspended are used). `terms_accepted_at/version` |
| `seller_consents` | Consent log. Group consents (admin-entered) AND platform rows `group_name = "Seller platform (terms vN)"` for terms accepted/withdrawn. Newest row per seller+group wins (`latestConsents`) |
| `inventory_drafts` | Parsed WhatsApp stock waiting for CONFIRM (status pending/confirmed/cancelled/expired) |
| `enquiries` | Every customer message + reply + result. `channel` whatsapp/instagram/texnity/website. `connect_requested` set when customer replies YES |
| `unfulfilled_requests` | No-match or partial-match requests. status open/forwarded/replied/closed |
| `message_log` | Dedupe of inbound message ids (`channel:id`) |
| `rate_hits` | Rate-limit counter for public routes (pruned by cron) |

Note `enquiries.customer_wa_id` holds the sender id for any channel (phone digits, IG scoped id, website phone).

---
## 5. Core flows (so you know where to look when something breaks)

**Customer on WhatsApp**: Meta POST -> `webhook/route.js` verifies `X-Hub-Signature-256` (app secret) -> builds msg -> `handleIncoming` -> insert `message_log` (23505 = duplicate, skip) -> number matches a seller? no -> `handleCustomer`: insert `enquiries`; text "YES" within 24h of a matched enquiry -> set `connect_requested`; else `parseRequirement` (8s timeout) -> `searchStock` -> `foundReply` or `NOT_FOUND_REPLY` + `unfulfilled_requests` -> `deliver()` via Cloud API -> update enquiry. Always returns HTTP 200 to Meta after a valid signature. Qty shortfall = reply with a note AND an unfulfilled row.

**Seller on WhatsApp**: number matches `sellers.whatsapp` (via `normalizePhone`) -> `handleSeller`: not approved -> refuse; `STOP` -> withdraw; terms not accepted -> terms text until `AGREE`; commands; otherwise treat as stock: text lines + optional document (CSV/XLSX downloaded with `downloadMedia`) -> `parseLines` (max 90 lines) -> save draft -> `draftSummary` read-back -> `CONFIRM` -> `publishItems(source:"whatsapp")`.

**Seller portal**: `/seller` -> `/api/seller/parse` (text and/or base64 file, max ~3 MB, 300 lines) -> editable review -> `/api/seller/publish`.

**Admin ingest**: `/dashboard/ingest` (paste or CSV parsed client-side then `/api/parse`) -> `/api/stock` requires source group with a YES consent and seller not withdrawn -> `publishItems(source:"admin")`.

**Public site**: `/api/public/catalog` (filters, no OpenAI), `/api/public/search` (OpenAI, rate limit 15/10min/IP), `/api/public/enquiry` (rate limit 5/10min/IP) -> enquiry (+ unfulfilled if no stock chosen).

**Cron** (`/api/cron/expire`): deactivates stock past `expires_at`, expires drafts older than 24h, prunes `rate_hits`. Search ALSO filters `expires_at > now()`, so correctness does not depend on the cron.

---
## 6. Endpoint reference

| Method + path | Auth | Purpose |
|---|---|---|
| GET/POST `/api/whatsapp/webhook` | verify token / HMAC signature | Meta webhook |
| GET/POST `/api/instagram/webhook` | verify token / HMAC | slot |
| POST `/api/channels/texnity` | header `x-webhook-secret` | slot |
| GET `/api/cron/expire` | `Authorization: Bearer $CRON_SECRET` | housekeeping |
| POST `/api/parse`, `/api/stock`; GET `/api/search-stock?q=` | admin | ingest / search |
| `/api/admin/*` | admin (Supabase JWT + `ADMIN_EMAILS`) | dashboard back-end |
| `/api/seller/*` | seller JWT linked to approved `sellers` row (+ terms accepted for write actions) | portal back-end |
| `/api/public/*` | none (rate-limited, anonymized, `PUBLIC_SITE_ENABLED`) | website |

Browser calls send `Authorization: Bearer <supabase access token>` (see `lib/client.js`).

---
## 7. Environment variables

`NEXT_PUBLIC_*` values are inlined at **build** time: redeploy after changing them.

| Name | Required | Where to get it | Exposure |
|---|---|---|---|
| `OPENAI_API_KEY` | yes | platform.openai.com. Set a monthly spend cap | server |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase > Project Settings > API | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | same page, "anon public" | browser |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | same page, "service_role" | **server only, secret** |
| `ADMIN_EMAILS` | yes | comma-separated emails allowed into `/dashboard` APIs | server |
| `WHATSAPP_TOKEN` | yes | Meta System User permanent token | server |
| `PHONE_NUMBER_ID` | yes | Meta WhatsApp > API Setup (ID of +971585537110) | server |
| `WHATSAPP_VERIFY_TOKEN` | yes | you invent it; paste same in Meta | server |
| `WHATSAPP_APP_SECRET` | yes | Meta App settings > Basic | server |
| `CRON_SECRET` | yes | you invent it. Vercel sends it automatically to cron | server |
| `PUBLIC_SITE_ENABLED` | no (default true) | false hides website APIs | server |
| `INSTAGRAM_TOKEN`, `INSTAGRAM_VERIFY_TOKEN`, `INSTAGRAM_APP_SECRET` | no | see INTEGRATIONS.md | server |
| `TEXNITY_WEBHOOK_SECRET`, `TEXNITY_REPLY_MODE`, `TEXNITY_SEND_URL`, `TEXNITY_API_KEY` | no | see INTEGRATIONS.md | server |

---
## 8. Local setup

```bash
unzip deal-hunter-v2.zip && cd deal-hunter
cp .env.example .env.local        # fill values (section 7)
npm install
npm test                          # expect 7 pass
npm run build                     # first real compile; fix anything that fails
npm run dev                       # http://localhost:3000
```
Expose localhost to Meta for webhook testing with a tunnel (e.g. `ngrok http 3000`). Use the tunnel URL as the callback. Use a separate Supabase project and a Meta test number for dev if possible.

Before proceeding, **verify these assumptions** (never executed):
1. `lib/sheet.js` against the installed `read-excel-file` version: `import readXlsxFile from "read-excel-file/node"; await readXlsxFile(buffer)` -> array of rows. Test with a tiny .xlsx.
2. Supabase chains: `.update().select("id")`, `.single()`, `.maybeSingle()`, `.then(must)` (stats route), `.not("seller_id","is",null)`, `.or()` string in admin stock, `auth.admin.createUser/deleteUser`.
3. `gpt-4o-mini` and Graph `v21.0` (constant `GRAPH` in `lib/whatsapp.js` and `lib/channels/instagram.js`) are still current.
4. No server-only variable reaches the client bundle (grep the `.next/static` output for key prefixes).
5. Upgrade Next.js to the latest 14.2.x patch (`next@14.2.15` is pinned; later patches contain security fixes) and run `npm audit`.

---
## 9. Deployment, step by step

### 9.1 Supabase
1. Create project. **Choose the region nearest your Vercel functions** (latency matters for the 2-second reply goal). Use the paid plan for production: free projects pause after about a week of inactivity and have no backups.
2. SQL Editor: run `supabase/schema.sql` (idempotent; also safe to re-run after future updates).
3. Authentication > Users > Add user (the owner's admin email, Auto Confirm). This email must equal an entry in `ADMIN_EMAILS`.
4. Authentication settings: **disable new user sign-ups** (all users are created by the admin API). Consider enabling email rate limits / custom SMTP if you later add invites or resets.
5. Copy URL, anon key, service_role key.

### 9.2 OpenAI
Create a project API key, set a hard monthly budget, and note the usage dashboard. Cost drivers: every customer message (1 call), every public search (1 call), every 15 stock lines parsed.

### 9.3 Vercel
```bash
npm i -g vercel
vercel login
vercel link                                   # create/link project (or import the Git repo in the dashboard)
# add every variable from section 7 for Production (and Preview if you want):
vercel env add OPENAI_API_KEY production      # repeat for each
vercel --prod
```
Notes:
- Function limits: webhook / parse routes declare `maxDuration` 60 (30 for public search, IG). Check your plan's current maximum duration; lower the values if the plan rejects them.
- `vercel.json` cron is **daily** (Hobby plan limit). On Pro you may use `0 * * * *` for hourly. Not required for correctness.
- Pick the function region (project settings or `regions` in `vercel.json`) closest to the Supabase region.
- Add a custom domain **[OWNER]**; Meta needs a public HTTPS URL.

### 9.4 Meta / WhatsApp Cloud API for **+971 58 553 7110**
**[OWNER]** must own the Meta Business portfolio and complete verification steps requiring company documents.

1. Prerequisites for the number: able to receive SMS/voice code; **not** currently active in the WhatsApp or WhatsApp Business app (registering with the Cloud API normally logs the number out of the app and its groups). If the owner needs the app and the API on the same number, research Meta's current "coexistence" onboarding and its limits (groups are not synced to the API). Recommended: keep seller-group membership on a different number.
2. developers.facebook.com: create App (type Business), add the **WhatsApp** product, attach the Business portfolio.
3. WhatsApp Manager > Phone numbers > add +971585537110, verify, get **display name approved**, set the 6-digit two-step PIN if prompted. Copy **Phone number ID** (`PHONE_NUMBER_ID`) and **WABA ID**.
4. Business Settings > System users > create Admin system user > assign the app and the WhatsApp account (full control) > generate token with `whatsapp_business_messaging` and `whatsapp_business_management`, no expiry -> `WHATSAPP_TOKEN`. (The API-setup temporary token dies in 24h.)
5. App settings > Basic > App secret -> `WHATSAPP_APP_SECRET`.
6. Deploy first (env vars set), then WhatsApp > Configuration > Webhook: Callback `https://<domain>/api/whatsapp/webhook`, Verify token = `WHATSAPP_VERIFY_TOKEN`; subscribe to field **messages**.
7. If real messages do not arrive after Live mode, subscribe the app to the WABA explicitly:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_TOKEN"
   ```
8. Switch the app to **Live** (requires privacy policy URL and category). In Development mode production traffic may not be delivered.
9. Business verification may be required to lift messaging limits. Free-form replies are allowed only within **24h of the customer's last message**. Outbound messages outside that window require approved **templates, which are not implemented** (section 11).
10. Check Meta's current conversation/message pricing before launch.

### 9.5 Post-deploy smoke tests (replace `$URL`, tokens as needed)
```bash
curl -s -o /dev/null -w "%{http_code}\n" $URL/                                   # 200
curl -s $URL/api/public/catalog | head -c 300                                   # JSON; MUST NOT contain seller_name / seller_whatsapp / source_group_name / raw_text
curl -s -X POST $URL/api/public/search -H 'content-type: application/json' -d '{}'   # 400
curl -s "$URL/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=123"   # 123
curl -s -o /dev/null -w "%{http_code}\n" "$URL/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1"  # 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST $URL/api/whatsapp/webhook -d '{}'   # 401 (unsigned)
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/instagram/webhook                  # 404 while unconfigured
curl -s -o /dev/null -w "%{http_code}\n" -X POST $URL/api/channels/texnity -d '{}'   # 404 while unconfigured
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/cron/expire                        # 401
curl -s -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/expire                 # {"expired":0,"drafts_expired":0}
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/admin/stats                        # 401
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/seller/me                          # 401
```

### 9.6 User-acceptance script (do in this order)
1. Log in at `/login`. Overview loads with zeros.
2. Consents: add "TestSeller / Test Group / YES".
3. Add stock: group "Test Group", paste `Dell 7490 i5 8th 16GB/256GB - 650 AED - 10 Qty - Bur Dubai - Khalid`, Parse, Save. Row appears in Stock. Save again: reported as **renewed**, not duplicated.
4. Search: `Need 5x Dell i5 16GB under AED 1500` returns the row and the exact bot reply.
5. From a normal phone, WhatsApp +971585537110 the same sentence: "Available ✅ ..." in a few seconds; row in Enquiries.
6. Send `Need 10 MacBook Pro M2`: "Noted..." reply; request in Unfulfilled; "Forward to seller groups (copy)" copies WANTED text; "Reply to customer" delivers a WhatsApp message.
7. Reply `YES` after a match: enquiry shows "Wants connect".
8. Sellers: add a seller using the tester's own second number. From that number send the stock text: bot sends terms; reply AGREE; resend stock; read-back appears; CONFIRM publishes; RENEW works; STOP removes stock and suspends. Also try a `.csv` and a `.xlsx` attachment.
9. Portal: seller with email+password logs in at `/seller/login`, accepts terms, uploads a file, publishes, deletes a listing.
10. Public site: `/` search and filters work; submit an enquiry and see it in Enquiries (channel website). Confirm no seller info in the browser network tab.
11. Wait for expiry (or set `expires_at` in the past in Supabase): item disappears from search immediately; cron flips `is_active` later.

---
## 10. Security & compliance review points

- Admin = Supabase JWT + email allow-list (no roles). Seller = JWT linked to approved `sellers` row. Public = anonymized + rate-limited. RLS blocks anon/browser access to every table; all DB access is server-side with the service key. Never expose the service key.
- Webhook signature check is mandatory; no secret configured = all webhook POSTs rejected.
- Prompt injection: stock text and customer text go to the LLM, but output is forced to JSON and re-normalized, and replies to customers are templates. Low risk; keep it that way.
- Consent: stock cannot be published for a group without a YES, nor for a seller whose latest row is NO (admin path matches by exact lowercase seller_name, a known weakness). Registered sellers must accept terms. All logged. **Seller terms in `lib/terms.js` are template text: legal review required [OWNER].**
- PII: customer phone numbers and message text are stored. Define a retention policy, add deletion tooling, and publish a privacy policy (Meta requires a URL; UAE PDPL/free-zone rules may apply). **[OWNER]**
- Rotate any key that was ever pasted into a chat or ticket.
- Passwords for portal sellers are set by the admin and shared out-of-band. Replace with an invite / reset flow (see next steps).

---
## 11. Known gaps and risks (prioritized backlog)

1. **No tests beyond pure logic.** Add mocked tests for `agent.js`, `seller-agent.js`, `publish.js` and route handlers.
2. **At-most-once webhook handling.** `message_log` is written before processing; if the function dies mid-way, Meta's retry is skipped and the customer gets nothing. Fix: delete the log row on failure, and make the customer flow idempotent, or move processing to a queue.
3. **Inline processing.** Slow OpenAI/Meta calls count against function time; the 2-second target depends on OpenAI latency. Measure p95; consider streaming the ack first or a queue (Vercel/QStash/Supabase Edge) for large file intake.
4. **Search is in-memory** over up to 2000 active rows (`lib/search.js`). Fine for hundreds to low thousands; beyond that push filters into SQL (indexes on brand/cpu/ram/price) or use trigram search.
5. **No WhatsApp templates**, so no outbound after the 24h window, and the "I will update you in 10 mins" promise is manual (admin uses Unfulfilled > Reply). Add approved templates and an automated follow-up when a matching listing is published.
6. **Buyer-seller connection is manual.** Optionally notify the seller ("a buyer is interested; reply OK to share your number") and automate introductions, with explicit seller consent.
7. **Parsing accuracy.** The LLM can misread prices/specs. WhatsApp has a confirm step and admin/portal have an editable review table, but add sanity rules (price ranges per model, outlier flags) and a feedback loop.
8. **Renew matching** uses `stockKey` (brand, model, cpu, gen, ram, storage, seller_name). Admin-path rows use the parsed seller_name, so spelling variants can create duplicates.
9. **Auth gaps:** no seller self-registration/approval queue (`pending` status unused), no password reset UI, no admin roles/audit log, no MFA.
10. **Public site:** prices are public; IP-based rate limit only (add CAPTCHA if abused); no SEO/pagination (limit 200).
11. **Operational:** timezone for "today" is hard-coded UTC+4; no alerting; no error tracking (add Sentry); Supabase free-tier pausing; no DB backups on free tier.
12. **Dependencies:** pin and audit; `read-excel-file` handles `.xlsx` only (not `.xls`/PDF/images). Photo or PDF price lists are not supported.
13. Instagram and Texnity slots need real verification (see `INTEGRATIONS.md`).

---
## 12. Recommended rollout

1. Staging: separate Supabase + Vercel project + Meta test number. Run the section 9.6 script.
2. Production, admin-only: owner pastes stock, tests the bot with own phones. No sellers yet.
3. Pilot: 3-5 friendly sellers via WhatsApp (and 1-2 via portal) for a week. Watch Enquiries "Not delivered" notes, Vercel logs, and OpenAI cost.
4. Enable the website publicly after deciding on price visibility.
5. Onboard remaining sellers in batches. Review the backlog in section 11 (items 2, 5, 1 first).
6. Instagram/Texnity last.

---
## 13. Operations runbook

| Symptom | Where to look / fix |
|---|---|
| Meta "Verify and save" fails | `WHATSAPP_VERIFY_TOKEN` mismatch or not redeployed; check GET handler returns the challenge |
| No customer replies | Vercel logs for `/api/whatsapp/webhook`; Enquiries shows `reply_error` text from Meta; token expired/wrong `PHONE_NUMBER_ID`; app not Live; app not subscribed to WABA (9.4 step 7) |
| `401 Bad signature` in logs | Wrong `WHATSAPP_APP_SECRET` (must be the app that owns the number) |
| Error 131047 | Outside the 24h window; a template is required |
| Seller treated as customer | Not in Sellers, or number stored differently; `normalizePhone` handles 971/00971/05x/5x formats |
| Seller can't publish | Terms not accepted, status suspended, or all rows missing price/model |
| Admin can't log in / 401 | Email not in `ADMIN_EMAILS` or user missing in Supabase; redeploy after env change |
| XLSX rejected | Verify `read-excel-file` API; only `.xlsx`; file under ~3 MB (portal) |
| Parse failing | OpenAI key/billing/model name; check error text surfaced in the UI |
| Stock still showing after 48h | Should not happen (search filters expiry). Check `expires_at` values; cron only cleans flags |
| Costs spike | `rate_hits` limits; OpenAI usage dashboard; consider lowering limits or disabling the site |

Deploys: Vercel "Instant Rollback" for code. Schema changes are additive and idempotent; never drop tables without a backup (`pg_dump` from the Supabase connection string, or paid-plan backups). Rotate keys: change in the provider, update the Vercel env var, redeploy.

---
## 14. Decision log

- Official API only, human-in-the-loop for group stock: ban-safety and consent.
- Templated customer replies (no free LLM text): predictability and safety.
- One `publishItems` and one `handleIncoming`: every channel behaves the same.
- Search checks expiry at query time: cron failure cannot serve stale stock.
- Daily cron: Vercel Hobby limit; harmless because of the point above.
- Sellers identified by registered phone number; unknown numbers are customers: prevents fake inventory injection.
- Admin buyer-seller connection by hand: avoids sharing seller contacts without consent.
- Integrations as adapters behind env flags: can be switched on later without touching the core.

---
## 15. Open decisions for the owner

1. Confirm the business number: +971 58 553 7110 vs +971 58 553 9110.
2. Keep the same number in the WhatsApp app (coexistence) or use a separate number for the groups?
3. Show prices on the public site?
4. Legal text: seller terms, website terms, privacy policy; UAE data-protection check.
5. Vercel/Supabase plans, domain name, who pays OpenAI/Meta usage.
6. Priority and timing of Instagram and Texnity.
7. Seller onboarding policy (who approves, minimum volume, how passwords are shared).
