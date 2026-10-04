# Deal Hunter STOCK NETWORK

One master stock inventory, fed by three routes, searched by customers on three doors.

**Stock IN:** (1) you paste/upload from seller groups, (2) sellers send stock by WhatsApp to your number (the bot reads it back, seller replies CONFIRM), (3) sellers use the web portal (paste text, CSV or Excel).
**Customers OUT:** WhatsApp bot, public website search + filters, and (later, optional) Instagram or a platform like Texnity.
Customer example: "Need 20x Dell i5 16GB under AED 1500" gets the best match in seconds. No match? It lands in your dashboard so you can forward it to your seller groups.

**You do not need to write any code. Follow the steps in order. Total time: about 60-90 minutes.**

---
## READ THIS FIRST: two important WhatsApp rules

1. **The number used for the Cloud API cannot also sit in your WhatsApp groups like a normal phone.**
   When you register +971 58 553 7110 with the Cloud API, it normally stops working in the regular WhatsApp / WhatsApp Business app.
   Safest setup: stay in the seller groups with a different phone number (or your normal WhatsApp), copy the stock messages from there,
   and paste them into this dashboard. The Cloud API number only talks to customers. Check Meta's current documentation
   for "coexistence" if you want to keep using the same number in the app.
2. **Free replies only work for 24 hours after the customer's last message.** Replying to a brand-new customer is always fine.
   A follow-up later than 24 hours needs a Meta-approved message template (not included).

---
## What you need (all have free tiers except OpenAI, which costs cents)
- A computer, an email address
- Accounts at: supabase.com, platform.openai.com, github.com, vercel.com, developers.facebook.com
- A Facebook Business account (Meta Business Suite) for the WhatsApp number

---
## STEP 1: Database (Supabase) - 10 min
1. supabase.com > **New project**. Pick any name and a strong database password. Wait until it finishes.
2. (If you ran an older version of `schema.sql` before, run the new one again. It is safe and only adds what is new.) Left menu **SQL Editor** > **New query**. Open `supabase/schema.sql` from this folder in Notepad, copy everything, paste it, click **Run**. It should say "Success".
3. Left menu **Project Settings > API**. Keep this page open. You need three values:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret, never share it)
4. Left menu **Authentication > Users > Add user > Create new user**. Enter your email and a password. Tick "Auto Confirm User".
5. Left menu **Authentication > Sign In / Providers** (or Settings): turn **OFF** "Allow new users to sign up", so nobody else can create an account.

## STEP 2: OpenAI key - 5 min
platform.openai.com > **API keys** > Create new secret key. Copy it. Add a few dollars under Billing (the AI model used is very cheap).

## STEP 3: Put the code online (GitHub) - 10 min
1. github.com > **New repository** > name it `deal-hunter`, choose **Private**, create.
2. Unzip the project on your computer. On the new repository page click **uploading an existing file**.
3. Drag in **everything inside the unzipped folder** (the folders `app`, `lib`, `supabase` and the files `package.json`, `vercel.json` etc.). Click **Commit changes**.
   (Do not upload any file named `.env.local`.)

## STEP 4: Deploy on Vercel - 10 min
1. vercel.com > **Add New > Project** > import your `deal-hunter` repository.
2. Before clicking Deploy, open **Environment Variables** and add these (copy the names exactly, see `.env.example`):

| Name | Value |
|---|---|
| OPENAI_API_KEY | your OpenAI key |
| NEXT_PUBLIC_SUPABASE_URL | Supabase Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service_role key |
| ADMIN_EMAILS | the email you created in Step 1.4 |
| WHATSAPP_VERIFY_TOKEN | invent a long random word, e.g. `hunter-blue-tiger-8841` |
| CRON_SECRET | invent another long random word |
| WHATSAPP_TOKEN | (fill in Step 5, you can add it later) |
| PHONE_NUMBER_ID | (fill in Step 5) |
| WHATSAPP_APP_SECRET | (fill in Step 5) |

3. Click **Deploy**. You get an address like `https://deal-hunter-xyz.vercel.app`. Open it and sign in with the email/password from Step 1.4.
4. You can already add consents and stock. WhatsApp comes next.

## STEP 5: Connect WhatsApp (Meta Cloud API) - 30 min
1. developers.facebook.com > **My Apps > Create App** > type **Business** > connect your Business account.
2. In the app, **Add product > WhatsApp > Set up**.
3. **WhatsApp > API Setup**: add and verify your number **+971 58 553 7110** (Meta sends a code by SMS or call). Copy the **Phone number ID** into Vercel as `PHONE_NUMBER_ID`.
4. **Permanent token** (the temporary one expires in 24 hours):
   business.facebook.com > **Settings > Users > System users > Add** (role Admin) > **Add assets** (your app, and your WhatsApp account, full control) > **Generate token** > tick `whatsapp_business_messaging` and `whatsapp_business_management`. Copy it into Vercel as `WHATSAPP_TOKEN`.
5. App **Settings > Basic > App secret > Show**. Copy it into Vercel as `WHATSAPP_APP_SECRET`.
6. In Vercel: **Deployments > the latest > Redeploy** so the new values are used.
7. Meta app > **WhatsApp > Configuration > Webhook > Edit**:
   - **Callback URL:** `https://YOUR-VERCEL-ADDRESS/api/whatsapp/webhook`
   - **Verify token:** the exact `WHATSAPP_VERIFY_TOKEN` word from Step 4
   - Click **Verify and save**, then **Manage** and subscribe to **messages**.
8. Switch the app from Development to **Live** (top bar). Meta asks for a privacy policy URL and category. Until the app is Live, real customers' messages may not reach the webhook. Meta may also ask for business verification and display-name approval before you can message customers at scale.

## STEP 6: Test everything
1. Dashboard > **Consents**: add a seller (name, group name, status YES).
2. **Add stock**: choose that group, paste `Dell 7490 i5 8th 16GB/256GB - 650 AED - 10 Qty - Bur Dubai - Khalid`, click **Parse with AI**, check the row, **Save**. Try the included `sample-stock.csv` too.
3. **Search**: type `Need 5x Dell i5 16GB under AED 1500`. It shows what the bot would reply.
4. From another phone, WhatsApp your business number the same sentence. You should get "Available ✅ ..." within a few seconds. Check **Enquiries**.
5. Send something not in stock (e.g. `Need 10 MacBook Pro M2`). You get the "Noted..." reply and it appears under **Unfulfilled**.
6. Reply **YES** to an offer. The enquiry shows "Wants connect". You connect them manually. Seller numbers are never sent automatically.

---
## STEP 7: Onboard sellers (the new way to get stock) - 10 min
1. Dashboard > **Sellers** > fill company name and the seller's WhatsApp number (with country code). Add an email + password only if they should also get the web portal (`/seller/login`). Click **Add seller**.
2. Give the seller your WhatsApp business number. When they message it, the bot recognises their number as a seller (everyone else is treated as a customer).
3. First message: the bot shows the seller terms. They reply **AGREE** (or tick "I accept" in the portal). This is saved in the consent log.
4. Then they just send their stock as text, a CSV or an Excel file. The bot replies with what it understood. They reply **CONFIRM** to publish, or **CANCEL**. Other commands: **RENEW** (another 48 hours), **STOCK**, **HELP**, **STOP** (leave: their stock is removed and the withdrawal is logged).
5. Only numbers you registered under Sellers are treated as sellers, so strangers cannot inject stock. WhatsApp lists are limited to about 90 lines; bigger price lists go through the portal.
6. Sellers' names are never shown to customers or on the website. Every stock row remembers its seller, so you can see who to contact when a buyer says YES.

## STEP 8: The public website
Your site's home page (`/`) has an AI search bar and stock filters. Visitors can leave their WhatsApp number to be connected; those appear under **Enquiries** (channel: website). Prices and quantities are public; seller identity is not. Set `PUBLIC_SITE_ENABLED=false` to hide the site.

## STEP 9 (last): optional integrations
Instagram and Texnity are ready-made, switched-off slots. Follow `INTEGRATIONS.md` when you are ready. Nothing else depends on them.

## Daily use
1. Copy good stock messages from your seller groups > **Add stock** > Parse > check > Save.
2. Stock is live for 48 hours. Posting the same listing again **renews** it (new price/qty, new 48 hours). **Extend 48h** also works on the Stock page.
3. Check **Unfulfilled**: click **Forward to seller groups (copy)**, paste in your groups, then use **Reply to customer** when a seller answers.

---
## Notes
- **Expiry:** stock past 48 hours is never shown to customers (checked on every search). A cleanup job also switches it off once a day. Vercel's free plan only allows daily jobs; on a paid plan you can change `"0 2 * * *"` in `vercel.json` to `"0 * * * *"` for hourly.
- **Running on Replit instead:** import the project, add the same variables under Secrets, run `npm install && npm run build && npm start`. Replit has no built-in scheduler, so use a free service such as cron-job.org to call `https://YOUR-ADDRESS/api/cron/expire` daily with header `Authorization: Bearer YOUR_CRON_SECRET` (optional, since expiry is also checked at search time).
- **Costs:** Vercel and Supabase free tiers are enough to start. OpenAI is a fraction of a cent per message. Meta charges per conversation under its current pricing; check Meta's pricing page.

## Troubleshooting
| Problem | Fix |
|---|---|
| Can't sign in | Email must match `ADMIN_EMAILS` and the Supabase user. Redeploy after changing variables. |
| "No seller consent is recorded for..." | Add the group under **Consents** first (spelling must match). |
| Meta "Verify and save" fails | `WHATSAPP_VERIFY_TOKEN` in Vercel must exactly match; redeploy first. |
| Customer gets no reply | Check Vercel > Logs. Look at **Enquiries**: a red "Not delivered" note shows Meta's error. Check token, phone number ID, and that the app is Live. |
| "Bad signature" in logs | `WHATSAPP_APP_SECRET` is wrong or missing. |
| Parse fails | Check `OPENAI_API_KEY` and OpenAI billing. |
| Seller's message is treated like a customer | Their number must be added under Dashboard > Sellers (any format, with country code). |
| Seller's Excel file is rejected | Only `.xlsx` and `.csv` work. Re-save older `.xls` files as `.xlsx`. |

---
## Compliance
This system uses ONLY the official Meta WhatsApp Cloud API. No unofficial libraries, no scraping, no number extraction.
Seller consent is required: stock can only be added from groups with a recorded YES, and sellers who withdraw are blocked.
Stock is added by the admin (from groups where sellers consented), or by registered sellers themselves after accepting the terms. Every consent decision, including terms acceptance and withdrawal, is kept in the consent log.
Customers contact you first; you only reply to them. The service key and all data stay on your own Supabase project.

## Files
```
app/page.js                   public website (AI search + filters + enquiry form)
app/seller                    seller login and seller portal
app/dashboard/sellers         onboard / suspend sellers
app/api/seller, app/api/public  back-end for the portal and the website
app/api/instagram, app/api/channels/texnity   switched-off integration slots
lib/channels                  one adapter per messaging channel
lib/seller-agent.js           the seller WhatsApp flow (read back, CONFIRM, RENEW, STOP)
lib/publish.js                the single door stock goes through to enter the master inventory
DEVELOPER_HANDOVER.md         full guide for a developer (architecture, deployment, runbook, backlog)
INTEGRATIONS.md               how to plug in Texnity / Instagram
CODEX_PROMPT.md               ready-to-paste prompt for an AI coding agent
tests/logic.test.mjs          run with: npm test
app/login                     sign in
app/dashboard/...             overview, add stock, stock, search, enquiries, unfulfilled, consents
app/api/whatsapp/webhook      receives customer messages from Meta, replies via Cloud API
app/api/search-stock          GET ?q=  customer-style search (admin only)
app/api/cron/expire           daily cleanup of expired stock
app/api/admin/*, parse, stock dashboard back-end
lib/                          AI parser, matching, WhatsApp sender, agent logic
supabase/schema.sql           all database tables
vercel.json                   schedule for the cleanup job
.env.example                  every setting you need
```
