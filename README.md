# Sakshi Mobile — Website & Management Portal

Premium, motion-rich mobile retail website for **Sakshi Mobile, Omerga (Maharashtra)** with a
Super Admin / Admin management portal. Developed by **MoreTech Solution**.

**Stack:** React · TypeScript · Vite · Tailwind · Framer Motion · TanStack Query · React Hook Form · Zod · Swiper · Recharts
· Node.js · Express · Drizzle ORM · PostgreSQL · Cloudinary

📐 Architecture, schema, API plan and design system → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
💾 Backups → [`docs/BACKUP.md`](docs/BACKUP.md)

---

## Features

**Public website (15 pages):** Home · All Mobiles · Product Details · Accessories · Brands · Brand Details · Latest Offers ·
Compare Mobiles · Our Branches · Branch Details (`/branches/omerga`) · About · Contact · Privacy Policy · Terms · Admin Login.

* Search (`Ctrl K`), filters (brand, category, price, RAM, storage, availability, branch), sorting, pagination
* Product gallery with zoom, colour variants, specs, branch availability, related products, compare (up to 4)
* WhatsApp inquiries for products, branches, offers, exchange, EMI and general — pre-filled messages,
  **branch-specific number** with fallback to the Super Admin's default number (never hard-coded)
* Inquiry form with validation, honeypot & rate-limiting
* All content (hero, announcement, banners, about, contact, footer, social, legal pages, reviews) editable in the CMS
* SEO: per-page meta/OG tags, JSON-LD (Product, MobilePhoneStore), dynamic sitemap & robots.txt

**Billing counter (POS):**
* Search products or add custom items, IMEI / serial per item, quantity, discount, GST % per line
* Automatic bill numbers per branch & financial year — `SM/OMG-01/26-27/00001`
* GST-inclusive or exclusive pricing, CGST/SGST split, round-off, amount in words
* Cash / UPI / Card / EMI / Bank transfer / Mixed, partial payments with balance due
* Returning customer auto-fill by mobile number
* Print or save as PDF (A4 invoice); **Send on WhatsApp** — opens WhatsApp with the bill summary and a private link
  (`/bill/<token>`) where the customer can view & download the full invoice (mobile number masked)
* Bills are never deleted — only cancelled with a reason (audit trail); list, search by bill no / mobile / IMEI, CSV export
* Every bill is stored in PostgreSQL, so it is included in the database backups
* Dashboard shows today's sales, bills today and this month's sales

* **Automatic WhatsApp:** with the WhatsApp Business Cloud API configured, only the customer's mobile number is needed —
  **Save & send on WhatsApp** delivers the bill automatically (status, retry & manual fallback on every bill).
  Setup guide → [`docs/WHATSAPP_API.md`](docs/WHATSAPP_API.md). Without it, click-to-chat is used.

**Management portal** — one login page, role detected by the server:
* `SUPER_ADMIN` → `/super-admin`: analytics, billing counter & bills, admin management (permissions + branch assignment), branches, products,
  variants, brands, categories, offers, inquiries, Website CMS, banners, testimonials, SEO, reports, activity logs,
  system settings, database backups
* `ADMIN` → `/admin`: only the modules & actions granted, only for assigned branches

---

## Quick start (local development)

Requirements: **Node.js 20+** and **PostgreSQL 14+**.

```bash
# 1. install
npm run install:all

# 2. configure the API
cp server/.env.example server/.env
#    → set DATABASE_URL, JWT_SECRET (48+ random chars), SEED_SUPER_ADMIN_PASSWORD

# 3. create the database & tables, then seed
createdb sakshi_mobile
npm run db:migrate
npm run db:seed          # Super Admin + settings + CMS + clearly-labelled demo catalogue

# 4. run (two terminals)
npm run dev:server       # http://localhost:4000
npm run dev:client       # http://localhost:5173  (proxies /api to :4000)
```

Login at **http://localhost:5173/admin/login** with `SEED_SUPER_ADMIN_LOGIN` / `SEED_SUPER_ADMIN_PASSWORD`
(default `superadmin` / `ChangeMe@12345`) — **change the password immediately** (Account → Change password).

### First steps after login
1. **System Settings** → set the default WhatsApp number (e.g. `91XXXXXXXXXX`), phone & email, and the **Billing & invoice** section (GSTIN, GST rate, HSN as advised by your CA, invoice prefix, terms).
   WhatsApp buttons stay disabled until a number is configured.
2. **Branches → Sakshi Mobile — Omerga** → enter the verified address, pincode, phone, WhatsApp, timings, map coordinates, photo.
3. **Products** → add real products with photos & prices, then **System Settings → Remove demo data**.
4. **Website CMS** → update About Us, contact details, social links and review the Privacy Policy / Terms templates.
5. **Admin Management** → create staff accounts, assign branches & permissions.

### Demo data policy
No real prices, phone numbers, addresses or offers were invented. Seeded catalogue items contain “Demo” in their names,
carry `is_demo = true` and show a **Demo** badge on the website. The Omerga branch is seeded with blank contact details
and a “Details pending” badge until the owner verifies them.

---

## Scripts

| Location | Command | Purpose |
|---|---|---|
| root | `npm run build` | Build client & server |
| server | `npm run dev` | API with hot reload |
| server | `npm run db:generate` | Generate a new migration after editing `schema.ts` |
| server | `npm run db:migrate` / `db:migrate:prod` | Apply migrations (dev / compiled) |
| server | `npm run db:seed` / `db:seed:prod` | Seed |
| server | `npm run backup` | Create a database backup |
| server | `npm run db:studio` | Drizzle Studio |
| client | `npm run dev` / `build` / `preview` | Vite |

## Environment variables

See [`server/.env.example`](server/.env.example) (API) and [`client/.env.example`](client/.env.example)
(`VITE_API_URL` — leave empty when the API serves the client on the same domain).
Never commit real `.env` files; the frontend never receives secrets.

---

## Deployment

### Option A — Docker (recommended)
```bash
cp .env.docker.example .env.docker      # fill in secrets & PUBLIC_SITE_URL
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker exec app node dist/db/seed.js   # first time only
```
The container runs migrations on start, serves the website + API on `127.0.0.1:4000`, and stores uploads/backups in the `appdata` volume.
Put Nginx (see [`deploy/nginx.conf`](deploy/nginx.conf)) or Caddy in front for **HTTPS** (`certbot --nginx`).

### Option B — VPS with PM2
```bash
npm run install:all && npm run build
cd server && cp .env.example .env    # set NODE_ENV=production, SERVE_CLIENT=true, DATABASE_URL, …
npm run db:migrate:prod && npm run db:seed:prod
pm2 start ../deploy/ecosystem.config.cjs && pm2 save
```

### Option C — Managed platforms
* **Render / Railway:** build `npm run install:all && npm run build`, start `cd server && npm run db:migrate:prod && npm start`,
  set `SERVE_CLIENT=true`, `CLIENT_DIST_DIR=../client/dist`, `DATABASE_SSL=true` for managed Postgres.
* Use **Cloudinary** for images on platforms with ephemeral disks.

### Production checklist
- [ ] HTTPS enabled, `NODE_ENV=production` (secure cookies + HSTS)
- [ ] Strong `JWT_SECRET`, DB password and Super Admin password changed
- [ ] Cloudinary configured
- [ ] Daily backups scheduled and copied off-site ([docs/BACKUP.md](docs/BACKUP.md))
- [ ] Verified business details entered, demo data removed
- [ ] `PUBLIC_SITE_URL` set to the real domain (sitemap, OG URLs, CORS)
- [ ] Sitemap submitted in Google Search Console

---

## Project structure
```
client/   React app (public site + dashboards)
server/   Express API, Drizzle schema, migrations, seed, backup script
deploy/   nginx & PM2 configs
docs/     architecture & backup guides
```

© Sakshi Mobile · Built by MoreTech Solution
