# Sakshi Mobile — Technical Architecture

Premium mobile retail website & management portal for **Sakshi Mobile, Omerga (Maharashtra)**.
Developed by **MoreTech Solution**.

---

## 1. System architecture

```
                    ┌──────────────────────────────────────────────┐
  Browser  ───────▶ │  Nginx / Caddy (HTTPS, gzip, HTTP→HTTPS)      │
                    └───────────────────────┬──────────────────────┘
                                            │
                    ┌───────────────────────▼──────────────────────┐
                    │  Node.js · Express 5 · TypeScript             │
                    │  ─ helmet (CSP, HSTS), CORS, rate limits      │
                    │  ─ /api/public/*   catalogue, branches, CMS   │
                    │  ─ /api/auth/*     login, session, password   │
                    │  ─ /api/admin/*    RBAC-protected management  │
                    │  ─ /sitemap.xml, /robots.txt (dynamic)        │
                    │  ─ serves React build (SPA fallback)          │
                    └──────┬───────────────────┬───────────────────┘
                           │ Drizzle ORM (pg)  │ upload_stream
                    ┌──────▼──────┐     ┌──────▼──────────┐
                    │ PostgreSQL  │     │ Cloudinary       │
                    │ 16          │     │ (local disk dev) │
                    └──────┬──────┘     └─────────────────┘
                           │ pg_dump (custom format)
                    ┌──────▼──────┐
                    │ /data/backups│
                    └─────────────┘
```

* **Frontend** – React 18 + TypeScript + Vite, Tailwind CSS, React Router 6 (code-split routes),
  TanStack Query (server state & caching), React Hook Form + Zod (forms), Framer Motion (motion),
  Swiper (sliders), Recharts (analytics), Lucide icons, react-helmet-async (SEO).
* **Backend** – Express 5 (native async error handling), Zod validation on every input, Drizzle ORM,
  bcrypt password hashing, JWT session in an **HTTP-only cookie**, multer + magic-byte image checks.
* **Single deployable** – Express serves the built React app, so one container/process runs the whole site.
  The client can also be hosted separately (set `VITE_API_URL` + `CORS_ORIGINS`).

### Request flow examples
* *Public product page* → `GET /api/public/products/:slug` → product + images + variants + branch availability + related + offers.
* *Admin saves product* → `PUT /api/admin/products/:id` → `requireAuth` → `requirePermission('PRODUCTS','edit')` → Zod parse → transaction (product, images, variants, branch rows **within the admin's branches only**) → activity log.

---

## 2. Folder structure

```
sakshi-mobile/
├── client/                         React + Vite app
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── main.tsx                Providers (Query, Router, Helmet, Toast, Auth, Compare)
│   │   ├── App.tsx                 All routes (public + /super-admin + /admin)
│   │   ├── index.css               Tailwind layers & design tokens
│   │   ├── types.ts                Shared API types
│   │   ├── lib/                    api client, formatters, WhatsApp builder
│   │   ├── context/                auth (session) & compare (localStorage)
│   │   ├── hooks/useSite.ts        site-wide settings/CMS
│   │   ├── components/             UI kit, layout, cards, PhoneArt, InquiryForm, Seo…
│   │   ├── pages/public/           15 public pages
│   │   └── admin/                  layout, nav, generic ResourcePage, admin pages
│   ├── tailwind.config.js
│   └── vite.config.ts              dev proxy → API, vendor chunking
├── server/
│   ├── drizzle/                    SQL migrations (generated)
│   ├── src/
│   │   ├── index.ts / app.ts       bootstrap & middleware chain
│   │   ├── config/env.ts           validated environment
│   │   ├── db/                     schema.ts, migrate.ts, seed.ts
│   │   ├── lib/                    catalog queries, validation, storage, session, permissions…
│   │   ├── middleware/             auth/RBAC, security (rate limit, CSRF), errors
│   │   ├── routes/                 auth, public, seo, admin/*
│   │   └── scripts/backup.ts       CLI backup for cron
│   └── drizzle.config.ts
├── deploy/                         nginx.conf, PM2 ecosystem
├── docs/                           ARCHITECTURE.md, BACKUP.md
├── Dockerfile · docker-compose.yml
└── README.md
```

---

## 3. Database schema (PostgreSQL, normalised)

All tables have primary keys, `created_at` / `updated_at` (auto-updated) where relevant, and
**soft delete** (`deleted_at`) on business entities (users, branches, brands, categories, products, offers).
Soft-deleting releases unique values (slug/SKU/code) so they can be reused.

| Table | Purpose | Key columns / constraints |
|---|---|---|
| `users` | Admin accounts | `login_id` UNIQUE, `password_hash` (bcrypt 12), `role` enum SUPER_ADMIN/ADMIN, `is_active`, `token_version` (session revocation), lockout fields |
| `admin_profiles` | Name, phone, designation | `user_id` UNIQUE FK → users |
| `admin_permissions` | Per-module CRUD flags | UNIQUE(`user_id`,`module`) |
| `admin_branches` | Branches an admin manages | UNIQUE(`user_id`,`branch_id`) |
| `branches` | Unlimited branches | `code` UNIQUE, `slug` UNIQUE, type enum, address fields, phone/WhatsApp/email, `opening_hours` JSONB, maps URL, lat/lng, `services` JSONB, `is_active` |
| `branch_brands` | Available brands per branch | UNIQUE(`branch_id`,`brand_id`) |
| `brands` | Brands | `name`, `slug` UNIQUE, logo, banner, accent colour |
| `categories` | Mobile/Accessory categories | `slug` UNIQUE, `type` enum |
| `products` | Catalogue | `sku` UNIQUE (Product ID), `slug` UNIQUE, FK brand & category, MRP / selling / offer price (₹, integer), RAM/storage GB, display, camera, battery, processor, description, warranty, `stock_status` enum, featured, active; indexes on brand, category, price, featured, stock, created |
| `product_images` | Gallery | FK product (cascade), optional variant, Cloudinary `public_id`, `sort_order` |
| `product_variants` | Colour variants | UNIQUE(`product_id`,`color_name`), hex, image, stock |
| `branch_products` | Branch availability | UNIQUE(`branch_id`,`product_id`), branch stock & optional branch price |
| `offers` | Offers | `slug` UNIQUE, type enum, discount type/value, product/brand scope, validity window |
| `branch_offers` | Branch-specific offers | UNIQUE(`branch_id`,`offer_id`) — no rows = valid at all branches |
| `inquiries` | Customer leads | type & status enums, FK product/branch/offer (SET NULL), `remarks` JSONB timeline, contacted/resolved timestamps; indexes on status, branch, type, created |
| `testimonials` | Reviews | rating 1–5, active flag |
| `banners` | Promotional banners | placement enum (HOME_HERO / HOME_PROMO / OFFERS_PAGE), schedule, CTA |
| `cms_pages` | Editable content blocks | `key` UNIQUE (`announcement`, `home_hero`, `why_choose`, `about`, `contact`, `footer`, `social`, `privacy`, `terms`), JSONB content |
| `activity_logs` | Audit trail | user, action, entity, details JSONB, IP, user-agent |
| `bills` | Invoices | `bill_number` UNIQUE, `public_token` UNIQUE (customer link), FK branch, customer details, all money in **paise**, CGST/SGST, round-off, payment mode/ref, status PAID/PARTIAL/CANCELLED, cancel reason, `whatsapp_sent_at`; indexes on branch+date, mobile, status |
| `bill_items` | Invoice lines | FK bill (cascade), optional FK product, description, HSN, IMEI/serial (indexed), qty, rate, discount, GST rate, taxable, GST, line total |
| `bill_counters` | Bill numbering | UNIQUE(`branch_id`,`financial_year`) — atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` |
| `system_settings` | Key/value settings | `general` (site name, **default WhatsApp**, phone, email…), `seo` (route → meta) |

Demo rows carry `is_demo = true` and can be purged from **System Settings → Remove demo data**.

---

## 4. API route plan

All responses are JSON. Errors: `{ "error": string, "details"?: { field: message } }`.
State-changing requests must send header `X-Requested-With: SakshiMobile` (CSRF guard).

### Public — `/api/public`
| Method | Route | Description |
|---|---|---|
| GET | `/site` | Settings, SEO map, announcement/contact/footer/social CMS, categories, brands |
| GET | `/home` | Hero CMS, banners, brands, featured/latest mobiles, accessories, offers, branches, testimonials, counters |
| GET | `/cms/:key` | `about`, `privacy`, `terms`, `contact`, `why_choose` |
| GET | `/products` | Search & filters: `search, brand, category, type, minPrice, maxPrice, ram, storage, availability, branch, featured, sort, page, limit` |
| GET | `/products/facets?type=` | Price range, RAM/storage options, brand & category counts |
| GET | `/products/compare?slugs=a,b` | Up to 4 products with full specs |
| GET | `/products/:slug` | Detail + branch availability + related + applicable offers |
| GET | `/brands`, `/brands/:slug` | Brand list (with counts) / brand detail, offers, branches |
| GET | `/categories` | Active categories |
| GET | `/offers?type=&branch=` | Active, in-date offers + offers-page banners |
| GET | `/branches`, `/branches/:slug` | Branch list / detail with brands, offers, products |
| GET | `/testimonials` | Active reviews |
| POST | `/inquiries` | Create inquiry (rate-limited, honeypot, consent) |
| GET | `/bills/:token` | Customer invoice via WhatsApp link (unguessable token, masked mobile, `noindex`) |

### Auth — `/api/auth`
`POST /login` (role resolved server-side → `redirectTo`), `POST /logout`, `GET /me`, `POST /change-password`.

### Admin — `/api/admin` (session required)
| Route | Permission |
|---|---|
| `GET /dashboard` | any admin (figures scoped to own branches) |
| `/bills` list + summary, `GET /bills/:id`, `POST /bills`, `POST /bills/:id/cancel`, `POST /bills/:id/whatsapp-sent`, `GET /bills/export.csv`, `GET /bills/customer?mobile=`, `GET /bills/settings` | BILLING (cancel = edit) |
| `/products` CRUD, `/products/options`, `PATCH /products/:id/flags` | PRODUCTS |
| `/variants` CRUD | PRODUCTS |
| `/brands`, `/categories` CRUD + `PATCH /:id/status` | BRANDS / CATEGORIES |
| `/offers` CRUD + status (admins: only offers limited to their branches) | OFFERS |
| `/branches` CRUD + status (admins: assigned branches only) | BRANCHES |
| `GET/PUT /branch-products/:branchId` | BRANCH_PRODUCTS |
| `/inquiries` list/detail, `PATCH /:id/status`, `POST /:id/remarks` | INQUIRIES (DELETE: super admin) |
| `/testimonials`, `/banners` CRUD | TESTIMONIALS / BANNERS |
| `/cms` list, `GET/PUT /cms/:key` | CMS |
| `/reports/summary`, `/reports/inquiries.csv`, `/reports/products.csv` | REPORTS |
| `POST /uploads?folder=` (multipart `files`) | any admin |
| `/users` (create/edit/permissions/branches/activate/reset password) | **SUPER_ADMIN** |
| `/settings` (`general`, `seo`, `billing`, `purge-demo-data`) | **SUPER_ADMIN** |
| `/activity-logs` | **SUPER_ADMIN** |
| `/backups` list/create/download/delete | **SUPER_ADMIN** |

---

## 5. UI design system

| Token | Value |
|---|---|
| Font | **Poppins** 300–800 |
| Navy | `#0A0F2C` (navy-900), `#060920` (950) — dark surfaces, header, footer, dashboard sidebar |
| Electric blue | `#2563FF` — primary actions, links, focus rings |
| Purple | `#7C3AED` — gradients, eyebrows, accents |
| Orange | `#FF7A18` — offers, highlights, discount badges |
| Brand gradient | `135deg #2563FF → #7C3AED → #FF7A18` (animated `gradient-x`) |
| Radius | cards `rounded-3xl`, inputs/buttons `rounded-xl` |
| Shadows | `shadow-card`, `shadow-card-hover`, coloured `shadow-glow*` |
| Surfaces | `glass` (white/5 + blur) on dark; white cards on `slate-50` |

**Components**: Button (primary/flame/secondary/outline/ghost/light/whatsapp/danger), StockBadge, DemoBadge,
SectionHeading, PageHeader, ProductCard (hover lift, image swap, colour swatches, compare toggle),
BranchCard, OfferCard, Modal, Toast, Pagination, Skeleton, PhoneArt (SVG phone used until real photos are uploaded).

**Motion**: page transitions, hero parallax & floating phones, animated gradient blobs, scroll-reveal,
staggered cards, image zoom on product gallery, animated counters, animated mobile menu & nav pill,
spring dashboard sidebar. All motion respects `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` + CSS).

---

## 6. Security

* bcrypt (12 rounds) password hashing, strong password policy, account lockout after 5 failures (15 min)
* JWT in **HTTP-only, SameSite=Lax, Secure (prod)** cookie; `token_version` revokes sessions on deactivate/password reset
* RBAC (SUPER_ADMIN / ADMIN) + per-module CRUD permissions + branch scoping — enforced on the **server**
* Zod validation on every body/query; HTML stripped from all text & CMS JSON (stored-XSS defence); React escapes output
* Drizzle parameterised queries (SQL-injection safe); LIKE patterns escaped
* helmet: CSP, HSTS, frame-ancestors none, referrer policy; CORS allow-list
* Rate limits: API, login, inquiries, uploads; honeypot on inquiry form; CSRF header guard
* Uploads: memory storage, size limit, MIME allow-list **and magic-byte verification**, random filenames, Cloudinary re-encoding
* Activity logging of every admin write, login, export & backup; CSV formula-injection guard
* Secrets only in server `.env` — the frontend bundle contains no keys

## 7. Performance & SEO

Route-level code splitting + vendor chunks, lazy images with Cloudinary `f_auto,q_auto,w_*` srcsets,
TanStack Query caching, short public `Cache-Control`, gzip compression, skeleton loaders.
Per-page `<title>`, description, canonical, Open Graph/Twitter tags (overridable in SEO Management),
JSON-LD `Product`, `MobilePhoneStore` (with address, geo, opening hours), dynamic `sitemap.xml` and `robots.txt`.

## 8. Future e-commerce readiness

The catalogue already separates product, variant, branch stock and price. Planned additions slot in as new tables/routes
without touching existing ones: `customers`, `carts`/`cart_items`, `orders`/`order_items`, `payments` (Razorpay/UPI webhook route),
`shipments`, `inventory_movements` (per branch, replacing the stock enum with quantities), and a POS sync endpoint.
Role enum can be extended (e.g. `CUSTOMER`) while admin auth stays separate.
