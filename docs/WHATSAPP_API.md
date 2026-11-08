# Automatic bill sending on WhatsApp (WhatsApp Business Cloud API)

With this set up, the billing counter needs **only the customer's mobile number**:
press **Save & send on WhatsApp** and the server sends the bill to the customer automatically —
no WhatsApp app needs to be opened on the counter.

Without it, the website still works: bills use click-to-chat (WhatsApp opens with the message
ready and staff presses **Send**).

---

## What the customer receives
A WhatsApp message from the shop's business number:

> Hello Ramesh, thank you for shopping at Sakshi Mobile.
> Your bill no. SM/OMG-01/26-27/00001 of ₹27,898.00 is ready.
> View / download your bill: https://your-domain.in/bill/xxxxxxxx

The link opens the full invoice (printable / save as PDF). The customer's mobile number is masked on that page.

---

## One-time setup (shop owner / developer)

### 1. Meta Business account
1. Go to **business.facebook.com** and create a Business portfolio for *Sakshi Mobile*.
2. Complete **Business verification** (GST certificate / shop registration documents).
   Unverified accounts have low daily sending limits.

### 2. Developer app + WhatsApp
1. Open **developers.facebook.com** → *My Apps* → **Create App** → type **Business**.
2. Add the **WhatsApp** product to the app and select your business portfolio.
3. **Add a phone number** for the shop. Use a number that will be the official sender.
   (A number already used in the normal WhatsApp app may need to be migrated or use Meta's
   "coexistence" option — follow the on-screen instructions in WhatsApp Manager.)
4. Copy the **Phone number ID** (not the phone number itself) → `WHATSAPP_PHONE_NUMBER_ID`.

### 3. Permanent access token
The token shown on the "API Setup" page expires in 24 hours — do not use it in production.
1. Business settings → **Users → System users** → *Add* (role: Admin).
2. **Assign assets** → your app (full control) and your WhatsApp account.
3. **Generate new token** → select the app → permissions
   `whatsapp_business_messaging` and `whatsapp_business_management` → expiry **Never**.
4. Copy it → `WHATSAPP_ACCESS_TOKEN`. Keep it secret (server `.env` only).

### 4. Create the message template
WhatsApp Manager → **Message templates** → **Create template**
* **Category:** Utility
* **Name:** `bill_invoice`  (must match `WHATSAPP_TEMPLATE_NAME`)
* **Language:** English (`en`)  (must match `WHATSAPP_TEMPLATE_LANG`)
* **Body** (exactly 5 variables, in this order):
  ```
  Hello {{1}}, thank you for shopping at {{2}}.
  Your bill no. {{3}} of ₹{{4}} is ready.
  View / download your bill: {{5}}
  ```
* Sample values for review: `Ramesh` · `Sakshi Mobile` · `SM/OMG-01/26-27/00001` · `27,898.00` · `https://your-domain.in/bill/sample`

Submit and wait for **Approved** status (usually minutes to a few hours).
A Marathi template can be added the same way (e.g. language `mr`) — then set `WHATSAPP_TEMPLATE_LANG=mr`.

### 5. Configure the server
In `server/.env` (or `.env.docker` for Docker):
```dotenv
WHATSAPP_ACCESS_TOKEN=EAAG...your-permanent-token
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TEMPLATE_NAME=bill_invoice
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_API_VERSION=v23.0
```
Also make sure `PUBLIC_SITE_URL` is your real HTTPS domain — it is used in the bill link.
Restart the server. **System Settings** will show *“Connected to WhatsApp Business Cloud API”*
and the counter button changes to **Save & send on WhatsApp**.

For Docker, add the same variables under `app → environment` in `docker-compose.yml`.

---

## Costs
Meta charges per delivered template message (per-message pricing since 1 July 2025).
Bills use the **Utility** category — the cheapest business-initiated type. As of 2026 the
India utility rate is roughly ₹0.12–0.15 per message (plus GST); check Meta's current rate card
on developers.facebook.com before budgeting. A billing partner (BSP) is **not** required —
this project calls Meta's Cloud API directly, so there is no monthly platform fee.

## Good practice
* Tell customers at the counter that the bill will come on WhatsApp (Meta requires opt-in).
* If sending fails, the bill is still saved; the bill page shows the reason with **Retry** and
  **Send manually** buttons. The Bills list marks failed sends with a ⚠ icon.
* Common errors:
  | Error | Meaning |
  |---|---|
  | `131026` / recipient not on WhatsApp | Customer's number has no WhatsApp — print the bill instead |
  | `132001` template does not exist | Name/language in `.env` doesn't match an **approved** template |
  | `132000` parameter count mismatch | Template body must have exactly 5 variables |
  | `190` invalid token | Token expired — create a System User token with no expiry |
  | Could not reach WhatsApp servers | Server has no internet access to graph.facebook.com |
* Graph API versions are retired periodically; if Meta announces retirement of the version in
  `WHATSAPP_API_VERSION`, change it to a newer one (e.g. `v24.0`) — no code change needed.
