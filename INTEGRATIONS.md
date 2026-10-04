# Integrations: plug-and-play slots (do these LAST)

The app works without any of this. Each slot below is switched off until you fill its settings.
Everything goes through one shared brain (`lib/agent.js`), so a new channel only needs a small adapter in `lib/channels/`.

| Channel | Status | Needs manual work from you |
|---|---|---|
| WhatsApp (Meta Cloud API) | READY | Meta setup in README Step 5 |
| Website (public search + catalog) | READY | Nothing. Set `PUBLIC_SITE_ENABLED=false` to hide it |
| Texnity / other platform | SLOT (off) | Get their webhook + send format, edit one file |
| Instagram DMs | SLOT (off, untested) | Meta app review + linked Instagram professional account |

## 1. Texnity (www.texnity.com) or any third-party messaging platform
I do not know Texnity's API, so this is a generic adapter. Nothing is assumed to work until you test it.

1. Ask Texnity (or read their docs) for: (a) how they deliver incoming messages to your server (webhook URL, payload JSON, how to sign/secure it), (b) how replies are sent (either they send our reply for us, or we call their send API).
2. In Vercel add: `TEXNITY_WEBHOOK_SECRET` (a long random word you invent and give to Texnity as the secret/header value).
3. Tell Texnity to POST messages to `https://YOUR-SITE/api/channels/texnity` with header `x-webhook-secret: <that secret>`.
4. Edit `lib/channels/texnity.js`:
   - `normalizeInbound()`: map their payload to `{from, name, text, messageId}`. Default assumes `{from, name, text, message_id, channel}`.
   - Reply mode `TEXNITY_REPLY_MODE`:
     `inline` (default): our response is `{"reply":"..."}` and their platform delivers it.
     `push`: we call `TEXNITY_SEND_URL` with `TEXNITY_API_KEY`; edit `send()` to match their API.
5. Test by sending a message through Texnity and checking Dashboard > Enquiries.

Notes: if Texnity carries WhatsApp traffic, send `channel: "whatsapp"` in the payload so registered sellers are recognized by their number. Do not run the same WhatsApp number through both Texnity and this app's Meta webhook unless Texnity is built to forward, or you will get double replies.

## 2. Instagram DMs
1. You need an Instagram **professional (business/creator) account** linked as Meta requires.
2. In your Meta app add the Instagram messaging product and request the messaging permission. Meta **app review** is required for live use and can take days or weeks.
3. Add in Vercel: `INSTAGRAM_TOKEN` (access token). Optional: `INSTAGRAM_VERIFY_TOKEN`, `INSTAGRAM_APP_SECRET` (they fall back to the WhatsApp ones if the same Meta app is used).
4. In Meta set the webhook callback to `https://YOUR-SITE/api/instagram/webhook` with your verify token and subscribe to messages.
5. IMPORTANT: `lib/channels/instagram.js` was written from memory of Meta's API and has NOT been tested. Check the send endpoint and webhook payload against Meta's current Instagram Messaging documentation before relying on it.
6. Instagram users get the customer flow only (search and enquire). Sellers are matched by phone number, so they stay on WhatsApp or the portal.

## 3. Website
Live at `/` (public search + stock filters). Visitors never see seller names, numbers or groups.
Prices and quantities ARE public. If you do not want that, set `PUBLIC_SITE_ENABLED=false` or ask your developer to hide prices in `lib/public.js`.
Website enquiries land in Dashboard > Enquiries (channel "website"). You contact those visitors yourself by phone or WhatsApp; the dashboard cannot reply on the website channel.

## Manual interventions checklist (things no code can do for you)
- Create accounts: Supabase, OpenAI, GitHub, Vercel, Meta Developer, Meta Business.
- Register your WhatsApp number with the Cloud API and complete Meta business verification / display name approval.
- Switch the Meta app to Live (privacy policy URL needed).
- Instagram: link account, pass Meta app review.
- Texnity: obtain their API details and finish the adapter.
- Have a lawyer review the seller terms (`lib/terms.js`) and write a privacy policy / terms for the website.
- Check UAE data-protection requirements for storing seller and customer data.
