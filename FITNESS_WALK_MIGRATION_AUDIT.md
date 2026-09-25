# Fitness Walk Registration Portal — Technical Audit & Migration Plan

**Project:** Mowe-Ibafo X Community Fitness Walk 2026
**Audit scope:** Full source inspection of `src/` (React frontend) and `backend/` (PHP API), `dist/`, `public/`, root config files.
**Audit date:** 2026-09-25
**Document purpose:** Hand-off specification for migrating **PHP + MySQL → Node.js/Express + Supabase PostgreSQL**, keeping **React on Netlify**.

> **No files were modified during this audit.**

---

## ⚠️ READ THIS FIRST — Three Findings That Change The Migration

These three facts were established by direct code inspection and materially reduce the scope of the migration. Each is explained in full in the referenced section.

| # | Finding | Evidence | Section |
|---|---|---|---|
| 1 | **There is NO payment system.** No provider, no amount, no currency, no webhook, no payments table. Registration is completely free. | No `payment`/`paystack`/`flutterwave`/`stripe`/`amount`/`currency` string exists anywhere in `src/` or `backend/`. `schema.sql` defines 6 tables, none payment-related. | [§7](#7-payment-system) |
| 2 | **There are NO participant user accounts.** Participants never log in and have NO password. The only accounts in the entire system are `admins` (staff logins). | `participants` table has no password column. Only `AuthController::login()` exists, querying `admins`. | [§6](#6-authentication-and-security), [§15](#15-existing-user-migration) |
| 3 | **Most of the backend API is never called by the frontend.** Only 8 of 22 endpoints are used. | Cross-referenced every `fetch()` in `src/` against every route in `backend/api/index.php`. | [§17](#17-api-migration-map) |

**Consequence:** "existing user migration" (§15) is really only "migrate ONE admin account". The heavy lifting is in the file/storage, QR/pass generation, and email subsystems — not in payments or user auth.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Frontend Audit](#2-frontend-audit)
3. [Current PHP Backend](#3-current-php-backend)
4. [Database Audit](#4-database-audit)
5. [User Registration Flow](#5-user-registration-flow)
6. [Authentication and Security](#6-authentication-and-security)
7. [Payment System](#7-payment-system)
8. [Admin System](#8-admin-system)
9. [Files and Media](#9-files-and-media)
10. [Email and Notifications](#10-email-and-notifications)
11. [Environment Variables and Secrets](#11-environment-variables-and-secrets)
12. [Current Deployment](#12-current-deployment)
13. [Migration Plan](#13-migration-plan)
14. [MySQL → Supabase Mapping](#14-mysql--supabase-mapping)
15. [Existing User Migration](#15-existing-user-migration)
16. [Node.js Backend Structure](#16-nodejs-backend-structure)
17. [API Migration Map](#17-api-migration-map)
18. [Supabase Setup Requirements](#18-supabase-setup-requirements)
19. [Render Setup Requirements](#19-render-setup-requirements)
20. [Netlify Changes](#20-netlify-changes)
21. [Risks and Breaking Changes](#21-risks-and-breaking-changes)
22. [Migration Checklist](#22-migration-checklist)
23. [Final Summary](#23-final-summary)

---

## 1. PROJECT OVERVIEW

### What the application does

A public event-registration portal for the **Mowe-Ibafo X Community Fitness Walk 2026** (Mowe-Ibafo, Ogun State, Nigeria).

A visitor reads a marketing landing page, submits a registration form (name, email, phone, passport photograph), and the system immediately:

1. Generates a unique participant ID in the format `MIWC2026-000001`
2. Fetches/generates a QR code image encoding a verification URL
3. Renders a branded 900×500 JPEG "Attendee Pass" image using the PHP GD library
4. Persists a row in the `participants` table
5. Emails the participant the pass as an attachment

Separately, an **admin** logs in at `/admin`, views registration statistics, browses a participant table, creates sponsors, exports CSV, and scans participant QR codes with a device camera to confirm identity on the day of the event.

**Registration is free. There is no payment step of any kind.**

### Who uses it

| User type | Description | Authenticates? |
|---|---|---|
| **Visitor / Participant** | Anyone on the internet. Fills the registration form once. Receives a pass + QR. | **No.** No account, no password, no login. |
| **Admin / Staff** | Event organiser(s). Manages participants, sponsors, exports, QR scanning. | **Yes.** Email + password → JWT stored in `localStorage`. |
| **Event marshal** | Effectively an admin on a phone. Uses the `/admin` QR scanner at the walk. | Uses the same admin login. |

There is no third user type. There are no vendor, sponsor, or attendee self-service accounts.

### Main workflows

1. **Registration** — landing page → `/register` → form + photo upload → pass generated → confirmation email.
2. **Pass retrieval** — download the pass JPG from the success screen, or from the email attachment.
3. **Day-of verification** — marshal opens `/admin`, taps "Open Camera", scans the participant's QR → API returns name/email/phone/status.
4. **Admin reporting** — view total/verified counts, list participants, export CSV.
5. **Sponsor management** — add sponsor with logo; sponsors render on the landing page.
6. **Contact** — ⚠️ the `POST /contact` endpoint exists in the backend but **no frontend code calls it**. See §21.

### Current frontend architecture

- **React 19.2.8** SPA, TypeScript, built with **Vite 8.2.1**.
- **Routing:** `wouter` v3 (`<Switch>`/`<Route>`), 4 routes: `/`, `/register`, `/admin`, 404.
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`, plus a heavy inline-style + framer-motion design system. Dark theme, green accent `#22C55E`.
- **Data fetching:** **raw `fetch()` calls inline in page components.** There is **no API service layer, no shared client, and no `.env` usage.** `@tanstack/react-query` is installed and a `QueryClientProvider` is mounted in `App.tsx`, but **no component uses it** — dead infrastructure.
- **Forms:** Hand-rolled `useState` + manual validation. `react-hook-form` and `zod` are installed but **never imported anywhere**.
- **UI kit:** shadcn/ui "new-york" style — ~50 components in `src/components/ui/`. Almost all are **unused**; the 3 pages use raw Tailwind classes instead.
- **Build output:** `dist/` is committed to the repo and already contains a built bundle (`assets/index-*.js` + `index-*.css`).

### Current backend architecture

- **Single-file procedural router** (`backend/api/index.php`) — no framework. It parses `REQUEST_URI` into `$segments` and dispatches through a chain of `if` statements.
- **MVC-ish layering:** `models/` (PDO data access) → `controllers/` (request handling) → `helpers/` (utilities) + `middleware/AuthMiddleware.php`.
- **Response envelope:** every endpoint returns `{ success, message, data?, errors? }` via `helpers/Response.php`.
- **Auth:** hand-rolled HS256 JWT (`helpers/JWT.php`) using `hash_hmac` + `hash_equals`. No JWT library.
- **DB access:** PDO with `ATTR_EMULATE_PREPARES => false` (true native prepared statements).
- **Images:** PHP GD library for the attendee pass; `finfo` for MIME detection.
- **QR codes:** downloaded over HTTP from the free third-party `api.qrserver.com` — **never generated locally**.
- **Email:** raw PHP `mail()` with hand-built MIME headers. SMTP constants are defined but **never used** (dead config).

### Current database architecture

- **MySQL** (README states 5.7+ / MariaDB 10+), charset `utf8mb4`, InnoDB.
- **6 domain tables** (+1 log table): `admins`, `event_settings`, `participants`, `sponsors`, `gallery`, `contacts`, `email_log`.
- **Zero foreign keys.** All relationships are implicit and unenforced.
- **Server timezone:** `schema.sql` sets `time_zone = "+01:00"`; app timezone is `Africa/Lagos`.
- **Connection:** `models/Database.php` singleton, DSN `mysql:host=...;dbname=...;charset=utf8mb4`.

### Current deployment setup

```
React SPA  ──built by Netlify──▶  Netlify CDN  (mowefitnesswalk.netlify.app)
                                      │
                                      │  fetch() + CORS, Bearer JWT
                                      ▼
                              cPanel subdomain api.whitehallpavilionmotel.com
                                      │
                          Apache mod_rewrite → /api/index.php
                                      │
                          PDO ──▶ MySQL (whitehal_mixc @ localhost)
                                      │
                          local disk: backend/uploads/
```

### Important third-party services / APIs

| Service | Where used | Notes for migration |
|---|---|---|
| **Netlify** | Builds and hosts the React SPA (`netlify.toml`, `public/_redirects`). | Stays. Only API URL changes. |
| **cPanel shared hosting** | Hosts the PHP API on the `api.` subdomain. | Replaced by Render. |
| **MySQL** (cPanel) | All application data. | → Supabase PostgreSQL. |
| **api.qrserver.com** | `helpers/QRCode.php` downloads a PNG QR. The rendered QR **encodes the old `verify.php` URL**. | ⚠️ **Already-issued QR images keep pointing at the dead PHP domain.** See §9 and §21. |
| **PHP `mail()`** | `helpers/Mailer.php`; delivers via the host's local MTA. | → Nodemailer/Resend. `mail()` does not exist on Render. |
| **Unsplash** | `Home.tsx` hardcodes 7 remote `images.unsplash.com` URLs. | Cosmetic only. |
| **Google Fonts (Inter)** | `index.html`. | No change. |

---



## 2. FRONTEND AUDIT

### Stack versions (from `package.json`)

| Item | Version | Notes |
|---|---|---|
| React | **19.2.8** | `react-dom` 19.2.8 |
| Build tool | **Vite 8.2.1** + `@vitejs/plugin-react` 6.0.5 | ⚠️ Vite 8 is very new. `vite.config.ts` is passed explicitly via `--config` in every npm script. |
| Language | TypeScript `strict: true` | `npm run typecheck` runs `tsc --noEmit` |
| Routing | `wouter` ^3.3.5 | |
| Data (unused) | `@tanstack/react-query` 5.101.4 | provider mounted, zero consumers |
| Forms (unused) | `react-hook-form` ^7.55, `zod` 4.4.3, `@hookform/resolvers` | zero imports |
| Animation | `framer-motion` 13.0.0 | used in Home/Register |
| Icons | `lucide-react` 1.29.0 | |
| CSS | `tailwindcss` 4.3.3 + `@tailwindcss/vite` | v4, no `tailwind.config.js` |
| Toasts (unused) | `sonner` ^2.0.7, Radix toast | `Toaster` mounted, never triggered |
| Charts (unused) | `recharts` ^2.15.2 | not imported by Admin |

**~50 shadcn/ui components** live in `src/components/ui/`. None of the 3 pages import them. Treat as dead weight; do not port.

### Main folders

| Folder | Contents |
|---|---|
| `src/pages/` | `Home.tsx` (25 KB), `Register.tsx` (18 KB), `Admin.tsx` (23 KB), `not-found.tsx` |
| `src/components/` | `Navbar.tsx`, `Footer.tsx`, `FloatingOrbs.tsx` (the only 3 used) |
| `src/components/ui/` | ~50 unused shadcn primitives |
| `src/lib/utils.ts` | `cn()` — `clsx` + `tailwind-merge` |
| `src/hooks/` | `use-mobile.tsx`, `use-toast.ts` — both unused |
| `public/` | `logo.png`, `community-photo.png`, 6× `image_*.png` (gallery), `favicon.svg`, `robots.txt`, `_redirects` |
| `dist/` | committed build output |

### Pages / routes

| Route | Component | Purpose | API calls |
|---|---|---|---|
| `/` | `Home.tsx` | Marketing landing page: hero, about, event timeline, static gallery carousel, sponsors strip, stats counters, CTA | `GET /sponsors` (1 call) |

### File / folder audit table

| File/Folder | Purpose | Depends On | Migration Notes |
|---|---|---|---|
| `src/App.tsx` | Router (`wouter`), mounts `QueryClientProvider`, `TooltipProvider`, `Toaster` | wouter, @tanstack/react-query | **Keep.** Unused providers can be dropped. |
| `src/main.tsx` | React root, imports `index.css` | react-dom/client | Keep. |
| `src/index.css` | Tailwind v4 entry + design tokens (`.glass-card`, `.neon-glow`, `.heading-gradient`, `.font-heading`) | tailwindcss | Keep verbatim. Custom classes are referenced by all 3 pages. |
| `src/pages/Home.tsx` | Landing page. Defines `useCounter`, `AnimatedCounter`, animation variants | framer-motion, lucide-react, wouter | Keep. **Change L81** hardcoded API URL. Sponsor fetch already fails soft. |
| `src/pages/Register.tsx` | Registration form + success screen | framer-motion, lucide-react, wouter | Keep. **Change L12** hardcoded API URL. Multipart `FormData` must keep field names `full_name`, `email`, `phone`, `photo`. |
| `src/pages/Admin.tsx` | Admin dashboard | react only | Keep. **Change L3** hardcoded API URL. ⚠️ L35–36 pre-fill admin credentials. |
| `src/pages/not-found.tsx` | 404 | — | Keep. |
| `src/components/Navbar.tsx` | Sticky nav; links to `/#about`, `/#event`, `/#gallery`, `/#sponsors`, `/admin` | wouter, lucide-react | Keep. **No API calls.** |
| `src/components/Footer.tsx` | Footer; contact info, `mailto:` link | wouter, lucide-react | Keep. Static — not wired to the `contacts` table. |
| `src/components/FloatingOrbs.tsx` | Decorative animated background | framer-motion | Keep. |
| `src/components/ui/*` (~50 files) | shadcn/ui primitives | radix-ui, cva | **Do not migrate.** Unused. |
| `src/hooks/*` | `use-mobile`, `use-toast` | — | **Do not migrate.** Unused. |
| `src/lib/utils.ts` | `cn()` helper | clsx, tailwind-merge | Keep (used by `ui/*` only). |
| `public/*` | Static images, logo, favicon, robots.txt, `_redirects` | — | Keep. Gallery images are hardcoded in `Home.tsx` L135–149, **not** read from the `gallery` table. |
| `index.html` | SPA entry, meta tags, Google Fonts | — | ⚠️ Meta description still reads "built on Replit". Update during migration. |
| `vite.config.ts` | Vite config; `@` alias → `src`; `outDir: dist` | — | Keep. |
| `netlify.toml` | Build `npm run build`, publish `dist`, SPA catch-all | — | Keep. |
| `public/_redirects` | `/* /index.html 200` | — | Keep (duplicates netlify.toml; harmless). |
| `dist/` | **Committed build output** | — | ⚠️ Stale artifacts in version control. Do not copy anywhere. |
| `backend/` | Entire PHP application | — | Being replaced. |
| `backend.zip` | Deployable archive of `backend/` (41 KB) | — | Contains `assets/`, `classes/`, `services/` as **empty dirs**. Disregard. |
| `.kilo/worktrees/platinum-nannyberry/` | ⚠️ **Unrelated project** (Foot-NFTs / TON blockchain app) | — | **Ignore entirely.** Its `App.tsx`, `views/`, `services/`, `package.json` belong to a different codebase. |

### Forms

Only **two** user-facing forms exist.

**A. Registration form — `Register.tsx` L156–322**
- Fields: `name` (text), `email` (email), `phone` (tel), `photo` (file, drag-and-drop + click-to-browse).
- Client validation (L69–78): name non-empty; email `/^\S+@\S+\.\S+$/`; phone ≥7 digits; photo required.
- Live per-field "valid" checkmark (`CheckCircle2`) when the field looks OK.
- Inline field errors populated from the server's `json.errors`.
- `data-form-id="fitness-walk-registration"` (L157) — **inert**; no Netlify Forms POST is performed.
- ⚠️ No client-side file size/type check. A 50 MB file is submitted and rejected server-side with a 422.

**B. Admin login form — `Admin.tsx` L325–338**
- Fields: `loginEmail` (text), `loginPassword` (password).
- ⚠️ **Both pre-filled with hardcoded defaults** (`admin@mxcommunity.com` / `Admin@2026`) as `useState` initial values. Remove during migration.
- `required` is not set; only `disabled` while loading.

**C. Sponsor form — `Admin.tsx` L407–443** (a third form)
- Fields: `businessName` (required), `websiteUrl`, `whatsapp`, `priority` (number), `status` (select), `logoFile` (file).
- Submits `multipart/form-data` with `business_name`, `website_url`, `whatsapp`, `priority`, `status`, `logo`.

### Authentication-related components

There is **no auth component, no auth context, no auth hook, and no protected-route wrapper.** All auth logic is inline in `Admin.tsx`:
- `const [token, setToken] = useState(localStorage.getItem('admin_token'))` (L34)
- Login writes `localStorage.setItem('admin_token', token)` (L137)
- Logout removes it (L61)
- Every protected request manually adds `Authorization: Bearer ${token}`.
- ⚠️ **No 401 interceptor.** When the 24-hour JWT expires the dashboard shows a generic "Unable to load dashboard" and the admin is stuck — the only recovery is manually clearing `localStorage`. Fix during migration.

### Admin dashboard components

All of `Admin.tsx` — a single 526-line file, not decomposed. DOM order:

1. Header + Logout button
2. Login card (when no token)
3. Stat cards: Total Registrations, Verified, Sponsors (L349–362)
4. Participants table with "Export CSV" (L365–399)
5. Add Sponsor form + "Export Sponsors CSV" (L401–444)
6. Participant Verification: camera video pane + manual ID input + result card (L447–501)
7. Sponsors list with logos (L503–520)

⚠️ The `today` and `week_chart` stats returned by the API are **never rendered**. No chart exists. `recharts` is installed but unused.

### Payment-related components

**None.** No payment components exist. No amount, no currency, no checkout, no payment success/cancel route. Confirmed by exhaustive search across `src/`.

### QR / ticket components

| Concern | Implementation |
|---|---|
| QR **display** | None. The QR is baked into the server-rendered pass JPEG; the frontend never renders a QR. |
| QR **scanning** | `Admin.tsx` L246–292. `getUserMedia({ video: { facingMode: 'environment' } })` + the **native `BarcodeDetector` API** (`formats: ['qr_code']`), polled every 750 ms. |
| QR support | `BarcodeDetector` is **Chrome/Edge/Android only**. Absence is detected and reported. No library fallback (e.g. `jsQR`). ⚠️ **Safari and Firefox unsupported today.** |
| Ticket / pass | `Register.tsx` L358–366 "⬇ Download Attendee Pass" → `fetch(pass_url)` → blob → object URL → synthetic `<a download>`. |

⚠️ **Scanner bug:** `verifyParticipant()` is called with the *raw QR payload* (L277 → L226). The QR encodes the full URL `https://api.whitehallpavilionmotel.com/verify.php?id=MIWC2026-000001`, but the code sends that entire URL string to `GET /verify/{url}` and never extracts the `?id=` value. **QR scanning is therefore broken today; only the manual-ID box works.** The new backend must accept both a bare ID and a full legacy URL.

### API service / helper files

**There is none.** This is the single most important frontend structural gap.

- No `src/lib/api.ts`, no `src/services/`, no axios instance, no fetch wrapper, no interceptors.
- The API base URL is **hardcoded as a `const` in three separate files**:
  - `src/pages/Home.tsx` L81
  - `src/pages/Register.tsx` L12
  - `src/pages/Admin.tsx` L3
  
  All three contain the identical literal `https://api.whitehallpavilionmotel.com/api`.
- `.env.example` defines `VITE_API_URL` and `backend/README.md` documents setting it in Netlify — **but no source file ever reads `import.meta.env.VITE_API_URL`.** The variable is decorative. The only `import.meta.env` usage is `import.meta.env.BASE_URL` (asset paths, wouter router base).

> **Mandatory migration action:** create a single `src/lib/api.ts` exporting a configured base URL and fetch wrapper, then replace the three hardcoded constants. Otherwise the frontend must be hand-edited at cutover.

### Environment variables

| Variable | Declared? | Read by code? | Purpose |
|---|---|---|---|
| `VITE_API_URL` | ✅ `.env.example` | ❌ **no file reads it** | Intended: React → backend API base |

That is the complete list. There is no `.env`, `.env.production`, or `.env.local` in the repo.

### Hardcoded URLs found

| URL | Location | Purpose | Action |
|---|---|---|---|
| `https://api.whitehallpavilionmotel.com/api` | `Home.tsx:81`, `Register.tsx:12`, `Admin.tsx:3` | API base | **Must change** → Render URL |
| `https://api.whitehallpavilionmotel.com` | `backend/config.php:17` (`APP_URL`) | Builds `UPLOAD_URL`, `QR_BASE_URL`, pass footer | **Must change** |
| `https://mowefitnesswalk.netlify.app` | `backend/config.php:19` (`FRONTEND_URL`) | CORS allowlist | **Must change** if domain changes |
| `https://images.unsplash.com/...` ×7 | `Home.tsx:143–148`, `Home.tsx:164` | Gallery/hero imagery | Optional |
| `mailto:mowetwitter@gmail.com` | `Footer.tsx:62,76` | Contact link | Optional |
| `https://api.qrserver.com/v1/create-qr-code/` | `helpers/QRCode.php:12` | QR image source | Keep, or replace with a local library |
| `https://x.com/MoweTwitta` | `schema.sql:38,47` | Event settings default | n/a |

### Dependencies that matter for the migration

**Nothing in `package.json` must change for the migration to work.** The frontend talks to the backend over plain HTTP using `fetch`, `FormData`, and Bearer tokens — all standard.

Optional cleanup (do separately from the migration): remove `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `recharts`, `sonner`, and the ~50 `src/components/ui/*` files once confirmed unused. **Do not do this during the migration** — it adds risk for no functional gain.

---


## 3. CURRENT PHP BACKEND

### Complete file inventory

| File | Lines | Role |
|---|---|---|
| `config.php` | 90 | All configuration as PHP `define()` constants |
| `api/index.php` | 217 | Router, CORS, error handler, route dispatch |
| `api/.htaccess` | 4 | `mod_rewrite` → `index.php` |
| `.htaccess` (root) | 15 | Denies all `.php` except `verify.php` |
| `verify.php` | 109 | **Public HTML verification page** (server-rendered) |
| `install/index.php` | 172 | Web installer: creates DB, imports schema, writes `config.php` |
| `middleware/AuthMiddleware.php` | 19 | Bearer token → JWT decode |
| `controllers/RegistrationController.php` | 95 | `POST /register` |
| `controllers/ParticipantController.php` | 83 | List/show/update/delete/bulk-delete/regen-pass/stats |
| `controllers/AuthController.php` | 23 | `POST /admin/login` |
| `controllers/SponsorController.php` | 69 | Sponsor CRUD |
| `controllers/GalleryController.php` | 55 | Gallery CRUD |
| `controllers/ContactController.php` | 47 | Contact submit / list / update / delete |
| `controllers/EventController.php` | 40 | Event settings get / update |
| `controllers/EmailController.php` | 73 | Bulk email to participants |
| `controllers/ExportController.php` | 48 | CSV export (3 types) |
| `models/Database.php` | 22 | PDO singleton |
| `models/Participant.php` | 124 | Participant queries + `generateId()` + `stats()` |
| `models/Admin.php` | 23 | Admin lookup, `verifyPassword`, `updateLastLogin` |
| `models/Sponsor.php` | 50 | Sponsor queries |
| `models/Gallery.php` | 43 | Gallery queries |
| `models/Contact.php` | 38 | Contact queries |
| `models/Event.php` | 18 | Event settings (single row, `id = 1`) |
| `helpers/Response.php` | 36 | JSON envelope |
| `helpers/Validator.php` | 68 | Chainable validation + `sanitizeString` |
| `helpers/Upload.php` | 57 | Image upload / delete / path→URL |
| `helpers/JWT.php` | 32 | HS256 encode/decode |
| `helpers/Mailer.php` | 83 | `mail()` + confirmation template |
| `helpers/PassGenerator.php` | 147 | GD attendee pass renderer |
| `helpers/QRCode.php` | 26 | QR download from `api.qrserver.com` |
| `helpers/CSV.php` | 18 | CSV download with UTF-8 BOM |

| `uploads/.htaccess` | 6 | Blocks PHP execution in uploads |
| `README.md` | 226 | Deployment docs (⚠️ partially inaccurate — see below) |

⚠️ `backend/README.md` documents a `backend/admin/` SPA (`index.html`, `css/style.css`, `js/app.js`) and `uploads/photos|flyers|sponsors|gallery` subfolders. **Neither exists in the repository.** The `admin/` folder is absent from both the filesystem and `backend.zip`. The real admin UI is the React `/admin` route. `uploads/` contains only `.htaccess` — subfolders are created at runtime by `mkdir(..., recursive)`.
### Endpoint table

| PHP File | Endpoint | Method | Purpose | Database Tables | Replacement Node Endpoint |
|---|---|---|---|---|---|
| `api/index.php` | `/api/` | GET | Health check → `{status:'ok', api:APP_NAME}` | none | `GET /` |
| `api/index.php` | `/api/download-pass/:filename` | GET | Streams a pass JPEG as attachment | none (filesystem) | `GET /api/download-pass/:filename` |
| `RegistrationController` | `/api/register` | POST | Register participant, generate ID/QR/pass, email | `participants` | `POST /api/register` |
| `api/index.php` | `/api/verify/:id` | GET | JSON participant verification | `participants` | `GET /api/verify/:id` |
| `SponsorController` | `/api/sponsors` | GET | List **active** sponsors (public) | `sponsors` | `GET /api/sponsors` |
| `GalleryController` | `/api/gallery` | GET | List **active** gallery items (public) | `gallery` | `GET /api/gallery` |
| `EventController` | `/api/event` | GET | Get event settings | `event_settings` | `GET /api/event` |
| `ContactController` | `/api/contact` | POST | Submit contact message | `contacts` | `POST /api/contact` |
| `AuthController` | `/api/admin/login` | POST | Admin login → JWT | `admins` | Supabase Auth (§18) |
| `api/index.php` | `/api/admin/dashboard` | GET | `{stats:{total,today,verified,week_chart}, sponsor_count}` | `participants`, `sponsors` | `GET /api/admin/dashboard` |
| `ParticipantController` | `/api/admin/participants` | GET | Paginated list. Query: `page`, `search`, `status` | `participants` | `GET /api/admin/participants` |
| `ParticipantController` | `/api/admin/participants/:id` | GET | Single participant + `photo_url`/`pass_url`/`qr_url` | `participants` | `GET /api/admin/participants/:id` |
| `ParticipantController` | `/api/admin/participants/:id` | PUT | Update `full_name`/`email`/`phone`/`status` (JSON) | `participants` | `PUT /api/admin/participants/:id` |
| `ParticipantController` | `/api/admin/participants/:id` | DELETE | Delete participant + 3 files | `participants` | `DELETE /api/admin/participants/:id` |
| `ParticipantController` | `/api/admin/participants/:id/regenerate-pass` | POST | Regenerate QR + pass | `participants` | `POST /api/admin/participants/:id/regenerate-pass` |
| `ParticipantController` | `/api/admin/participants/bulk-delete` | POST | Delete by `ids` array | `participants` | `POST /api/admin/participants/bulk-delete` |
| `ParticipantController` | `/api/admin/stats` | GET | Stats only | `participants` | `GET /api/admin/stats` |
| `SponsorController` | `/api/admin/sponsors` | GET | List **all** sponsors | `sponsors` | `GET /api/admin/sponsors` |
| `SponsorController` | `/api/admin/sponsors` | POST | Create (multipart, optional `logo`) | `sponsors` | `POST /api/admin/sponsors` |
| `SponsorController` | `/api/admin/sponsors/:id` | PUT | Update (multipart) | `sponsors` | `PUT /api/admin/sponsors/:id` |
| `SponsorController` | `/api/admin/sponsors/:id` | DELETE | Delete + logo file | `sponsors` | `DELETE /api/admin/sponsors/:id` |
| `GalleryController` | `/api/admin/gallery` | GET/POST | List all / upload image (multipart `image`) | `gallery` | `GET`/`POST /api/admin/gallery` |
| `GalleryController` | `/api/admin/gallery/:id` | PUT/DELETE | Update (JSON) / delete + file | `gallery` | `PUT`/`DELETE /api/admin/gallery/:id` |
| `ContactController` | `/api/admin/contacts` | GET | List. Query: `status` | `contacts` | `GET /api/admin/contacts` |
| `ContactController` | `/api/admin/contacts/:id` | PUT | Set `reply` and/or `status` (JSON) | `contacts` | `PUT /api/admin/contacts/:id` |
| `ContactController` | `/api/admin/contacts/:id` | DELETE | Delete contact | `contacts` | `DELETE /api/admin/contacts/:id` |
| `EventController` | `/api/admin/event` | GET/PUT | Get / update (JSON or multipart `banner`) | `event_settings` | `GET`/`PUT /api/admin/event` |
| `EmailController` | `/api/admin/email/send` | POST | Bulk email. Body: `subject`, `message`, `target` (`'all'`\|`'verified'`\|id array), `attachment_path` | `participants`, `email_log` | `POST /api/admin/email/send` |
| `ExportController` | `/api/admin/export/:type` | GET | CSV. `type` ∈ `participants`\|`sponsors`\|`contacts` | all three | `GET /api/admin/export/:type` |
| `verify.php` | `/verify.php?id=XXX` | GET | **Public HTML page** rendered by PHP | `participants` | ⚠️ No direct equivalent — §20 |
| `install/index.php` | `/install/` | GET/POST | One-time installer | creates all | **Delete — no equivalent** |

| `database/schema.sql` | 123 | Full MySQL schema + admin seed + event seed |
| `database/admin_seed.sql` | 37 | Standalone admin upsert |

### Request/response contract

**Request parsing is inconsistent** — this matters for the rewrite:

| Endpoint | Body format |
|---|---|
| `/api/register` | `multipart/form-data` (`$_POST` + `$_FILES`) |
| `/api/contact` | JSON (`php://input`) |
| `/api/admin/login` | JSON |
| `/api/admin/participants/:id` (PUT) | JSON |
| `/api/admin/participants/bulk-delete` | JSON |
| `/api/admin/sponsors` (POST), `/:id` (PUT) | `multipart/form-data` |
| `/api/admin/gallery` (POST) | `multipart/form-data` |
| `/api/admin/gallery/:id` (PUT) | JSON |
| `/api/admin/contacts/:id` (PUT) | JSON |
| `/api/admin/event` (PUT) | JSON **or** multipart |
| `/api/admin/email/send` | JSON |

**Response envelope** (`helpers/Response.php`) — must be preserved or the frontend breaks:

```jsonc
// success  — "data" omitted when null
{ "success": true, "message": "Success", "data": <any> }
// error    — "errors" omitted when empty
{ "success": false, "message": "Validation failed.", "errors": { "field": "msg" } }
```

Status codes: 200, 201 (register/contact/sponsor/gallery create), 204 (OPTIONS), 401, 404, 409 (duplicate email), 422 (validation), 500.

JSON flags: `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES` — the frontend relies on `/` not being escaped in URLs.

### Authentication

- `POST /api/admin/login` → `AuthController::login()`
- Reads JSON `{ email, password }`; validates email format + required fields
- `Admin::findByEmail()` → `password_verify($plain, $hash)`
- On success: `UPDATE admins SET last_login = NOW()`, then issues a JWT
- **JWT payload:** `{ sub: adminId, email, role, name, iat, exp }`; header `{alg:'HS256',typ:'JWT'}`; HMAC-SHA256 via `hash_hmac`; signature compared with `hash_equals`. Expiry **86400 s (24 h)**
- **Client storage:** `localStorage['admin_token']` — not a cookie, no httpOnly protection


### Database queries

All queries are **PDO prepared statements with `ATTR_EMULATE_PREPARES => false`**. The search filter binds `:search` inside a `LIKE '%:search%'` pattern — correctly bound.

⚠️ **One injection-shaped pattern exists** — `Participant::update()`, `Sponsor::update()`, `Gallery::update()`, `Contact::update()` all build SQL like:

```php
foreach ($data as $k => $v) { $sets[] = "`$k` = :$k"; $params[":$k"] = $v; }
$sql = "UPDATE participants SET " . implode(', ', $sets) . " WHERE id = :id";
```

The **column name** `$k` is interpolated with backticks, not bound. Callers pass hardcoded whitelists, so it is **not currently exploitable** — but the model layer is unsafe by design. **In the Node rewrite, never build SQL by string concatenation.**

### Validation

`helpers/Validator.php` — chainable, no external library:
- `required(field, label)`, `email()`, `phone()` (7–15 digits after stripping non-digits), `minLength()`, `maxLength()`
- `passes()` / `errors()` / `get(field, default)` (trims, casts to string)
- `sanitizeString()` = `htmlspecialchars(strip_tags(trim($v)), ENT_QUOTES, 'UTF-8')`

⚠️ **`sanitizeString()` runs on input, not output.** It HTML-escapes *before storing*, so `O'Brien` becomes `O&#039;Brien` in the database. `verify.php` then calls `htmlspecialchars()` **again**, causing **double-escaping**. Existing data-quality bug: participant names and contact messages in the DB are already HTML-encoded.

⚠️ Only `full_name` and contact fields are sanitized. `email` is only lowercased+trimmed; `phone` is stored raw; `ParticipantController::update()` writes whatever JSON the admin sends with **no validation at all**.

### Error handling

- Global `set_exception_handler()` in `api/index.php`: logs to `LOG_DIR/errors.log` (suppressed with `@`), then `Response::serverError(DEBUG ? message : 'Internal server error.')`
- `DEBUG` is `false`, `APP_ENV` is `production` ✅ — errors do not leak
- ⚠️ **No `set_error_handler`**, so PHP warnings/notices are emitted into the response body and can corrupt JSON
- ⚠️ Final `Response::notFound('Route not found.')` catches unmatched routes
- ⚠️ PDO exceptions bubble up and are logged with full messages that may contain DSN/table names

### File uploads

`helpers/Upload.php::handleImage()`:
1. Rejects if `tmp_name` missing or `error !== UPLOAD_ERR_OK`

2. Rejects if size > `MAX_UPLOAD_SIZE` (5 MB)
3. MIME via `finfo_open(FILEINFO_MIME_TYPE)` → fallback `mime_content_type` → fallback **extension→MIME map**
4. Rejects unless MIME ∈ `{image/jpeg, image/jpg, image/png, image/webp}`
5. Filename `uniqid('img_', true) . '.' . $ext` — ⚠️ extension comes from the user-supplied original filename; MIME check is the only real gate
6. `mkdir($destination, 0755, recursive)` if missing, then `move_uploaded_file()`
7. Returns `{success, path, filename}`

**Storage dirs:** `uploads/photos` (participant photos), `uploads/flyers` (QR PNGs + pass JPEGs), `uploads/sponsors` (logos), `uploads/gallery` (event images), `uploads/banners` (event banner, created by `EventController`).

**URL generation:** `Upload::pathToUrl($path)` = `UPLOAD_URL . str_replace(UPLOAD_BASE, '', $path)` → `https://<APP_URL>/uploads/photos/img_....jpg`.

**Protection:** `uploads/.htaccess` denies `.php` execution and `AddType text/plain .php .php3 .php4 .php5 .phtml`. **This depends on Apache + `.htaccess` support — meaningless on Render.** See §19.

⚠️ **`POST /api/admin/email/send` accepts an `attachment_path`** from the request body and, if `file_exists()`, attaches it to outbound email. Constrained to existing server files, but it is a **local-file-read/attachment primitive**. Not called by the frontend. Do not port as-is.
### Email sending

`helpers/Mailer.php`:
- `send()` builds MIME headers by hand and calls **PHP's built-in `mail()`**, error-suppressed with `@`
- Supports a `multipart/mixed` attachment branch (base64 chunked) — used to attach the pass JPEG
- `sendRegistrationConfirmation()` — subject `🎉 Registration Confirmed — {EVENT_NAME}`, HTML template with name, participant ID, registration date, and a "Verify My Pass" button linking to `QR_BASE_URL . id`
- ⚠️ **The `SMTP_*` constants in `config.php` are never referenced by `Mailer.php`.** The README's claim that you can "use cPanel's SMTP in `config.php`" is **inaccurate** — that would need PHPMailer, which is not present. On cPanel `mail()` works via local sendmail; **on Render it will silently fail** (`@` suppresses errors and the return value is ignored by the caller)

### Payment verification

**None exists.** No payment code, table, endpoint, or constant anywhere in the backend.

### QR generation

`helpers/QRCode.php::generate($participantId, $savePath)`:
- Builds `QR_BASE_URL . urlencode($id)` where `QR_BASE_URL = APP_URL . '/verify.php?id='`
- Downloads a PNG from `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<url>&color=22C55E&bgcolor=0B0B0B&format=png&margin=10`
- 15-second timeout, User-Agent `MIXC-FitnessWalk/1.0`
- ⚠️ **Silently returns `false` on failure** (`@file_get_contents`). `RegistrationController` continues with `qr_path = null` and generates a pass with no QR — registration still "succeeds"
- ⚠️ **Third-party dependency:** the server needs outbound HTTPS to `api.qrserver.com`. If it is down or rate-limits, QR generation fails for all registrations
- ⚠️ **The encoded payload is a full URL to the old PHP domain.** This is the single biggest data-migration trap — see §9 and §21

### Attendee pass generation

`helpers/PassGenerator.php` (147 lines, pure GD):
- 900×500 truecolor canvas, bg `#0B0B0B`, card `#141414`, accent `#22C55E`
- Tries three **Linux** font paths (DejaVu/Liberation Sans Bold); ⚠️ `imagestring()` is the fallback
- Draws: accent bar, card, top strip, event title, "OFFICIAL PARTICIPANT" badge, 160×180 participant photo (resampled), name / PARTICIPANT ID / EMAIL / PHONE / REGISTERED, a 160×160 QR on a white backing square, "SCAN TO VERIFY", footer `EVENT_NAME · APP_URL`, and the community logo from `COMMUNITY_LOGO`
- ⚠️ **`backend/assets/logo.png` does not exist** (`assets/` is an empty dir in `backend.zip`), so the logo block is silently skipped and the pass has no logo
- Output: `uploads/flyers/pass_{participant_id}_{unix_time}.jpg`, JPEG quality 92
- Returns `{success, path, url}` where `url = APP_URL . '/api/download-pass/' . basename(path)`

⚠️ **Filename contains a Unix timestamp**, so every regeneration creates a new file; old passes are **never deleted** (only on participant delete). `uploads/flyers/` will accumulate orphaned JPEGs.

### Web installer

`install/index.php`:
- `session_start()`; lock file `install/install.lock` prevents re-running
- System checks: PHP ≥ 8.0, PDO, PDO MySQL, **GD**, JSON, mbstring, `uploads/` writable, `logs/` writable
- **Creates the database** (`CREATE DATABASE IF NOT EXISTS`) — requires a MySQL user with CREATE privileges
- Imports `schema.sql` via naive `explode(';')` — ⚠️ would break on any semicolon inside a string literal
- Upserts admin with `password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12])`
- **Rewrites `config.php` in place** with `preg_replace` to inject DB creds, `APP_URL`, and a fresh random `JWT_SECRET` (`bin2hex(random_bytes(32))`)
- ⚠️ `logs/` and `assets/` do not exist in the repo, so the "logs directory writable" check will **fail** and disable the install button unless manually created
- ⚠️ `backend/.htaccess` denies all `.php` except `verify.php`, so `/install/index.php` would be **403**. **Cannot confirm production behaviour** — see §23
- ⚠️ README says to delete `install/` after install. **Unknown whether it still exists in production** — see §23

### Cron / background tasks

**None exist.** No cron config, no queue, no scheduler, no CLI entry point, no background worker. The only scheduled-ish logic is `stats()` computing a 7-day window inline via `DATE_SUB(NOW(), INTERVAL 7 DAY)`.

### CORS

Handled at the top of `api/index.php`:

```php
$allowed = [FRONTEND_URL, APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];
if ($origin && in_array($origin, $allowed, true)) → ACAO: $origin
elseif (FRONTEND_URL is empty or the placeholder) → ACAO: *
```

- Headers: `Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Allow-Headers: Content-Type, Authorization, X-Requested-With`, `Allow-Credentials: true`
- `OPTIONS` → 204 + exit

## 4. DATABASE AUDIT

Source of truth: `backend/database/schema.sql`. All 7 tables are `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`. **`admin_seed.sql` is a duplicate of just the `admins` table + seed.**

### `admins`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** | |
| `name` | `VARCHAR(100)` | NO | — | | |
| `email` | `VARCHAR(150)` | NO | — | **UNIQUE** | Login identifier |
| `password` | `VARCHAR(255)` | NO | — | | **bcrypt hash** |
| `role` | `ENUM('super','admin')` | NO | `'admin'` | | **Never enforced** |
| `last_login` | `DATETIME` | YES | `NULL` | | |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | | |

Foreign keys: **none**. Used by: `AuthController`, `Admin` model, `POST /admin/login`. Seeded with 1 row (`admin@mxcommunity.com`, role `super`).

⚠️ **The seed in `schema.sql` L21–23 and `admin_seed.sql` L23–33 is `ON DUPLICATE KEY UPDATE name, password, role`** — re-running either file **resets the admin password to the known default**. This is a live-credential hazard: anyone who can run that SQL resets the admin account.

### `event_settings`

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** |
| `event_name` | `VARCHAR(200)` | NO | `'Mowe-Ibafo X Community Fitness Walk 2026'` | |
| `description` | `TEXT` | YES | `NULL` | |
| `event_date` | `DATE` | YES | `NULL` | |
| `event_time` | `TIME` | YES | `NULL` | |
| `venue` | `VARCHAR(300)` | YES | `NULL` | |
| `registration_open` | `TINYINT(1)` | NO | `1` | |
| `banner_path` | `VARCHAR(500)` | YES | `NULL` | |
| `contact_email` | `VARCHAR(150)` | YES | `NULL` | |
| `contact_phone` | `VARCHAR(30)` | YES | `NULL` | |
| `whatsapp_number` | `VARCHAR(30)` | YES | `'2347061038567'` | |
| `twitter_url` | `VARCHAR(300)` | YES | `'https://x.com/MoweTwitta'` | |
| `instagram_url` | `VARCHAR(300)` | YES | `NULL` | |
| `facebook_url` | `VARCHAR(300)` | YES | `NULL` | |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | |

⚠️ **No `created_at`.** No indexes. Effectively a singleton table — `Event::get()` does `SELECT * FROM event_settings LIMIT 1` and `Event::update()` hardcodes `WHERE id = 1`. Seeded with 1 row. Used by: `GET /api/event`, `GET/PUT /api/admin/event`, `ExportController` (required but unused).

⚠️ **`registration_open` exists but is never enforced.** No code checks it before allowing registration.

### `participants`

| Column | Type | Null | Default | Key | Notes |
|---|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** | Surrogate key |
| `participant_id` | `VARCHAR(30)` | NO | — | **UNIQUE** | `MIWC2026-000001` |
| `full_name` | `VARCHAR(150)` | NO | — | | ⚠️ HTML-escaped on write |
| `email` | `VARCHAR(150)` | NO | — | | ⚠️ **not unique at DB level** |
| `phone` | `VARCHAR(30)` | NO | — | | Raw, unnormalized |
| `photo_path` | `VARCHAR(500)` | NO | — | | ⚠️ stores **absolute server path** |
| `flyer_path` | `VARCHAR(500)` | YES | `NULL` | | ⚠️ absolute server path |
| `qr_path` | `VARCHAR(500)` | YES | `NULL` | | ⚠️ absolute server path |
| `status` | `ENUM('registered','verified','cancelled')` | NO | `'registered'` | | |
| `ip_address` | `VARCHAR(45)` | YES | `NULL` | | From `$_SERVER['REMOTE_ADDR']` |
| `registered_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | | ⚠️ **overridden by PHP** |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | | |

Indexes: `idx_email(email)`, `idx_phone(phone)`, `idx_status(status)`, `idx_date(registered_at)`.
Foreign keys: **none**. This is the central table.

⚠️ **The three `*_path` columns store absolute filesystem paths** like `/home/user/public_html/api/uploads/photos/img_65f...jpg`. `Upload::pathToUrl()` strips the `UPLOAD_BASE` prefix at read time. **This means the stored data is server-specific and must be transformed to storage keys during migration** — the column names are misleading (`photo_path` does not hold a path you can use directly).


### `sponsors`

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** |
| `business_name` | `VARCHAR(200)` | NO | — | |
| `logo_path` | `VARCHAR(500)` | YES | `NULL` | ⚠️ absolute server path |
| `website_url` | `VARCHAR(500)` | YES | `NULL` | |
| `whatsapp` | `VARCHAR(30)` | YES | `NULL` | |
| `description` | `TEXT` | YES | `NULL` | |
| `priority` | `INT UNSIGNED` | NO | `0` | |
| `status` | `ENUM('active','inactive')` | NO | `'active'` | |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | |

Indexes: `idx_status(status)`, `idx_priority(priority)`. Foreign keys: none.
Used by: `Home.tsx` (public active list), `Admin.tsx` (admin list + create), `ExportController`.
⚠️ `description` is never sent or rendered by the frontend.

### `gallery`

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** |
| `image_path` | `VARCHAR(500)` | NO | — | ⚠️ absolute server path |
| `caption` | `VARCHAR(300)` | YES | `NULL` | |
| `category` | `VARCHAR(100)` | YES | `'general'` | |
| `sort_order` | `INT UNSIGNED` | NO | `0` | |
| `status` | `ENUM('active','inactive')` | NO | `'active'` | |
| `uploaded_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | |

Indexes: `idx_status(status)`, `idx_sort_order(sort_order)`. Foreign keys: none.
Used by: `GET /api/gallery` and `GET/POST/PUT/DELETE /api/admin/gallery`.
⚠️ **The `gallery` table is effectively dead.** `Home.tsx` L135–149 hardcodes a 13-image array from `public/` and Unsplash. **No frontend code calls `/api/gallery`.**

### `contacts`

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** |
| `name` | `VARCHAR(150)` | NO | — | ⚠️ HTML-escaped on write |
| `email` | `VARCHAR(150)` | NO | — | |
| `phone` | `VARCHAR(30)` | YES | `NULL` | |
| `subject` | `VARCHAR(300)` | NO | — | |
| `message` | `TEXT` | NO | — | ⚠️ HTML-escaped on write |
| `reply` | `TEXT` | YES | `NULL` | |
| `status` | `ENUM('new','read','replied','resolved')` | NO | `'new'` | |
| `ip_address` | `VARCHAR(45)` | YES | `NULL` | |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | |

Indexes: `idx_status(status)`, `idx_email(email)`. Foreign keys: none.
Used by: `POST /api/contact` only. **No frontend code calls it** — the footer's contact is a `mailto:` link.

### `email_log`

| Column | Type | Null | Default | Key |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AUTO_INCREMENT` | NO | — | **PK** |
| `recipient` | `VARCHAR(150)` | NO | — | |
| `subject` | `VARCHAR(300)` | NO | — | |
| `status` | `ENUM('sent','failed')` | NO | `'sent'` | |
| `sent_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | |

Index: `idx_status(status)`. Foreign keys: none.
Used by: `EmailController::send()` only.
⚠️ **Registration confirmation emails are NOT logged here** — only bulk admin sends are. No read endpoint or UI exists.

### Relationship map (ER)

**There are ZERO foreign keys in the schema. All relationships are implicit, unenforced, and — with one exception — do not exist at all.**

```
admins  ──────────────────────────────┐
   (standalone; no references)         │ role/email copied into JWT claims
                                       │
event_settings ───────────────────────┐│   (standalone singleton row)
   (standalone; no references)         │
                                       │
participants ──────┐                   │
   │                │                   │
   │ photo_path ────┼──▶ (filesystem)  │
   │ flyer_path ────┼──▶ (filesystem)  │
   │ qr_path ───────┼──▶ (filesystem)  │
   │ ip_address     │                   │
   │                │                   │
   │  ⚠️ NO FK to any table            │
   │  ⚠️ NO user/account link          │
   │  ⚠️ NO email link                 │
   │                                   │
   └── (implicit, unenforced) ─────────┘
        referenced by:
          • EmailController   (all | verified | id[])  — by email/status
          • ExportController  (all rows)
          • Event settings    (none)

sponsors  ── logo_path ──▶ (filesystem)     ⚠️ no FK to anything
gallery   ── image_path ──▶ (filesystem)    ⚠️ no FK to anything
contacts  ───────────────────────────      ⚠️ no FK to anything
email_log ── recipient (string) ──▶ participants.email   ⚠️ NOT a FK, just a copied string
```

**Confirmed relationships (all by convention only, none enforced):**

| From | To | Via | Enforced? |
|---|---|---|---|
| `email_log.recipient` | `participants.email` | Copied string value | ❌ No FK; target column is not unique |
| `email_log.subject` | bulk-email subject | Copied string | ❌ |

---

| `Event::update()` | `event_settings.id = 1` | Hardcoded literal | ❌ |
| `participant.photo_path` etc. | filesystem files | Absolute path string | ❌ No integrity check; files can be missing |

**Explicitly NOT relationships** (do not invent these in the new schema unless the product owner explicitly asks):
- There is **no** `users` table and **no** `user_id` on `participants`.
- There is **no** payments → registrations → users chain. **None of those tables exist.**
- There is **no** `registrations` table, no `tickets` table, no `check_ins` table.
- `event_settings` is **not** referenced by `participants` — there is no `event_id` column, and nothing prevents multiple events' participants coexisting in one table.

### Summary of schema-level gaps to fix in PostgreSQL

| Gap | Fix in Supabase |
|---|---|
| `participants.email` not UNIQUE | Add a **unique index**. ⚠️ Dedupe existing duplicates first (§14). |
| `generateId()` race + ID reuse | Use a Postgres `SEQUENCE` or `BIGSERIAL`; keep the `MIWC2026-%06s` display format for continuity. |
| `*_path` absolute filesystem paths | Change semantics to `*_storage_key` holding a Supabase Storage object path. |
| No FKs | Add only where genuinely needed — the honest answer is "almost none" (§18). |
| `registration_open` unused | Enforce it in the new backend or drop the column. Decide explicitly. |
| `event_settings` singleton with no guard | Keep `id = 1` with a CHECK, or make it a proper single-row config. |
| `email_log` has no read path | Keep for parity, or wire up a UI. |
| HTML-escaped data in `full_name` / `message` | **Decode entities during migration** (e.g. `html.unescape` in the export script) — §14. |


⚠️ **`registered_at` is set by PHP** (`date('Y-m-d H:i:s')` in `RegistrationController` L68) and passed into `create()`, but `Participant::create()` **does not include `registered_at` in the INSERT column list** — so the column default `CURRENT_TIMESTAMP` actually wins. The PHP-computed value in `$participant` is used only for the response and the email. Consequence: the DB stores the **MySQL server's** timezone, not `Africa/Lagos`, and can drift from the value returned to the client.

⚠️ **Duplicate email is prevented only in application code** (`PREVENT_DUPLICATE_EMAIL` in `config.php` + a `SELECT` in the controller), **not by a UNIQUE constraint**. Under concurrency two simultaneous registrations can both succeed. The `idx_email` index is a plain non-unique index. This matters for migration — you may find duplicate emails in the live data.

⚠️ **`generateId()` is not concurrency-safe.** It does `SELECT MAX(id) FROM participants` then `+1`, producing `MIWC2026-` + zero-padded number. Two concurrent registrations can compute the same ID; the `UNIQUE` constraint would then throw a PDOException (500). It also **reuses IDs after deletion** — delete the highest row and the next registration reuses that number.

## 5. USER REGISTRATION FLOW

Traced end-to-end through `RegistrationController::register()` (L12–94) and `Register.tsx` (L67–107).

```
Visitor
  → GET /  (Home.tsx, static, loads sponsors)
  → click "Register Now" → wouter Link → /register
  → fills form: name, email, phone, photo (drag-drop or browse)
  → client-side validation (Register.tsx L69–78)
  → POST /api/register  (multipart/form-data)
      ├─ 1. Server validation        (Validator, L14–24)
      ├─ 2. Photo required check     (L26–28)
      ├─ 3. Duplicate email check    (L33–37, PREVENT_DUPLICATE_EMAIL=true)
      ├─ 4. Duplicate phone check    (L38–42, PREVENT_DUPLICATE_PHONE=false → SKIPPED)
      ├─ 5. Upload photo             (Upload::handleImage → uploads/photos/)
      ├─ 6. Generate participant ID  (SELECT MAX(id)+1 → "MIWC2026-000042")
      ├─ 7. Generate QR PNG          (HTTP → api.qrserver.com → uploads/flyers/qr_<id>.png)
      ├─ 8. Generate pass JPEG       (GD → uploads/flyers/pass_<id>_<ts>.jpg)
      ├─ 9. INSERT participants row   (Model::create)
      ├─ 10. Send confirmation email (@Mailer, errors suppressed)
      └─ 11. Respond 201 {participant_id, full_name, registered_at, pass_url, qr_url, verify_url}
  → success screen: participant ID, "Download Attendee Pass", "View Verification Page"
```

### Stage-by-stage detail

**Stage 0 — Landing → form.** `Navbar.tsx` links to `/register`. No data dependency.

**Stage 1 — Client-side validation** (`Register.tsx` L69–78)
- `!formData.name.trim()` → "Full name is required"
- email must match `/^\S+@\S+\.\S+$/`
- `phone.replace(/\D/g,'').length < 7` → error
- `!photo` → "Passport photograph is required"
- If any error, `return` — no request is made.
- ⚠️ No file size/type validation client-side.

**Stage 2 — Request.** `FormData` with exactly four fields: `full_name`, `email`, `phone`, `photo`. The frontend lowercases and trims email before sending (L86). No `Content-Type` header is set (correct — the browser sets the multipart boundary).

**Stage 3 — Server validation** (`RegistrationController` L14–24)
```
required('full_name', 'Full Name')  → minLength 2, maxLength 150
required('email', 'Email')          → email()

required('phone', 'Phone Number')   → phone()  [7–15 digits after stripping non-digits]
```
On failure: `Response::error('Validation failed.', 422, $v->errors())`. The `errors` object is keyed by **field name** (`full_name`, `email`, `phone`) — ⚠️ **but the frontend's error state uses keys `name`, `email`, `phone`, `photo`** (`Register.tsx` L17). A server-side `full_name` error is written to `errors.full_name`, which the form never reads → **the user sees only the generic fallback** ("Registration failed. Please try again."). Existing UX bug; **fix during migration** by aligning key names.
**Stage 4 — Photo required** (L26–28). Missing/failed upload → 422 with `{ photo: 'Please upload your passport photograph.' }`. This key *does* match the frontend.

**Stage 5 — Duplicate checks** (L33–42)
- `PREVENT_DUPLICATE_EMAIL = true` → `findByEmail()`; hit → **409** "This email address is already registered."
- `PREVENT_DUPLICATE_PHONE = false` → the phone check is **configured off and never runs**.
- ⚠️ Both are `SELECT`-then-`INSERT` — race-prone, and the DB has no unique constraint (§4).

**Stage 6 — Photo upload** (L45). `Upload::handleImage($_FILES['photo'], UPLOAD_PHOTOS)`. Rejects >5 MB or non-JPEG/PNG/WebP. Filename `img_<uniqid>.<ext>`. Failure → 422 with `{photo: <error>}`.

**Stage 7 — Participant ID** (`Participant::generateId()` L12–17)
```php
SELECT MAX(id) as max_id FROM participants;   // next = max_id + 1
return 'MIWC2026-' . str_pad($next, 6, '0', STR_PAD_LEFT);
```
Prefix `MIWC2026` comes from `PARTICIPANT_PREFIX` (`config.php` L25). ⚠️ Race-prone and reuses IDs after deletion (§4).

**Stage 8 — QR code** (L54–56)
- Filename `qr_<participant_id>.png` → `uploads/flyers/`
- Downloaded from `api.qrserver.com` encoding `https://api.whitehallpavilionmotel.com/verify.php?id=<urlencoded id>`, 300×300, green-on-black
- ⚠️ On failure returns `false` → `qr_path = null`, **registration still succeeds**, pass has no QR

**Stage 9 — Pass generation** (L72–75)
`PassGenerator::generate($participant, $qrPath)` — the composite 900×500 JPEG described in §3. ⚠️ `COMMUNITY_LOGO` points at a non-existent `backend/assets/logo.png`, so the pass is logo-less. If generation fails, `flyer_path` stays `null` and `pass_url` is `null` — **but the participant row is still created and registration still returns 201.**

**Stage 10 — Database insert** (L77 → `Participant::create()` L19–34)
```sql
INSERT INTO participants (participant_id, full_name, email, phone, photo_path, flyer_path, qr_path, ip_address)
VALUES (:pid, :name, :email, :phone, :photo, :flyer, :qr, :ip)
```
- `full_name` → `Validator::sanitizeString()` (⚠️ HTML-escaped before storage)
- `email` → `strtolower(trim(...))`
- `phone` → raw
- `ip_address` → `$_SERVER['REMOTE_ADDR']`
- `registered_at` → **not in the column list**, so the DB default `CURRENT_TIMESTAMP` applies (§4)

**Stage 11 — Confirmation email** (L80–82)
`@Mailer::sendRegistrationConfirmation($participant, $passResult['path'])` — ⚠️ only sent **if the pass generated successfully**. Fire-and-forget: `@` suppresses errors and the boolean return is **ignored**. No retry, no queue, no `email_log` entry. **A failed confirmation email is completely invisible.**

---

**Stage 12 — Response** (L84–93), HTTP 201:
```json
{ "success": true,
  "message": "Registration successful! Your attendee pass is ready.",
  "data": { "participant_id": "MIWC2026-000042",
            "full_name": "…", "registered_at": "2026-09-25 14:03:11",
            "pass_url": "https://api.…/api/download-pass/pass_….jpg",
            "qr_url":   "https://api.…/uploads/flyers/qr_….png",
            "verify_url":"https://api.…/verify.php?id=MIWC2026-000042" } }
```

**Stage 13 — Success screen** (`Register.tsx` L100–101, L324–386). Stores `json.data` into `registrationResult`; renders the ID, a download button, and a link to `verify_url`.

### There is no payment, no approval, and no email verification

Stated explicitly, because these are commonly assumed:
- ❌ **No payment step.** The participant is registered and the pass is issued immediately and unconditionally.
- ❌ **No email verification.** `participants` has no `email_verified` column. The confirmation email's "Verify My Pass" button links to the **public** `verify.php` lookup page, which only *displays* information — it does not verify an email address.
- ❌ **No admin approval queue.** `status` defaults to `'registered'`; only an admin can change it.
- ❌ **No account creation.** The participant cannot log in, view their pass later, or edit their details.
- ❌ **No check-in event.** `status = 'verified'` is set only via `PUT /api/admin/participants/:id` — **and the current React admin UI has no control that calls that endpoint** (see §8).
---

## 6. AUTHENTICATION AND SECURITY


### 6.1 The critical framing: there is only one account type

**The entire system has exactly one authenticating identity class: `admins`.**

| Question | Answer | Evidence |
|---|---|---|
| Is there a `users` table? | **No** | `schema.sql` defines 7 tables; none is `users` |
| Do participants have passwords? | **No** | `participants` has no password column |
| Can a participant log in? | **No** | `AuthController` only queries `admins`; no participant login route |
| How many admin accounts exist? | **1 seeded** | `schema.sql` L21–23, `admin_seed.sql` L23–33 |
| How many rows are in the live `admins` table? | ⚠️ **Unknown** — must be checked in phpMyAdmin (§23) |

> **Implication for §15:** "migrating existing users" means migrating **admin staff accounts only** — realistically one. Participants are anonymous records, not accounts. They are migrated as *rows*, not as *users*.

### 6.2 How admins log in

1. Admin navigates to `/admin` (the link is public — `Navbar.tsx` L40 renders it for everyone).
2. `Admin.tsx` L121–127 POSTs `{ email, password }` as JSON to `/api/admin/login`.
3. `AuthController::login()`:
   - Validates `required('email')`, `email('email')`, `required('password')` → 422 on failure
   - `Admin::findByEmail($email)` → `SELECT * FROM admins WHERE email = :email` (prepared)
   - `password_verify($plain, $admin['password'])`
   - On mismatch → `Response::error('Invalid email or password.', 401)`
   - On success → `UPDATE admins SET last_login = NOW()` and issue a JWT
4. Response: `{ success: true, message: 'Success', data: { token, admin: { id, name, email, role } } }`
5. `Admin.tsx` L137 writes the token to `localStorage['admin_token']` and reloads the dashboard.

⚠️ **No sessions, no cookies, no refresh tokens, no server-side session store.** Stateless Bearer JWT only.

### 6.3 🔴 PASSWORD STORAGE — detailed analysis (your specific question)

**Algorithm: bcrypt via PHP's `password_hash()` / `password_verify()`.**

| Aspect | Value | Source |
|---|---|---|
| Hashing function | `password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12])` | `install/index.php` L61 |
| Verification | `password_verify($plain, $hash)` | `Admin::verifyPassword()` L19–21 |
| Hash format | `$2y$12$<22-char salt><31-char hash>` = **60 chars** | `schema.sql` L22 (60 chars confirmed) |
| Cost factor | **12** (2¹² = 4096 iterations) | Confirmed by the `$2y$12$` prefix |
| Per-password salt | **Yes** — embedded in the hash string | bcrypt design |
| Storage column | `VARCHAR(255)` | `schema.sql` L13 |
| Rehashing on login? | ❌ **No** `password_needs_rehash()` anywhere | — |
| Password complexity rule? | Only `strlen >= 8` in the installer (`install/index.php` L44). No composition rules. | |
| Password reuse protection? | ❌ None | |
| Breached-password check? | ❌ None | |


**Assessment:** ✅ bcrypt is a correct, modern, adaptive choice; cost 12 is genuinely strong; salts are per-password; the 255-char column is correct; no plaintext or fast hash exists anywhere. ⚠️ But the credential is published in three places in version control, and `ON DUPLICATE KEY UPDATE ... password = VALUES(password)` means re-running the seed SQL silently resets it to that known value.
### 6.4 🔴 Can existing users migrate to Supabase Auth without resetting passwords?

**Short answer: technically yes, but for this project it is almost certainly not worth doing — because there is at most one admin account, and its password is already publicly known from the source code.**

| Question | Answer |
|---|---|
| 1. Can user info be migrated directly? | **Yes.** `admins.name`, `.email`, `.role`, `.created_at` map cleanly to `auth.users.raw_user_meta_data` / `app_metadata` plus a profile table. |
| 2. Does anything need transformation? | **`role`** must move to `raw_app_meta_data.role` (so it is not user-editable). `last_login` should live in a profile table — Supabase tracks `last_sign_in_at` itself. |
| 3. Can existing password hashes be reused? | **Theoretically yes** — see below. |
| 4. Can Supabase Auth *accept* bcrypt hashes? | **Not via any supported import tool.** |
| 5. Will a password reset be required? | **In practice, yes — and it costs nothing here.** |
| 6. Duplicate emails? | `admins.email` is UNIQUE in MySQL, so duplicates are impossible within `admins`. |
| 7. Keep registrations connected to users? | ⚠️ **Moot — there is no `user_id` on `participants`.** Rows link to admins by nothing. |

**The four real options, with honest trade-offs:**

**Option A — Recreate the admin with a fresh password (⭐ RECOMMENDED)**
- Create the admin in Supabase Auth (email + password) or via the Admin API, then create a matching profile row carrying `role`.
- **Why:** the only seeded credential is `Admin@2026`, published in the repository, the SQL comments, the README, and the React login form. **That password must be considered compromised and rotated regardless of the migration.** Reusing its hash would carry a known-bad credential into the new system.
- Cost: one password reset for one person. Zero data loss.

**Option B — Insert the bcrypt hash directly into `auth.users`**
- GoTrue's `auth.users.encrypted_password` **is** a bcrypt hash, and inserting `$2y$12$…` there does work in practice — a widely used, **unofficial** migration technique.
- ⚠️ **Not supported, not documented by Supabase, and version-fragile.** Requires direct SQL access to the `auth` schema and correct population of ~15 internal columns (`instance_id`, `aud`, `role`, `email_confirmed_at`, `raw_app_meta_data`, `raw_user_meta_data`, `confirmation_token`, `recovery_token`, `email_change_token_*`, `is_super_admin`, …). Hand-crafting the identity row risks a subtly broken account that fails only on specific login paths.
- **GoTrue does not distinguish `$2y$` (PHP) from `$2a$`/`$2b$` (Go)** — `golang.org/x/crypto/bcrypt` parses all three, so the format itself is compatible.
- ⚠️ The `2y` variant also requires the password to be ≤72 bytes — irrelevant here, but a general gotcha.
- Only worth considering for hundreds of accounts with genuinely unknown passwords. **For one account it is not worth the operational risk.**

**Option C — Keep the `admins` table and custom JWT in Node**
- Port `admins`, keep bcrypt, keep `jsonwebtoken`, skip Supabase Auth entirely.
- ⚠️ You then lose session management, refresh tokens, email magic-links, and password reset. Given the stated goal is to move to Supabase, this defeats the purpose. Listed for completeness only.

**Option D — Password reset flow for all admins**
- Supabase `resetPasswordForEmail` + an update-password screen. Overkill for one known-compromised credential.

**Recommendation: Option A.** Recreate admins in Supabase Auth with new, strong, unique passwords. Delete `backend/database/admin_seed.sql` and the seed block in `schema.sql` from the new codebase, and remove the pre-filled credentials from `Admin.tsx` L35–36.

⚠️ **Do not drop the MySQL `admins` table during migration.** Keep it read-only until the new auth is verified.

### 6.5 Admin authentication & authorization in detail

| Control | Status |
|---|---|
| Password hashing | ✅ bcrypt cost 12 |
| JWT signature verification | ✅ `hash_equals` (timing-safe) |
| JWT expiry | ✅ 86400 s, checked on decode |
| JWT algorithm confusion | ✅ `decode()` **ignores the header's `alg`** and always recomputes HS256 — `alg: none` / RS256 confusion fails. Acceptable. |
| Token transport | ⚠️ `localStorage` — readable by any XSS |
| Token revocation | ❌ None |
| **Role enforcement** | ❌ **None.** `role` is decoded and discarded |
| Password change | ❌ No endpoint |
| Password reset | ❌ No endpoint |
| Account lockout | ❌ None |
| Login rate limiting | ❌ **None — §6.9** |
| Audit log | ❌ Only `last_login` is recorded |
| 2FA | ❌ None |

**The seed hash in `schema.sql` L22 / `admin_seed.sql` L27 is for the plaintext password `Admin@2026`**, documented in the SQL comments, in `backend/README.md`, **and pre-filled into the React login form** (`Admin.tsx` L36). This is a live-credential exposure, not a hypothetical one.


**Sessions**

**No sessions in the API.** `session_start()` appears only in `install/index.php` and is vestigial (the installer never reads `$_SESSION`). Authentication is entirely stateless JWT.

**Authorization**

- `AuthMiddleware::handle()` runs for every route where `$segments[0] === 'admin'` **except** `POST /admin/login`
- Requires an `Authorization: Bearer <token>` header, decodes the JWT, returns the payload
- ⚠️ **The decoded payload is never used for authorization.** `$adminPayload` is assigned at `api/index.php` L123 and never read again
- ⚠️ **No role check anywhere.** `admins.role` (`'super'`/`'admin'`) is stored in the JWT but never enforced — any valid admin token can call every admin endpoint including delete and bulk-delete
- ⚠️ **No admin CRUD routes exist**, so an admin password cannot be changed through the API. No password-reset endpoint
- ⚠️ **No token revocation.** No `jti`, no denylist, no server-side logout. A stolen token is valid for 24 h; logout only clears `localStorage`
### 6.6 CSRF protection

**Not applicable to the API as designed, but a real residual risk remains.**

- All state-changing endpoints use `POST`/`PUT`/`DELETE` with `Authorization: Bearer <token>` in a **header**, not a cookie. A cross-site form POST cannot set a custom `Authorization` header, so classic CSRF does not apply to those.
- ⚠️ **`POST /api/register` and `POST /api/contact` are unauthenticated and carry no CSRF token.** A malicious page can submit a registration on a visitor's behalf. Impact is low (spam), but it is unmitigated.
- ⚠️ **The JWT in `localStorage` makes XSS the real threat**, not CSRF. Any XSS in the React app yields the admin token.

### 6.7 SQL injection protection

| Area | Status |
|---|---|
| `Database.php` | ✅ `ATTR_EMULATE_PREPARES => false` — real server-side prepared statements |
| All `findBy*`, `create`, `delete`, `paginate` | ✅ Fully parameterized |
| `paginate()` search | ✅ `:search` bound inside `LIKE '%:search%'` |
| `stats()` | ✅ Static SQL, no user input |
| `update()` in 4 models | ⚠️ Column names interpolated via backticks — **safe only because callers pass hardcoded whitelists**. Not injectable today, unsafe by design. |
| `Event::update()` | ⚠️ Same pattern |
| `getallheaders()` usage | ✅ Header value is only compared/prefix-checked, never placed in SQL |

**Verdict: no exploitable SQL injection today.** The `update()` pattern must not be reproduced in Node.

### 6.8 XSS protection

| Location | Status |
|---|---|
| `verify.php` | ✅ All interpolations pass through `htmlspecialchars()` — **except** `$participant['status']` at L85–86, used in a CSS class and `ucfirst()` output. Constrained by the DB ENUM, but **unescaped**. |
| `Admin.tsx` | ✅ React auto-escapes; no `dangerouslySetInnerHTML` anywhere |
| `EmailController::buildEmailBody()` | ✅ `$name` and `$message` are escaped before embedding in the HTML email |
| `install/index.php` | ✅ Escaped throughout |
| **Input sanitization** | ⚠️ **Anti-pattern:** `sanitizeString()` escapes on *input*, storing HTML entities in the database. This corrupts data and causes double-escaping. Correct practice is to escape on *output*. **Must be fixed in the migration** — stop writing escaped values, decode existing ones (§14). |

⚠️ **No Content-Security-Policy, no `X-Frame-Options`, no `X-Content-Type-Options`, no `Strict-Transport-Security`** — in PHP, in `index.html`, or in `netlify.toml`.

### 6.9 Rate limiting

**None exists anywhere.** No throttle, no IP limit, no CAPTCHA, no failed-login counter, no `Retry-After`.

Consequences:
- 🔴 **`POST /api/admin/login` can be brute-forced without limit.** The only defence is bcrypt's cost-12 slowness.
- ⚠️ **`POST /api/register` is unrestricted** — anyone can create unlimited participants, each triggering an outbound QR fetch and a GD render. Trivial resource-exhaustion vector.
- ⚠️ **`POST /api/contact` is unrestricted** — spam vector.
- ⚠️ **`POST /api/admin/email/send` is unrestricted and synchronous** — one request loops over *every* participant and sends email inline. On a free Render instance this times out; on a paid one it exhausts the SMTP quota.
- ⚠️ **File uploads are unlimited in count** — a disk-fill vector.

**`express-rate-limit` (or `@upstash/ratelimit` for multi-instance) is a required addition, not optional.** See §16.

### 6.10 File upload security

| Control | Status |
|---|---|
| Size limit | ✅ 5 MB (`MAX_UPLOAD_SIZE`) |
| MIME validation | ✅ `finfo` (content-based, not extension-based) |
| Allowed types | ✅ JPEG/PNG/WebP only |
| Extension from user filename | ⚠️ Yes — but the MIME gate makes it non-exploitable |

| Random filename | ✅ `uniqid('img_', true)` — ⚠️ `uniqid` is time-based and **predictable**; prefer a UUID |
| Path traversal | ✅ Destination is a server constant; only the filename is user-influenced and it passes through `uniqid` |
| PHP execution in uploads | ✅ `uploads/.htaccess` — **Apache-only; will not apply on Render** |
| Directory listing | ✅ `Options -Indexes` |
| Image re-encoding | ❌ **Files are stored as-is** — never re-encoded, so polyglot/malformed images are preserved |
| EXIF stripping | ❌ Not done — **participant photos retain GPS/location metadata** |
| Virus scanning | ❌ None |

⚠️ **The `.htaccess` protection disappears on Render.** In the Node rewrite, uploads go to Supabase Storage with a MIME allowlist, which is strictly safer. If any local-disk fallback is kept, do **not** serve the uploads directory from the app root.
### 6.11 Identified security weaknesses — ranked

| # | Severity | Issue | Location |
|---|---|---|---|
| 1 | **CRITICAL** | Production DB password, JWT signing secret, and SMTP password are **hardcoded in plaintext in a file committed to version control** | `config.php` L8–11, L28, L57–61 |
| 2 | **CRITICAL** | **Known default admin credentials published three times** — SQL comments, `README.md`, and pre-filled into the React login form. Re-running either seed SQL resets the password to that value. | `schema.sql:19-23`, `admin_seed.sql:19-33`, `Admin.tsx:35-36` |
| 3 | **CRITICAL** | **No rate limiting anywhere** — admin login brute-forceable; `/register` and `/contact` open to spam | whole backend |
| 4 | **HIGH** | **No role-based authorization** — `role` is decorative; every admin has full delete rights | `api/index.php:123` |
| 5 | **HIGH** | JWT in `localStorage`, exposed to any XSS; no CSP to mitigate | `Admin.tsx:137` |
| 6 | **HIGH** | Synchronous bulk email over all participants in one request → timeout / quota exhaustion | `EmailController` |
| 7 | **MEDIUM** | Input-side HTML escaping corrupts stored data and causes double-escaping | `Validator.php:65-67` |
| 8 | **MEDIUM** | `update()` interpolates column names — unsafe by design | 4 model classes |
| 9 | **MEDIUM** | No unique constraint on `participants.email`; duplicate check race-prone | `schema.sql:54` |
| 10 | **MEDIUM** | `generateId()` is `MAX(id)+1` — ID collision and ID reuse after deletes | `Participant.php:12-17` |
| 11 | **MEDIUM** | `attachment_path` in bulk email is a client-controlled local file read | `EmailController.php:46` |
| 12 | **LOW** | Predictable `uniqid()` filenames; no re-encoding; EXIF (incl. GPS) retained | `Upload.php:37` |
| 13 | **LOW** | No security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) | all responses |
| 14 | **LOW** | No 401 interceptor; expired token strands the admin | `Admin.tsx` |
| 15 | **LOW** | Installer may still be deployed; `.htaccess` suggests it may be 403-blocked but this is unverified | `install/` |

**Immediate action regardless of migration:** rotate the database password, the JWT secret, and the SMTP password, and change the admin password. All three are in git history and must be considered compromised.


---

## 7. PAYMENT SYSTEM

### 7.1 Finding: there is no payment system

**This is a definitive negative finding, established by exhaustive inspection rather than assumption.**

| Check performed | Result |
|---|---|
| Search `src/` + `backend/` for `paystack`, `flutterwave`, `paypal`, `stripe` | **0 matches** |
| Search for `payment`, `checkout`, `invoice`, `receipt`, `amount`, `currency`, `NGN`, `₦` | **0 matches** in application code |
| Search for `webhook`, `callback` | **0 matches** |
| Inspect all 7 tables in `schema.sql` | **No payments table, no amount column, no currency column, no reference/transaction ID column** |
| Inspect all 28 routes in `api/index.php` | **No payment route** |
| Inspect all 10 controllers | **No payment controller** |
| Inspect `Register.tsx` end-to-end | Registration completes in one request; no payment step in the UI |

### 7.2 The 15 things you asked about, answered against the code

| Question | Answer |
|---|---|
| Payment provider | **None** |
| Initialization process | **None** |
| Amount | **None** — no price is defined or charged anywhere |
| Currency | **None** |
| Payment reference | **None** |
| Callback / webhook implementation | **None** |
| Verification endpoint | **None** |
| How payment status is stored | **Not applicable** — no status column exists |
| Duplicate payment handling | **Not applicable** |
| What happens after successful payment | **Not applicable** — registration is free; the pass is issued immediately on submission |
| What happens after failed payment | **Not applicable** |

### 7.3 What actually happens instead


### 7.4 What needs to change for Node.js

**Nothing — because nothing exists.** §13 therefore omits a "Phase 4 — Payment" from the critical path.

⚠️ **However, if the business later decides to charge a registration fee, that is a greenfield feature, not a migration.** It would require: a `payments` table, a provider SDK, an amount/currency decision (likely NGN given the Nigeria context), a checkout UI in `Register.tsx`, a webhook endpoint that is idempotent, and a post-payment pass-issuance trigger. None of that can be inferred from the current codebase, and this document deliberately does not invent it.

⚠️ **One deceptively payment-adjacent item does exist:** `participants.status` has an ENUM value `'verified'`, and `EmailController` can target `'verified'` participants. This is a **manual admin status flag**, not a payment state. Do not map it to a payment concept during migration.
## 8. ADMIN SYSTEM

### 8.1 What the admin can actually do (frontend-verified)

The admin UI is a single file, `src/pages/Admin.tsx` (526 lines). The table below lists **only features actually wired to a working endpoint**, then separately lists backend features with no UI.

| # | Feature | Frontend lines | Backend endpoint | Status |
|---|---|---|---|---|
| 1 | **Log in** | L115–145 | `POST /api/admin/login` | ✅ Works |
| 2 | **Log out** | L60–63 | none (clears `localStorage` only) | ✅ Works |
| 3 | **View dashboard statistics** | L65–80, L349–362 | `GET /api/admin/dashboard` | ✅ Works — shows `total`, `verified`, sponsor count. **`today` and `week_chart` are fetched but never displayed.** |
| 4 | **View participants** | L82–95, L365–399 | `GET /api/admin/participants` | ✅ Works — renders `full_name`, `email`, `phone`, `participant_id`, `status` |
| 5 | **Export participants CSV** | L201–220, L369 | `GET /api/admin/export/participants` | ✅ Works (blob download) |
| 6 | **Export sponsors CSV** | L404 | `GET /api/admin/export/sponsors` | ✅ Works |
| 7 | **List sponsors** | L97–109, L503–520 | `GET /api/admin/sponsors` | ✅ Works — logo, name, website, status |
| 8 | **Create sponsor** (with logo upload) | L147–199, L407–443 | `POST /api/admin/sponsors` | ✅ Works (multipart) |
| 9 | **Verify participant by manual ID** | L222–235, L480 | `GET /api/verify/:id` | ✅ Works |
| 10 | **QR code scanning** | L246–292, L456–471 | `GET /api/verify/:id` | ⚠️ **Broken** — sends the raw QR URL, not the extracted ID (§2, QR section) |
| 11 | **Export contacts CSV** | ⚠️ **no button** | `GET /api/admin/export/contacts` | ⚠️ Backend ready, **UI missing** |
| 12 | **Bulk email** | ⚠️ **no UI** | `POST /api/admin/email/send` | ⚠️ Backend ready, **UI missing** |

### 8.2 Backend admin features with NO frontend UI

Fully implemented in PHP and reachable via `curl`, but **no React component calls them**. Decide per feature: port, drop, or build UI.

| Feature | Endpoint | Method | Notes |
|---|---|---|---|
| Get single participant (with `photo_url`, `pass_url`, `qr_url`) | `/api/admin/participants/:id` | GET | No UI. Useful for a future detail view. |
| **Edit participant** (name, email, phone, status) | `/api/admin/participants/:id` | PUT | ⚠️ **No UI at all.** The only way to set `status='verified'`, so the "Verified" counter can never currently change. |
| **Delete participant** (+ photo, pass, QR files) | `/api/admin/participants/:id` | DELETE | ⚠️ No UI. |
| **Bulk delete** | `/api/admin/participants/bulk-delete` | POST | ⚠️ No UI. |
| **Regenerate pass + QR** | `/api/admin/participants/:id/regenerate-pass` | POST | ⚠️ No UI. This is the endpoint that would fix already-issued passes pointing at the dead domain (§9). |
| Stats only | `/api/admin/stats` | GET | Redundant with `/admin/dashboard`. |
| Update / delete sponsor | `/api/admin/sponsors/:id` | PUT / DELETE | ⚠️ No UI (create only). |
| Gallery CRUD (4 endpoints) | `/api/admin/gallery` | GET/POST/PUT/DELETE | ⚠️ No UI. The `gallery` table is unused by the frontend entirely. |
| List / update / delete contacts | `/api/admin/contacts` | GET/PUT/DELETE | ⚠️ No UI. |
| Get / update event settings (+ banner upload) | `/api/admin/event` | GET/PUT | ⚠️ No UI. `registration_open` is never enforced. |
| Public gallery list | `/api/gallery` | GET | ⚠️ No UI — `Home.tsx` hardcodes its gallery. |
| Public event info | `/api/event` | GET | ⚠️ No UI — `Home.tsx` hardcodes the event timeline. |
| Public contact submit | `/api/contact` | POST | ⚠️ No UI — `Footer.tsx` uses a `mailto:` link. |


### 8.3 Search and filter — partially implemented

The **backend** supports `?page`, `?search`, and `?status` on `GET /api/admin/participants` (`ParticipantController::index()` L13–18 → `Participant::paginate()` L77–107):
- `search` → `full_name LIKE :search OR email LIKE :search OR participant_id LIKE :search OR phone LIKE :search`
- `status` → exact match on the ENUM
- Pagination: `PAGE_SIZE = 20`, returns `{ data, total, page, per_page, last_page }`

⚠️ **The frontend never sends any of these parameters.** `Admin.tsx` L85 calls `GET /api/admin/participants` with no query string and renders only the first 20 rows. There is **no search box, no status filter, and no pagination control**. If there are more than 20 participants, **the admin cannot see the rest**.

⚠️ Note the response-shape inconsistency the frontend works around: `json.data?.data ?? json.data ?? []` (L90) — because `paginate()` wraps the array in a `data` key.

### 8.4 Check-in — does not exist

- No `check_ins` table, no `checked_in_at` column, no scan-event log.
- `status` can be `registered | verified | cancelled`, but nothing sets `'verified'` automatically and the React UI has no control that calls the `PUT` endpoint that would set it.
- The QR scanner only **reads** a participant; it records nothing.

**If day-of check-in matters to the business, it must be built from scratch** — it is a new feature, not a migration item.

### 8.5 What the admin can do today, in plain terms

1. Log in with email + password.
2. See three numbers: total registrations, verified count, sponsor count.
3. See the 20 most recent participants in a table.
4. Download a CSV of all participants, all sponsors, or all contacts (contacts has no button).
5. Add a sponsor with a logo; see the sponsor list update.
6. Look up a participant by typing their ID.
7. Try to scan a QR with the camera (currently broken).

That is the complete, verified admin capability surface.

---

## 9. FILES AND MEDIA

### 9.1 Complete file inventory

| File type | DB column | Directory | URL pattern | URL generated by |
|---|---|---|---|---|
| Participant passport photos | `participants.photo_path` | `uploads/photos/` | `{APP_URL}/uploads/photos/img_<uniqid>.<ext>` | `Upload::pathToUrl()` |
| Attendee passes (JPEG) | `participants.flyer_path` | `uploads/flyers/` | `{APP_URL}/api/download-pass/pass_<pid>_<ts>.jpg` | `PassGenerator` returns `APP_URL + '/api/download-pass/' + basename` |
| QR code images (PNG) | `participants.qr_path` | `uploads/flyers/` | `{APP_URL}/uploads/flyers/qr_<pid>.png` | `Upload::pathToUrl()` |
| Sponsor logos | `sponsors.logo_path` | `uploads/sponsors/` | `{APP_URL}/uploads/sponsors/img_<uniqid>.<ext>` | `Upload::pathToUrl()` |
| Gallery images | `gallery.image_path` | `uploads/gallery/` | `{APP_URL}/uploads/gallery/img_<uniqid>.<ext>` | `Upload::pathToUrl()` |
| Event banner | `event_settings.banner_path` | `uploads/banners/` | `{APP_URL}/uploads/banners/img_<uniqid>.<ext>` | `Upload::pathToUrl()` |
| Community logo (inlined into the pass) | n/a — constant | `backend/assets/logo.png` | inlined into the pass JPEG | ⚠️ **file does not exist** |

```
POST /api/register
  → validate → upload photo → generate ID → generate QR → generate pass
  → INSERT participants (status = 'registered')
  → send confirmation email
  → 201 Created
```

The participant receives a pass **immediately and unconditionally**, with no fee, no approval, and no payment gate. `status` starts at `'registered'`; nothing in the system ever changes it to `'verified'` automatically.


---







- ⚠️ The wildcard branch is **dead code** in the current config since `FRONTEND_URL` is the real Netlify URL
- The `download-pass` route inherits these global headers; the frontend fetches it as a blob, which requires them to be present

---




### 9.2 Key facts

- **Storage is 100% local disk** on the cPanel host, inside the web root. Not S3, not a CDN, not remote.
- ⚠️ **The DB stores absolute filesystem paths**, e.g. `/home/<user>/public_html/api/uploads/photos/img_65f0....jpg`. `Upload::pathToUrl()` strips the `UPLOAD_BASE` prefix at read time. **This makes the stored data host-specific and is the single most important data transformation in the migration** (§14).
- `uploads/` is served **directly by Apache** as static files (except passes, which go through the `download-pass` route to force a download).
- ⚠️ **Files are served with no authentication.** Anyone who knows or guesses a filename can fetch a participant photo. `uniqid()` is time-based and predictable.
- ⚠️ **Passes accumulate.** `pass_<pid>_<unix_time>.jpg` creates a new file on every regeneration; old files are deleted only when the participant row is deleted.
- ⚠️ **Orphaned files are possible.** If a row is deleted directly in phpMyAdmin (bypassing the API), its files remain forever.

### 9.3 Static frontend media (no migration needed)

These live in `public/` and are bundled by Vite into `dist/`. They are **not** in the database and require no work:
- `logo.png` (via `import.meta.env.BASE_URL + 'logo.png'` in `Navbar.tsx` L43, `Footer.tsx` L5)
- `community-photo.png` (hero/about image, `Home.tsx` L132)
- `image_1785705*.png` ×6 (gallery, `Home.tsx` L137–142)
- `favicon.svg`, `robots.txt`
- 7 remote Unsplash URLs (`Home.tsx` L143–148, L164)

⚠️ Note the **duplication**: the same gallery images exist in `public/` and are *supposed* to be manageable via the `gallery` table + `/api/admin/gallery`. In practice the `gallery` table is unused (§4).

### 9.4 What must move to Supabase Storage

| Bucket | Contents | Public? | Replaces |
|---|---|---|---|
| `participant-photos` | Passport photos | ⚠️ Should be **private** (signed URLs) | `uploads/photos/` |
| `passes` | Generated attendee pass JPEGs | **Public** (or signed) | `uploads/flyers/pass_*.jpg` |
| `qr-codes` | Generated QR PNGs | **Public** | `uploads/flyers/qr_*.png` |
| `sponsor-logos` | Sponsor logos | **Public** | `uploads/sponsors/` |
| `event-images` | Gallery + banner | **Public** | `uploads/gallery/`, `uploads/banners/` |

Bucket names are interchangeable — the important decisions are:
1. **Participant photos should be private.** They are personal data (passport-style photographs). Serving them from a public bucket at a guessable URL is a privacy problem. Use signed URLs with a short TTL, or proxy them through an authenticated Node endpoint.
2. **Passes and QR codes must remain publicly readable**, because the verification page and the email attachment depend on them without auth.
3. **QR codes and passes are regenerable artifacts.** It is acceptable — probably preferable — to **not migrate the existing ones** and regenerate on demand. See the trap below.

### 9.5 🔴 The QR code trap — the most important file issue

**Every QR code ever generated encodes a full URL to the PHP domain:**

```
https://api.whitehallpavilionmotel.com/verify.php?id=MIWC2026-000042
```

This is baked into:
- the PNG at `uploads/flyers/qr_<pid>.png`
- the **attendee pass JPEG** participants have already received by email and downloaded

**When the PHP backend is decommissioned, every one of those QR codes and passes becomes a dead link.** Participants will scan a QR at the event and get a cPanel 404.

| Option | Approach | Trade-off |
|---|---|---|
| **A** ⭐ | **Serve the verification page from a new stable URL** and regenerate all passes/QRs against it | Best long-term; needs a bulk regeneration script and re-issuing passes |
| **B** | Keep the old domain alive, reverse-proxied to the new Node service | Zero re-issuing; but you must keep renewing the cPanel subdomain + SSL |
| **C** | Accept old passes are dead; have marshals verify by typing the ID | Simplest; poor participant experience |

**If you choose A**, the new QR payload should be a **stable, frontend-hosted URL** such as `https://<netlify-site>/verify?id=MIWC2026-000042`, rendered by a React route — that removes the backend from the QR path entirely and survives future backend migrations. The existing `regenerate-pass` endpoint is the right tool, but it must be driven by a **new bulk script**, since the React admin has no UI for it.

⚠️ Whatever the choice, `GET /api/verify/:id` should also **accept a full legacy URL** as the `:id` parameter and extract the `?id=` value. That single change makes the existing (currently broken) scanner work with both old and new payloads.

### 9.6 Storage migration procedure

1. Copy `uploads/` off the cPanel host (FTP/SFTP/cPanel File Manager) — ⚠️ **do this first; the files exist nowhere else.**

---

2. Create the 5 Supabase Storage buckets (§18).
3. Upload each file to its bucket, using the **path segment after `uploads/`** as the storage key.
4. Update `*_path` columns to store that key, e.g. `photos/img_65f0....jpg` → `participant-photos/img_65f0....jpg`.
5. Update the `pathToUrl()` equivalent to build URLs from bucket + key, or use `createSignedUrl` for the private bucket.

⚠️ **Verify file count against row count before and after.** Orphaned files (rows deleted in phpMyAdmin) and missing files are both likely; decide explicitly whether to migrate orphans.
## 10. EMAIL AND NOTIFICATIONS

### 10.1 Current implementation

| Aspect | Finding |
|---|---|
| **Library** | **None.** No PHPMailer, no Symfony Mailer, no SwiftMailer — not in the codebase and not in `composer.json` (there is no `composer.json` at all) |
| **Transport** | PHP's built-in `mail()`, which shells out to the host's local MTA (`/usr/sbin/sendmail`) |
| **SMTP config** | ⚠️ `config.php` L57–63 defines `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME` — **none of these are ever read by any PHP file.** Dead configuration. |
| **Error handling** | `@mail(...)` — errors fully suppressed; the boolean return is ignored by `RegistrationController` |
| **Logging** | Only `EmailController` (bulk sends) writes to `email_log`. **Registration confirmations are never logged.** |
| **Retries / queue** | None |
| **Templates** | Two inline HTML heredocs in `Mailer.php` and one in `EmailController.php` |
| **Password reset emails** | ❌ **None** — no such feature exists |
| **Admin notifications** | ❌ **None** — no admin is notified of a new registration |
| **Contact-form auto-reply** | ❌ None |

⚠️ The README's troubleshooting entry — *"Emails not sending → use cPanel's SMTP in `config.php`"* — is **factually incorrect against this code.** Setting SMTP constants changes nothing; the code would need a real SMTP library.

### 10.2 Every email the system sends

| # | Email | Trigger | Function | Attachment | Logged? |
|---|---|---|---|---|---|
| 1 | **Registration confirmation** | After `POST /api/register`, **only if the pass generated successfully** | `Mailer::sendRegistrationConfirmation()` (`Mailer.php` L37-41) | ✅ Pass JPEG (`multipart/mixed`) | ❌ No |
| 2 | **Bulk admin email** | `POST /api/admin/email/send` (**no UI exists**) | `EmailController::send()` → `Mailer::send()` | Optional, via client-supplied `attachment_path` | ✅ `email_log` (one row per recipient) |

**Email #1 template** (`Mailer::registrationTemplate()` L43–82) — subject `🎉 Registration Confirmed — {EVENT_NAME}`:
- Table-based HTML, 600 px wide, `#0B0B0B` background with `#22C55E` accent
- "Dear {name}," greeting
- Event name in green
- Info table: **Participant ID**, **Name**, **Registered** date (`d F Y`)
- "Your **Attendee Pass** is attached to this email."
- Green CTA button linking to `{APP_URL}/verify.php?id={participant_id}` — labelled "Verify My Pass"
- Footer: "© 2026 Mowe-Ibafo X Community · All rights reserved"

**Email #2 template** (`EmailController::buildEmailBody()` L55–72):
- Same visual language (600 px table, `#0B0B0B` + `#22C55E`)
- "Dear {name}," + the admin-supplied message (escaped, `nl2br`)
- Rule, then "Mowe-Ibafo X Community Fitness Walk 2026" footer

⚠️ **Name-collision note:** the subject of email #1 is literally `🎉 Registration Confirmed — {EVENT_NAME}` where `EVENT_NAME` is the constant `'Fitness Walk 2026'`, producing "…— Fitness Walk 2026".

### 10.3 What must change in Node.js

**`mail()` does not exist on Render.** Silently, guaranteed failure. A transactional provider is required.

| Option | Approach | Recommendation |
|---|---|---|
| **Resend** | `resend` npm package, HTTP API, no SMTP setup | ⭐ Simplest; good deliverability; free tier for low volume |
| **Brevo (SendGrid)** | `@sendgrid/mail` | Solid, has a free tier |
| **Nodemailer + SMTP** | `nodemailer` against any SMTP host | Most flexible; use if the existing `mail.whitehallpavilionmotel.com` SMTP host genuinely works |

**What stays exactly the same:**
- Both HTML templates — copy them verbatim, then extract them into real template files (e.g. `src/templates/emails/registrationConfirmation.html`). They are already correct and brand-aligned.
- The subject lines.
- The "Verify My Pass" CTA — but repoint it at the new verification URL (§9.5).
- The `email_log` table and its `sent | failed` ENUM.

**What must change:**
- ❌ The dead `SMTP_*` constants in `config.php` → real environment variables (§11).
- ❌ `Mailer::send()` → a Node mailer module.
- ⚠️ **Error handling must be fixed.** Do not replicate the `@`-suppressed fire-and-forget. At minimum: `await` the send, catch errors, log to `email_log`, and return a warning in the registration response. Registration should still succeed if email fails — but the failure must be **visible**.
- ⚠️ **Consider making email async.** Sending inline blocks the response for the SMTP round trip. For registration confirmation this is usually acceptable; for bulk email it is not (§6.9).

### 10.4 The `attachment_path` problem

`EmailController.php` L46:
```php
$ok = Mailer::send($p['email'], $subject, $html, $attachment && file_exists($attachment) ? $attachment : '');
```
The attachment path is a **raw filesystem path supplied by the client in the request body**. It is constrained to files that exist on the server, but it is still a local-file-read primitive and it will break entirely once storage moves to Supabase (there is no local filesystem).

**Recommendation:** drop `attachment_path` entirely. The only legitimate use is attaching a participant's pass, which is already derivable from their `flyer_path` / storage key. Let the caller pass a **storage key**, not a path.

---


---

## 11. ENVIRONMENT VARIABLES AND SECRETS

> **No secret values are reproduced in this document.** Names and purposes only. Several of these values are currently committed in plaintext to version control and **must be rotated** — see §6.11 item 1.

### 11.1 Current configuration — PHP (`backend/config.php`)

There is no `.env` mechanism. Everything is a PHP `define()` in one file, committed to git.

| Constant | Purpose | In git? | Notes |
|---|---|---|---|
| `DB_HOST` | MySQL connection host | 🔴 Yes | `localhost` on cPanel |
| `DB_NAME` | MySQL database name | 🔴 Yes | cPanel prefix + app name |
| `DB_USER` | MySQL username | 🔴 Yes | |
| `DB_PASS` | MySQL password | 🔴 **Yes — plaintext** | **Rotate** |
| `DB_CHARSET` | MySQL charset | No (harmless) | `utf8mb4` |
| `APP_NAME` | Display name in health check + emails | No | |
| `SITE_NAME` | Display name | No | |
| `APP_URL` | Backend base URL — builds `UPLOAD_URL`, `QR_BASE_URL`, pass footer, verify links | No | ⚠️ Must change to the Render URL |
| `FRONTEND_URL` | CORS allowlist entry | No | ⚠️ Must match the Netlify origin exactly |
| `COMMUNITY_NAME` | Email "From" name, pass branding | No | |
| `EVENT_NAME` | Event title in emails, QR, pass | No | |
| `EVENT_YEAR` | Year string | No | |
| `PARTICIPANT_PREFIX` | ID prefix → `MIWC2026-000001` | No | ⚠️ Preserve this format |
| `JWT_SECRET` | HS256 signing key for admin tokens | 🔴 **Yes — plaintext** | **Rotate.** A static string, so the installer's random generator likely never ran. |
| `JWT_EXPIRY` | Token lifetime (86400 s = 24 h) | No | |
| `UPLOAD_BASE` / `_PHOTOS` / `_FLYERS` / `_SPONSORS` / `_GALLERY` | Absolute filesystem paths | No (host-specific) | Replaced by Supabase Storage |
| `UPLOAD_URL` | Public base URL for uploads | No | |
| `MAX_UPLOAD_SIZE` | 5 MB limit | No | |
| `ALLOWED_IMAGE_TYPES` | MIME allowlist | No | |
| `ALLOWED_IMAGE_EXT` | Extension allowlist | No | |
| `QR_SIZE` | 300 px | No | |
| `QR_BASE_URL` | `{APP_URL}/verify.php?id=` — ⚠️ **the QR payload prefix** | No | Must change |
| `PASS_WIDTH` / `PASS_HEIGHT` | 900 × 500 | No | |
| `PASS_BG_COLOR` / `PASS_ACCENT` | `#0B0B0B` / `#22C55E` | No | |
| `COMMUNITY_LOGO` | Path to the pass logo | No | ⚠️ File missing |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | ⚠️ **Truly dead** — never read by any file | 🔴 Yes (`SMTP_USER`, `SMTP_PASS`) | **Rotate anyway — they are live credentials** |
| `SMTP_FROM` / `SMTP_FROM_NAME` | ⚠️ **Live, despite the name** — `Mailer.php` L11–12 builds `From:` / `Reply-To:` from them | 🔴 Yes (`SMTP_FROM`) | Must be preserved |
| `WHATSAPP_NUMBER` | Event WhatsApp | No | Not used server-side |
| `SPONSOR_WHATSAPP_MSG` | Pre-filled sponsor enquiry message | No | Not used server-side |
| `PAGE_SIZE` | Admin list page size (20) | No | |
| `CSV_DELIMITER` / `CSV_ENCLOSURE` | CSV format | No | |
| `PREVENT_DUPLICATE_EMAIL` | Duplicate-email guard (true) | No | ⚠️ Not enforced at DB level |

| `PREVENT_DUPLICATE_PHONE` | Duplicate-phone guard (**false**) | No | |
| `APP_TIMEZONE` | `Africa/Lagos` | No | ⚠️ See §14 timestamp handling |
| `LOG_DIR` / `LOG_ERRORS` | Error log path + toggle | No | |
| `APP_ENV` | `production` | No | |
| `DEBUG` | `false` | No | ⚠️ Must stay `false` on Render |
### 11.2 Current configuration — Frontend

| Variable | Declared in | Read by code? | Purpose |
|---|---|---|---|
| `VITE_API_URL` | `.env.example` | ❌ **No** | Intended React → API base. The three pages hardcode the URL instead. |
| `import.meta.env.BASE_URL` | Vite built-in | ✅ Yes | Asset paths (`Navbar`, `Footer`, `Home`) and the wouter router base. Not user-configurable. |

**That is the entire frontend configuration surface.** No `.env`, `.env.production`, or `.env.local` is committed.

### 11.3 Target environment variables

**Netlify (build-time; `VITE_` prefix = compiled into the public browser bundle):**

| Variable | Purpose | Public? |
|---|---|---|
| `VITE_API_URL` | Node API base, e.g. `https://fitness-walk-api.onrender.com/api` | ✅ Public by design |

**Render (runtime, server-side only — never prefixed, never exposed to the browser):**

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | ⚠️ **Provided automatically by Render — do not set it** |
| `DATABASE_URL` | Supabase Postgres connection string (`postgresql://…`) |
| `SUPABASE_URL` | Supabase project URL (for the service-role client) |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔑 Bypasses RLS. **Server-side only** — never ship to the browser |
| `SUPABASE_ANON_KEY` | Only if the frontend ever talks to Supabase directly (not recommended here) |
| `APP_URL` | Public base URL of the API (links in emails, QR payloads) |
| `FRONTEND_URL` | Netlify origin for the CORS allowlist |
| `JWT_SECRET` | 🔑 Signing key, if any custom JWT remains |
| `PARTICIPANT_PREFIX` | `MIWC2026` |
| `QR_BASE_URL` | New verification URL prefix |
| `MAX_UPLOAD_SIZE` | `5242880` |
| `ALLOWED_IMAGE_TYPES` | `image/jpeg,image/png,image/webp` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_FROM_NAME` | Mail provider credentials |
| `MAIL_PROVIDER_API_KEY` | If using Resend/Brevo instead of SMTP |
| `APP_TIMEZONE` | `Africa/Lagos` |
| `ADMIN_EMAILS` | Comma-separated permitted admin emails (§18) |
| `RATE_LIMIT_*` | Optional per-route limits |
| `LOG_LEVEL` | `info` / `debug` |

**Supabase dashboard (not env vars, but required configuration):**

| Item | Purpose |
|---|---|
| Project URL + anon key | Client construction |
| Service role key | Server-side admin operations (user creation) |
| Database connection string | `DATABASE_URL` on Render |

---

### 11.4 Secrets handling — mandatory changes

| # | Action |
|---|---|
| 1 | 🔴 **Rotate** the MySQL password, JWT secret, and SMTP password. They are in git history — assume compromise. |
| 2 | 🔴 **Change the admin password** from `Admin@2026`. It is published in three places. |
| 3 | Create `server/.env` locally and `server/.env.example` with **empty placeholders**. Add `.env` to `.gitignore`. |
| 4 | On Netlify set **only** `VITE_API_URL` — never a service-role key. Anything `VITE_`-prefixed is compiled into the public JS. |
| 5 | On Render set all secrets in the dashboard, never in `netlify.toml` or committed files. |
| 6 | Delete `backend/config.php` from the new codebase. Do not port the `define()` pattern. |
| 7 | Use `dotenv` **plus a boot-time validation step** (e.g. `zod.parse(process.env)`) so a missing variable fails fast rather than silently. |
## 12. CURRENT DEPLOYMENT

### 12.1 Production topology (as documented in `backend/README.md` + observed in code)

```
┌─────────────────────────────────────────────────────────────┐
│ Netlify                                                     │
│   build:   npm run build  (vite build --config vite.config.ts)│
│   publish: dist                                             │
│   redirects: /* → /index.html  200                          │
│   site:    https://mowefitnesswalk.netlify.app              │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS, fetch(), CORS, Authorization: Bearer
               ▼
┌─────────────────────────────────────────────────────────────┐
│ cPanel shared hosting — subdomain                           │
│   https://api.whitehallpavilionmotel.com                    │
│                                                              │
│   /api/*        → mod_rewrite → api/index.php               │
│   /verify.php   → public HTML verification page             │
│   /uploads/*    → static files served directly by Apache     │
│   /install/     → one-time installer (should be deleted)    │
│                                                              │
│   Requires: PHP ≥ 8.0, PDO + pdo_mysql, GD, JSON, mbstring, │
│   writable uploads/ and logs/                               │
└──────────────┬──────────────────────────────────────────────┘
               │ PDO (mysql:host=localhost)
               ▼
┌─────────────────────────────────────────────────────────────┐
│ MySQL 5.7+ / MariaDB 10+                                    │
│   database: whitehal_mixc                                   │
│   user:     whitehal_user                                   │
│   charset:  utf8mb4, InnoDB                                 │
│   session time_zone: +01:00 (set by schema.sql)             │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Detectable configuration

| Item | Value | How detected | Confidence |
|---|---|---|---|
| **Frontend API URL** | `https://api.whitehallpavilionmotel.com/api` | Hardcoded in 3 `.tsx` files | ✅ Confirmed |
| **Backend base URL** | `https://api.whitehallpavilionmotel.com` | `config.php` L17 `APP_URL` | ✅ Confirmed |
| **Frontend origin (CORS)** | `https://mowefitnesswalk.netlify.app` | `config.php` L19 `FRONTEND_URL` | ✅ Confirmed |
| **Database host** | `localhost` | `config.php` L8 | ✅ Confirmed (cPanel convention) |
| **Database name** | `whitehal_mixc` | `config.php` L9 | ✅ Confirmed |
| **Database user** | `whitehal_user` | `config.php` L10 | ✅ Confirmed |
| **PHP version** | **≥ 8.0 required**; actual deployed version **not detectable** | `install/index.php` L19; `README.md` | ⚠️ Required ≥ 8.0; actual unknown. `str_starts_with` (`AuthMiddleware` L9) and the `match` expression (`EmailController` L20) both confirm the code needs PHP 8.0+. |
| **MySQL version** | **5.7+ / MariaDB 10+** stated | `README.md` only | ⚠️ **Stated, not verifiable from the repo.** |
| **Extensions required** | PDO, pdo_mysql, GD, JSON, mbstring | `install/index.php` L19–27 | ✅ Confirmed |
| **App timezone** | `Africa/Lagos` (UTC+1) | `config.php` L81 | ✅ Confirmed |
| **DB session timezone** | `+01:00` | `schema.sql` L6 | ✅ Confirmed |
| **SSL/HTTPS** | Required for the `api.` subdomain | `README.md` Steps 1 & 7 (Let's Encrypt / AutoSSL) | ✅ Documented; actual cert status unknown |
| **Scheduled tasks** | **None** | Full codebase search | ✅ Confirmed — no cron, no scheduler |


### 12.3 CORS configuration (exact)

```php
$allowed = [
  'https://mowefitnesswalk.netlify.app',    // FRONTEND_URL
  'https://api.whitehallpavilionmotel.com', // APP_URL
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
// exact string match, then:
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
// OPTIONS → 204, exit
```
⚠️ Exact string match — **no wildcard, no subdomain wildcards.** If the Netlify domain changes, CORS silently stops working with no error on the PHP side.
### 12.4 Domain / subdomain configuration

| Host | Purpose | Configured where |
|---|---|---|
| `mowefitnesswalk.netlify.app` | React SPA | Netlify dashboard; `FRONTEND_URL` in `config.php` |
| `api.whitehallpavilionmotel.com` | PHP API + uploads | cPanel Subdomains; `APP_URL` in `config.php` |
| `whitehallpavilionmotel.com` (apex) | Parent domain / hosting | cPanel; also the email domain |
| `mail.whitehallpavilionmotel.com` | SMTP host (**dead config**) | `config.php` L57 |

⚠️ The parent domain belongs to a **hotel** ("Whitehall Pavilion Motel"), not to the event. Both the API subdomain and the SMTP host sit under it. If that hosting relationship ends, both break.
| Auth provider settings | Email provider, redirect URLs |
| SMTP settings | Custom SMTP for auth emails, if using Supabase's mailer |
### 12.5 ⚠️ What could NOT be determined from the codebase

These require checking the live server or asking the owner. **Do all of this before starting the migration** — several decisions in §14 and §15 depend on it.

| Unknown | How to resolve |
|---|---|
| Actual deployed PHP version | cPanel → "Select PHP Version" |
| Actual MySQL/MariaDB version | phpMyAdmin → `SELECT VERSION();` |
| Whether the `install/` directory still exists | cPanel File Manager / `ls` |
| Whether `uploads/` subfolders and files exist, and their count | cPanel File Manager |
| Whether `logs/errors.log` exists and its contents | cPanel File Manager |
| Actual row counts in all 7 tables | phpMyAdmin |
| **How many rows are in `admins`** | phpMyAdmin — critical for §15 |
| Whether there are **duplicate `participants.email` values** | `SELECT email, COUNT(*) FROM participants GROUP BY email HAVING COUNT(*) > 1;` — critical for the UNIQUE index in §14 |
| Whether `PREVENT_DUPLICATE_PHONE` was ever changed | `config.php` says `false` |
| Whether the `JWT_SECRET` was ever randomised by the installer | If the installer ran it would have replaced the committed value. **Check the live value, not the repo.** |
| Whether SSL is active on the `api.` subdomain | cPanel → SSL/TLS Status |
| Real traffic volume and peak concurrency | Netlify analytics / server logs |
| Whether the seeded admin password was ever changed | Cannot determine from code |
| Whether orphaned upload files exist | Compare file count vs row count |

---


---

## 13. MIGRATION PLAN

**CURRENT:** React 19 + Vite (Netlify) · PHP 8 procedural API (cPanel) · MySQL 5.7/MariaDB (cPanel) · local disk uploads
**TARGET:** React 19 + Vite (Netlify) · Node.js/Express (Render) · Supabase PostgreSQL · Supabase Storage + Supabase Auth

### Phase dependency graph

```
Phase 0  Pre-migration audit & credential rotation   (blocks everything)
   ▼
Phase 1  Supabase project + schema design             (blocks 2, 3, 5, 7, 9)
   ├──────────────┬──────────────┬──────────────┐
   ▼              ▼              ▼              │
Phase 2       Phase 5       Phase 3         (parallel)
Data export   Storage       Auth setup
+ transform   buckets       (admins)
   └──────┬───────┴──────────────┘
          ▼
Phase 4  Node/Express backend  ← depends on 1, 2, 3, 5
   ▼
Phase 6  React API layer        ← depends on 4
   ▼
Phase 7  Data migration         ← depends on 1, 2 (parallel with 4/6)
   ▼
Phase 8  Testing                ← depends on 4, 6, 7
   ▼
Phase 9  Deployment config      (parallel with 4–8)
   ▼
Phase 10 Production cutover     ← depends on 8 + 9
   ▼
Phase 11 Legacy QR/pass remediation ← after 10
```

---

### Phase 0 — Pre-migration audit & credential rotation

**Goal:** establish ground truth before touching anything. **Blocks everything.**

1. 🔴 **Rotate the MySQL password, JWT secret, and SMTP password.** All three are in git history.
2. 🔴 **Change the admin password** from `Admin@2026`.
3. Take a **full backup**: `mysqldump` of `whitehal_mixc` **and** a full copy of `backend/uploads/`. These are the only copies.
4. Run every query in §12.5 — especially the duplicate-email check.
5. Record row counts per table; you will diff against these after migration.
6. **Freeze feature work** on the PHP backend. No new endpoints during the migration.
7. Set up a migration branch in git. Do not work on `master`.

**Exit criteria:** backups verified restorable; all §12.5 unknowns answered; rotated credentials deployed.

---

### Phase 1 — Supabase project & schema design

**Goal:** stand up the target database. **Blocks Phases 2, 3, 5, 7, 9.**

1. Create the Supabase project; note the region (**match the Render region** to minimise latency).

### Phase 2 — Data export & transformation

**Goal:** produce trustworthy, transformed data files. **Blocks Phase 7.**

1. Export MySQL → CSV (or JSON) per table.
2. Apply transformations (full detail in §14):
   - `id` → preserve as the integer PK (`GENERATED BY DEFAULT AS IDENTITY` so explicit IDs can be inserted)
   - `*_path` → strip the host prefix, convert to a storage key
   - `full_name`, `contacts.name/subject/message` → **HTML-entity-decode** (escaped on write)
   - `TINYINT(1)` → `boolean`
   - `ENUM` values → map exactly; flag anything unexpected
   - `DATETIME` → `timestamptz`; ⚠️ MySQL ran at `+01:00`, so naive values are `Africa/Lagos` — convert, do not assume UTC
   - `status` values → validate against the new enum
3. **Dedupe `participants.email`** before creating the UNIQUE index. Decide the survivor rule (recommend: lowest `id` wins) and **record every decision**.
4. Validate row counts against the Phase 0 baseline.

**Exit criteria:** clean transformed CSVs; documented dedupe decisions; counts reconciled.
### Phase 3 — Authentication setup

**Goal:** admin auth working in Supabase. **Blocks Phase 4 (admin routes) and Phase 10.**

1. In Supabase Auth, create the admin user(s) with **new, strong passwords** (Option A, §6.4). Do not reuse `Admin@2026`.
2. Create the matching `public.admins` profile row carrying `name` and `role` (in `raw_app_meta_data`, not `raw_user_meta_data`).
3. Configure the Auth → Email provider.
4. Decide the admin allowlist strategy (§18) — an email allowlist in `ADMIN_EMAILS` is simplest for a 1–5 person team.
5. Configure allowed redirect URLs.

**Exit criteria:** an admin can sign in via Supabase and a profile row resolves with the correct role.

---

### Phase 4 — Node/Express backend

**Goal:** full API parity. **The largest phase. Blocks Phase 6.**

Build per §16; port every endpoint in §17:

| Priority | Must build | Why |
|---|---|---|
| **P0** | `GET /`, `POST /api/register`, `GET /api/verify/:id`, `GET /api/sponsors`, `GET /api/download-pass/:filename` | The 5 endpoints the live frontend actually calls |
| **P0** | Auth middleware + `GET /api/admin/dashboard`, `GET /api/admin/participants`, `GET /api/admin/sponsors`, `POST /api/admin/sponsors`, `GET /api/admin/export/:type` | Everything the admin UI calls |
| **P1** | `PUT/DELETE /api/admin/participants/:id`, `regenerate-pass`, `bulk-delete`, `GET /api/admin/stats` | Backend exists today with no UI; keep for parity |
| **P1** | `GET /api/event`, `GET /api/gallery`, `POST /api/contact` + admin contact routes | Public endpoints; cheap to port |
| **P1** | `POST /api/admin/email/send` | ⚠️ **Rewrite to be async** — do not port the synchronous loop |
| **P2** | `GET/PUT /api/admin/event`, gallery CRUD | Rarely used |
| — | `POST /api/admin/login` | **Supabase Auth replaces it** — do not rebuild |

Non-negotiables while building:
- **Preserve the `{success, message, data, errors}` envelope and all status codes exactly** (§3). The frontend depends on them.
- **Add rate limiting** (required, §6.9), especially on `/register` and admin routes.
- **Add security headers** (helmet).
- **Never concatenate SQL.** Parameterized queries with a fixed column whitelist.
- **Escape on output, not on input.** Stop calling `sanitizeString()` before storing.
- **Log email failures** instead of `@`-suppressing them.
- Add a **health-check endpoint** for Render (§19).

**Exit criteria:** all P0 + P1 endpoints tested with `curl` against local Supabase; response shapes byte-compatible with PHP.

---

### Phase 5 — File & storage migration

**Goal:** media available at Supabase Storage. **Blocks Phase 7 and Phase 11.**

1. Create buckets (done in Phase 1).
2. Upload `uploads/photos/`, `uploads/flyers/`, `uploads/sponsors/`, `uploads/gallery/`, `uploads/banners/` to their buckets, preserving the path segment as the object key.
3. Decide the participant-photo policy: **private bucket + signed URLs** (recommended) or public (matching current behaviour). ⚠️ A privacy decision, not a technical one — get sign-off.
4. Write the bulk pass/QR regeneration script (Phase 11 tooling) — needed either way.

⚠️ **Passes and QR codes are regenerable.** A pragmatic approach is to migrate participant photos and sponsor logos, then **regenerate** passes and QR codes on demand rather than uploading stale images pointing at the dead domain.

**Exit criteria:** file count matches expectation; spot-check 10 random participants' photos render.

---

### Phase 6 — React API layer changes

**Goal:** frontend talking to the new backend. **Depends on Phase 4. Small but critical.**

1. **Create `src/lib/api.ts`** — the single most important frontend change:
   ```ts
   export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
   export async function apiFetch(path, options) { /* JSON, FormData, error envelope, 401 handling */ }

### Phase 7 — Data migration into Supabase

**Goal:** live data in Postgres. **Depends on Phases 1 and 2.**

1. Insert in FK-safe order: `event_settings` → `admins` (profiles) → `sponsors` → `gallery` → `contacts` → `participants` → `email_log`.
2. Preserve explicit `id` values where they matter (see §14 on IDs).
3. **Advance the ID sequence past the highest imported value** — otherwise the next insert collides. ⚠️ Classic and easy to miss.
4. Reset `event_settings` to `id = 1` and fix its sequence.
5. Reconcile row counts against the Phase 0 baseline.
6. Spot-check 10 random participants: name (decoded), email, phone, status, registered_at, photo URL.

⚠️ **Do this in a staging Supabase project first, then repeat for production.** A single verified script beats a manual phpMyAdmin import.

**Exit criteria:** counts match; spot checks pass; the app works against the migrated data.

---

### Phase 8 — Testing

| Test type | Coverage |
|---|---|
| **Unit** | Validator rules; participant-ID generation; envelope helpers; QR payload parsing (bare ID **and** full URL) |
| **Integration** | Every endpoint in §17 against local Supabase, asserting exact status codes and envelope shape |
| **Contract** | ⭐ Assert the new API's JSON matches what the React code reads — `json.data?.data ?? []`, `json.data?.stats`, `json.errors`, `json.data.token` |
| **File handling** | Upload a valid image, an oversized file, a fake image, a `.php` renamed to `.jpg` — all must be rejected safely |
| **Auth** | Unauthenticated admin request → 401; expired/garbage token → 401; valid token → 200; wrong password → 401 |
| **Rate limiting** | Confirm `/register` and `/admin/login` actually throttle |
| **Email** | Confirm a real registration email arrives **with the pass attached**, and that failures are logged |
| **QR flow** | Scan a new QR in the admin UI and confirm it resolves |
| **CSV** | Open the export in Excel — the UTF-8 BOM must be preserved |
| **Regression** | Register 3 test participants; verify all appear in the admin table and export |
| **Performance** | `GET /verify/:id` and `POST /register` under expected load |
| **Browser** | Safari + iOS — the `BarcodeDetector` gap (§2) needs a `jsQR` fallback or explicit manual-entry guidance |

**Exit criteria:** no open critical/high defects.

---

### Phase 9 — Deployment configuration

Runs parallel to Phases 4–8.

- **Render** service per §19: Node version, build/start commands, env vars, health check, CORS.
- **Netlify** env var per §20: `VITE_API_URL`.
- **Supabase** production settings per §18.
- Set the Render instance to **not sleep**, or accept cold starts. ⚠️ Cold starts hurt the QR scanner at the event — see §21.
- Configure the mail provider (Resend/Brevo) and verify sending-domain SPF/DKIM.

---

### Phase 10 — Production cutover

1. **Announce a maintenance window.** Registration is event-critical; do not cut over mid-registration.
2. Final MySQL dump + `uploads/` copy. **Keep the PHP backend running read-only as a fallback.**
3. Run the data migration script against production Supabase.
4. Point `VITE_API_URL` at Render; trigger a Netlify rebuild.
5. Smoke test: register a real participant → check the pass, the QR, the email, the admin dashboard, the CSV, the scanner.
6. **Keep PHP up for 48–72 hours** in read-only mode as a rollback.
7. Only after the event: retire the cPanel subdomain, delete the PHP files, and remove all secrets from the repo.

⚠️ **Do not delete the cPanel subdomain before Phase 11 is resolved** — the old domain is what the old QR codes point at (§9.5, Option B).

---

### Phase 11 — Legacy QR & pass remediation

Pick one (§9.5):

---

## 14. MYSQL → SUPABASE MAPPING

### 14.1 Global type conversions

| MySQL | PostgreSQL | Transformation |
|---|---|---|
| `INT UNSIGNED AUTO_INCREMENT PRIMARY KEY` | `integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY` | ⚠️ `BY DEFAULT` (not `ALWAYS`) is **required** so you can insert explicit IDs during migration. `UNSIGNED` is dropped — Postgres integers are signed; add `CHECK (id >= 0)` for strict parity. |
| `VARCHAR(n)` | `text` (+ `CHECK` for length if needed) | Postgres `varchar(n)` *does* enforce length, so `varchar(255)` is a valid direct mapping. Recommendation: `text`, with `CHECK (char_length(col) <= n)` only where a limit is genuinely required. |
| `TEXT` | `text` | Direct. |
| `ENUM('a','b')` | Postgres `CREATE TYPE ... AS ENUM` **or** `text` + `CHECK` | **Recommendation: `text` + `CHECK`.** Adding a value to a Postgres enum requires `ALTER TYPE`, which is painful; a CHECK is a one-line change. |
| `TINYINT(1)` | `boolean` | `1`→`true`, `0`→`false`. Only `event_settings.registration_open`. |
| `DATETIME` | `timestamptz` | ⚠️ **See the timezone warning below.** |
| `CURRENT_TIMESTAMP` | `now()` | Direct. |
| `ON UPDATE CURRENT_TIMESTAMP` | ❌ **No equivalent** | Use a trigger, **or** set `updated_at` explicitly in the application layer (recommended — a shared `update()` helper). |
| `INT UNSIGNED` | `integer` + `CHECK (>= 0)` | For `priority`, `sort_order`. |
| `utf8mb4` | UTF-8 (default) | No action. |
| `KEY x (col)` | `CREATE INDEX x ON t (col)` | Direct. |
| `UNIQUE` | `UNIQUE` constraint / unique index | Direct. |

#### ⚠️ Timezone warning — read before importing timestamps

Several timezones are in play and the current data is ambiguous:

1. `schema.sql` L6 sets the MySQL session to `+01:00`.
2. `config.php` L81 sets PHP to `Africa/Lagos` (UTC+1, no DST).
3. `registered_at` is populated by **MySQL's** `CURRENT_TIMESTAMP` default — the INSERT omits the column (§4) — so it is **UTC+1**.
4. `updated_at` likewise. `last_login` is set by `NOW()` (UTC+1); `created_at` defaults to `CURRENT_TIMESTAMP` (UTC+1).

Because `Africa/Lagos` is permanently UTC+1 with no DST, UTC+1 and `Africa/Lagos` agree. **So `timestamptz` values should be produced by treating the stored naive datetime as `Africa/Lagos` and converting to UTC.** Do **not** load them as if they were UTC — that shifts every registration back by an hour.

```sql
to_timestamp(registered_at, 'YYYY-MM-DD HH24:MI:SS') AT TIME ZONE 'Africa/Lagos'
```

**Do not leave these as `timestamp without time zone`.** Render runs in UTC; a naive timestamp is silently misinterpreted.

---

### 14.2 `admins` → Supabase Auth + `public.admins`

⚠️ **The only table with a non-mechanical mapping**, because `password` must move into Supabase Auth.

| MySQL column | MySQL type | Supabase destination | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `public.admins.legacy_id` | `integer` | ⚠️ **Cannot be preserved as a UUID.** Keep the original for traceability. |
| — | — | `auth.users.id` | `uuid` | Generated by Supabase |
| — | — | `auth.users.email` | `text` | Direct (already unique) |
| — | — | `auth.users.encrypted_password` | `text` | ⚠️ **Omit entirely** per §6.4 Option A — let Supabase generate it |

### 14.3 `participants` → `public.participants`

| MySQL column | MySQL type | Supabase column | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `id` | `integer GENERATED BY DEFAULT AS IDENTITY` | ⚠️ Preserve the value; **advance the sequence** afterwards |
| `participant_id` | `VARCHAR(30)` | `participant_id` | `text` | Direct. `UNIQUE`. ⚠️ **Preserve exactly** — printed on passes and emailed. |
| — | — | `participant_seq` | `integer` | ⭐ **NEW.** `substring(participant_id from 10)::int` — the numeric suffix |
| `full_name` | `VARCHAR(150)` | `full_name` | `text` | ⚠️ **`html.unescape()`** — escaped on write (§4) |
| `email` | `VARCHAR(150)` | `email` | `text` | Lowercase. ⚠️ **Add `UNIQUE`** — dedupe first. |
| `phone` | `VARCHAR(30)` | `phone` | `text` | Direct (raw, unnormalized) |
| `photo_path` | `VARCHAR(500)` | `photo_key` | `text` | 🔴 **Transform:** strip the host prefix → `participant-photos/<filename>`. `NOT NULL` preserved. |
| `flyer_path` | `VARCHAR(500)` | `pass_key` | `text` | 🔴 Transform → `passes/<filename>`. ⚠️ Nullable, often stale/regenerable. |
| `qr_path` | `VARCHAR(500)` | `qr_key` | `text` | 🔴 Transform → `qr-codes/<filename>`. ⚠️ Often `NULL` (QR generation can fail). |
| `status` | `ENUM('registered','verified','cancelled')` | `status` | `text` + `CHECK` | Direct. `check (status in ('registered','verified','cancelled'))`, default `'registered'` |
| `ip_address` | `VARCHAR(45)` | `ip_address` | `inet` (or `text`) | ⭐ **Recommend `inet`** (validates format). Use `text` to preserve malformed values exactly. ⚠️ Personal data under GDPR/NDPA — consider dropping. |
| `registered_at` | `DATETIME` | `registered_at` | `timestamptz` | ⚠️ Convert from `Africa/Lagos` (§14.1) |
| `updated_at` | `DATETIME` | `updated_at` | `timestamptz` | Same; app-layer maintenance |
| `idx_email(email)` | index | `participants_email_key` | **unique** index | ⚠️ **Becomes UNIQUE** — dedupe first |
| `idx_phone` | index | `participants_phone_idx` | btree | Direct |
| `idx_status` | index | `participants_status_idx` | btree | Direct |
| `idx_date` | index | `participants_registered_at_idx` | btree | Direct |

```sql
-- race-free participant ID generation (replaces MAX(id)+1)
create sequence participant_seq start 1;

create or replace function next_participant_id(p_prefix text) returns text
language plpgsql as $$
declare n integer;
begin
  n := nextval('participant_seq');
  return p_prefix || '-' || lpad(n::text, 6, '0');
end $$;
-- pass PARTICIPANT_PREFIX from config; do not hardcode 'MIWC2026'
```

⚠️ **After importing, run `setval('participants_id_seq', (SELECT max(id) FROM participants))` and `setval('participant_seq', (SELECT max(participant_seq) FROM participants))`** — otherwise the first new registration collides.

---

### 14.4 `event_settings` → `public.event_settings`


### 14.5 `sponsors` → `public.sponsors`

| MySQL column | MySQL type | Supabase column | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `id` | `integer GENERATED BY DEFAULT AS IDENTITY` | Preserve; advance sequence |
| `business_name` | `VARCHAR(200)` | `business_name` | `text` | Direct |
| `logo_path` | `VARCHAR(500)` | `logo_key` | `text` | 🔴 Transform → `sponsor-logos/<filename>` |
| `website_url` | `VARCHAR(500)` | `website_url` | `text` | Direct |
| `whatsapp` | `VARCHAR(30)` | `whatsapp` | `text` | Direct |
| `description` | `TEXT` | `description` | `text` | Direct (unused by the frontend) |
| `priority` | `INT UNSIGNED` | `priority` | `integer` + `CHECK (>= 0)` | Direct, default 0 |
| `status` | `ENUM('active','inactive')` | `status` | `text` + `CHECK` | Direct, default `'active'`. **Used verbatim in queries and API responses — do not rename.** |
| `created_at` / `updated_at` | `DATETIME` | `created_at` / `updated_at` | `timestamptz` | Convert; app-layer `updated_at` |
| `idx_status`, `idx_priority` | index | `sponsors_status_idx`, `sponsors_priority_idx` | btree | Direct |

⚠️ **Ordering contract:** `Sponsor::all()` uses `ORDER BY priority DESC, id ASC`, and `Home.tsx` relies on it. **Preserve this exact ordering.**

---

### 14.6 `gallery` → `public.gallery`

| MySQL column | MySQL type | Supabase column | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `id` | `integer GENERATED BY DEFAULT AS IDENTITY` | Preserve; advance sequence |
| `image_path` | `VARCHAR(500)` | `image_key` | `text` | 🔴 Transform → `event-images/<filename>` |
| `caption` | `VARCHAR(300)` | `caption` | `text` | Direct |
| `category` | `VARCHAR(100)` | `category` | `text` | Direct, default `'general'` |
| `sort_order` | `INT UNSIGNED` | `sort_order` | `integer` + `CHECK (>= 0)` | Direct, default 0 |
| `status` | `ENUM('active','inactive')` | `status` | `text` + `CHECK` | Direct, default `'active'` |
| `uploaded_at` | `DATETIME` | `uploaded_at` | `timestamptz` | Convert from `Africa/Lagos` |
| `idx_status`, `idx_sort_order` | index | `gallery_status_idx`, `gallery_sort_order_idx` | btree | Direct |

⚠️ This table is unused by the frontend (§4). **Consider not migrating it**, or migrating it for future use. Decision needed.

---

### 14.7 `contacts` → `public.contacts`

| MySQL column | MySQL type | Supabase column | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `id` | `integer GENERATED BY DEFAULT AS IDENTITY` | Preserve; advance sequence |
| `name` | `VARCHAR(150)` | `name` | `text` | ⚠️ **`html.unescape()`** |
| `email` | `VARCHAR(150)` | `email` | `text` | Direct (lowercased) |
| `phone` | `VARCHAR(30)` | `phone` | `text` | Direct |
| `subject` | `VARCHAR(300)` | `subject` | `text` | ⚠️ **`html.unescape()`** |
| `message` | `TEXT` | `message` | `text` | ⚠️ **`html.unescape()`** — and the new backend must stop escaping on input |
| `reply` | `TEXT` | `reply` | `text` | Direct |
| `status` | `ENUM('new','read','replied','resolved')` | `status` | `text` + `CHECK` | Direct, default `'new'` |
| `ip_address` | `VARCHAR(45)` | `ip_address` | `inet` (or `text`) | Same consideration as `participants` |
| `created_at` / `updated_at` | `DATETIME` | `created_at` / `updated_at` | `timestamptz` | Convert; app-layer `updated_at` |
| `idx_status`, `idx_email` | index | `contacts_status_idx`, `contacts_email_idx` | btree | Direct |

---

### 14.8 `email_log` → `public.email_log`

| MySQL column | MySQL type | Supabase column | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `id` | `integer GENERATED BY DEFAULT AS IDENTITY` | Preserve; advance sequence |
| `recipient` | `VARCHAR(150)` | `recipient` | `text` | Direct. ⚠️ **No FK** to `participants.email` (not unique) — keep as a plain string. |
| `subject` | `VARCHAR(300)` | `subject` | `text` | Direct |
| `status` | `ENUM('sent','failed')` | `status` | `text` + `CHECK` | Direct, default `'sent'` |
| `sent_at` | `DATETIME` | `sent_at` | `timestamptz` | Convert from `Africa/Lagos` |
| `idx_status` | index | `email_log_status_idx` | btree | Direct |

---

### 14.9 Migration gotchas — consolidated

| # | Gotcha | Consequence if missed |
|---|---|---|
| 1 | Not advancing ID sequences after explicit-ID import | 🔴 First new insert collides → registration fails |
| 2 | Not deduping `participants.email` before adding UNIQUE | 🔴 Import fails halfway |
| 3 | Loading `DATETIME` as if it were UTC | 🔴 Every timestamp off by one hour |
| 4 | Not HTML-decoding `full_name` / contact text | Participants display `O&#039;Brien` |
| 5 | Not stripping the host prefix from `*_path` | 🔴 Every photo/QR URL 404s |
| 6 | Not preserving `participant_id` exactly | Passes, emails, and QR codes no longer match |
| 7 | Not preserving `ORDER BY priority DESC, id ASC` for sponsors | Landing-page sponsor order changes |
| 8 | Not resetting `event_settings.id` to 1 | `Event::update()` (`WHERE id = 1`) updates nothing |
| 9 | Importing the admin seed SQL | 🔴 Re-introduces the known-compromised password |
| 10 | Migrating stale `flyer_path` / `qr_path` as-is | Passes point at the dead PHP domain |

| MySQL column | MySQL type | Supabase column | Supabase type | Transformation Required |
|---|---|---|---|---|
| `id` | `INT UNSIGNED AI` | `id` | `integer` | ⚠️ **Force to `1`** — `Event::update()` hardcodes `WHERE id = 1` |
| `event_name` | `VARCHAR(200)` | `event_name` | `text` | Direct, same default |
| `description` | `TEXT` | `description` | `text` | Direct |
| `event_date` | `DATE` | `event_date` | `date` | Direct |
| `event_time` | `TIME` | `event_time` | `time` | ⚠️ No timezone — same semantics |
| `venue` | `VARCHAR(300)` | `venue` | `text` | Direct |
| `registration_open` | `TINYINT(1)` | `registration_open` | `boolean` | `1`→`true`, `0`→`false` |
| `banner_path` | `VARCHAR(500)` | `banner_key` | `text` | 🔴 Transform → `event-images/<filename>` |
| `contact_email` | `VARCHAR(150)` | `contact_email` | `text` | Direct |
| `contact_phone` | `VARCHAR(30)` | `contact_phone` | `text` | Direct |
| `whatsapp_number` | `VARCHAR(30)` | `whatsapp_number` | `text` | Direct, same default |
| `twitter_url` | `VARCHAR(300)` | `twitter_url` | `text` | Direct, same default |
| `instagram_url` | `VARCHAR(300)` | `instagram_url` | `text` | Direct |
| `facebook_url` | `VARCHAR(300)` | `facebook_url` | `text` | Direct |
| `updated_at` | `DATETIME ON UPDATE` | `updated_at` | `timestamptz` | App-layer maintenance |

⚠️ **Singleton enforcement:** use `id integer primary key check (id = 1)`. Also — **`registration_open` is never enforced today**; decide whether the new backend honours it (recommended) or drop the column.

| — | — | `auth.users.email_confirmed_at` | `timestamptz` | Set to `now()` so the admin can sign in immediately |
| — | — | `auth.users.raw_app_meta_data` | `jsonb` | `{"role":"super","provider":"email"}` — **app_metadata, not user_metadata**, so the role is not user-editable |
| — | — | `auth.users.raw_user_meta_data` | `jsonb` | `{"name":"<admins.name>","legacy_admin_id":<admins.id>}` |
| `name` | `VARCHAR(100)` | `public.admins.name` | `text` | Direct |
| `email` | `VARCHAR(150)` | `public.admins.email` | `text` | Direct; `UNIQUE` |
| `password` | `VARCHAR(255)` | ❌ **Do not import** | — | 🔴 §6.4 Option A. |
| `role` | `ENUM('super','admin')` | `raw_app_meta_data->>'role'` **and** `public.admins.role` | `jsonb` / `text` | Mirror in both: app_metadata for Supabase, the column for cheap middleware checks |
| `last_login` | `DATETIME` | `public.admins.last_login_at` | `timestamptz` | ⚠️ **Historical only.** Supabase maintains `auth.users.last_sign_in_at` going forward. |
| `created_at` | `DATETIME` | `auth.users.created_at`, `public.admins.created_at` | `timestamptz` | Convert from `Africa/Lagos` |

```sql
create table public.admins (
  id            uuid primary key default gen_random_uuid()
                  references auth.users(id) on delete cascade,
  legacy_id     integer unique,
  name          text not null,
  email         text not null unique,
  role          text not null default 'admin'
                  check (role in ('super','admin')),
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);
```

⚠️ **Do not import `backend/database/admin_seed.sql` or the seed block in `schema.sql`.** They contain a known-compromised password.

- **A** — Regenerate all passes/QRs against the new URL and re-issue to participants. Needs a bulk script driving `regenerate-pass` plus an email/WhatsApp campaign.
- **B** — Keep `api.whitehallpavilionmotel.com` reverse-proxied to Render. Zero participant action; ongoing cPanel cost.
- **C** — Do nothing; brief marshals to verify by typed ID.

⚠️ **Do this before the event, not on the day.** Participants arriving with dead QR codes is a visible failure.

   ```
2. Replace the 3 hardcoded `const API_URL = 'https://api.whitehallpavilionmotel.com/api'` occurrences (`Home.tsx:81`, `Register.tsx:12`, `Admin.tsx:3`) with the import.
3. **Add a 401 interceptor** → clear `localStorage` and return to the login form. Fixes the stranded-admin bug (§2).
4. **Remove the pre-filled admin credentials** (`Admin.tsx` L35–36).
5. **Fix the QR scanner** to extract the `?id=` value from the scanned payload (§2).
6. **Fix the validation error-key mismatch** — align backend `errors` keys with the frontend's `name`/`email`/`phone`/`photo` state (§5, Stage 3).
7. **Optionally add**: participant search/filter/pagination (the backend already supports it and the UI ignores it, §8.3), a contacts CSV button, a bulk-email UI. Each is a small UI addition over an existing endpoint.
8. Set `VITE_API_URL` in the Netlify dashboard.

⚠️ Keep the response envelope unchanged so the frontend diff stays minimal. **Do not rewrite the pages while migrating the backend** — two variables at once.

**Exit criteria:** `npm run build` succeeds; `npm run typecheck` clean; the app runs against local Node.

2. Write the PostgreSQL DDL per §14 and §18: 7 tables → an auth-backed `admins` profile plus the 6 domain tables.
3. Apply the recommended fixes: UNIQUE on `participants.email`, sequence-based IDs, `timestamptz`, `text` over `VARCHAR`, native `boolean`, Postgres enums, `*_storage_key` renames.
4. Create the 5 Storage buckets (§18).
5. Enable required extensions (§18).
6. Write RLS policies (§18). The service-role key bypasses RLS, but policies protect against future anon-key exposure.
7. **Do not import data yet** — schema only, so Phases 4 and 6 can be built against an empty database.

**Exit criteria:** schema applies cleanly in a fresh project; buckets exist; lint clean.

---






---





---

## 15. EXISTING USER MIGRATION

### 15.1 Framing: what "users" means in this project

| Entity | Expected count | Is it a "user"? | Migration approach |
|---|---|---|---|
| **Admins** (`admins`) | 1 seeded ⚠️ verify actual | **Yes** — the only authenticating identity | Recreate in Supabase Auth (§6.4 Option A) |
| **Participants** (`participants`) | Unknown ⚠️ verify | **No** — no account, no password, no login | Migrate as **data rows**, not accounts |
| Sponsors / gallery / contacts | Unknown | No | Migrate as data rows |

**There is no `user_id` on any table.** So "how do registrations stay connected to users?" has a simple answer: **they were never connected.** The participant record is self-contained, and the only credential in the system belongs to a staff member.

### 15.2 Answering each of your nine questions

**1. Which user information can be migrated directly?**

| Field | Destination | Direct? |
|---|---|---|
| `admins.name` | `raw_user_meta_data->>'name'` + `public.admins.name` | ✅ Yes |
| `admins.email` | `auth.users.email` + `public.admins.email` | ✅ Yes (already unique) |
| `admins.role` | `raw_app_meta_data->>'role'` + `public.admins.role` | ✅ Yes, with a placement change |
| `admins.created_at` | `auth.users.created_at` | ✅ Yes (as `timestamptz`) |
| `admins.last_login` | `public.admins.last_login_at` | ✅ Yes (historical only) |
| `admins.password` | ❌ Not migrated | 🔴 See question 3 |
| `admins.id` (int) | `public.admins.legacy_id` | ✅ Yes, as a traceability field |

All participant fields (§14.3) migrate directly except the three `*_path` columns, which need transformation.

**2. Which information needs transformation?**
- `role` → must live in `raw_app_meta_data` (not user_metadata) so the client cannot tamper with it.
- `admins.id` (int) → cannot be a UUID; stored as `legacy_id`.
- `photo_path` / `flyer_path` / `qr_path` / `logo_path` / `banner_path` → absolute filesystem paths → Supabase storage keys.
- `full_name` / contact text → HTML-entity-decode.
- All `DATETIME` → `timestamptz`, interpreting stored values as `Africa/Lagos`.
- `TINYINT(1)` → `boolean`.

**3. Whether existing password hashes can be reused.**

Technically yes — the hashes are standard `$2y$12$…` bcrypt, and GoTrue's `auth.users.encrypted_password` column stores exactly that format, and Go's bcrypt implementation parses `$2y$` alongside `$2a$`/`$2b$`. But the method (writing directly to the `auth` schema) is **unsupported, undocumented, and version-fragile** (§6.4 Option B).

**4. Whether Supabase Auth can accept/import the existing password hashes.**

**Not through any supported, first-party import tool.** There is no "import users" UI or documented API in Supabase Auth that accepts an existing hash. The only path is raw SQL against `auth.users`, which requires populating ~15 internal columns by hand.

**5. Whether a password reset flow will be required.**

**In practice, yes — and it is free here.** There is realistically **one** admin account, and its password (`Admin@2026`) is published in the repository, the SQL comments, the README, and the React login form. **It must be rotated regardless of the migration.**

**7. How existing registration/payment records should remain connected to users.**

⚠️ **Moot — there is no such connection and there is no payment data.**
- No `user_id` column on `participants`.
- No payment records exist (§7).
- `participants` rows are standalone. They migrate as data and stay internally consistent (`participant_id` ↔ pass ↔ QR ↔ email).

**8. How IDs should be handled.**

| ID type | Handling |
|---|---|
| `participants.id` (surrogate int) | Preserve the value; use `GENERATED BY DEFAULT AS IDENTITY`; **`setval()` the sequence afterwards** |
| `participants.participant_id` (`MIWC2026-000001`) | ⚠️ **Preserve exactly.** Printed on passes, embedded in QR codes, included in emails. Also extract into a new `participant_seq` integer and seed it from `max(participant_seq)`. |
| `sponsors.id`, `gallery.id`, `contacts.id`, `email_log.id` | Preserve; advance sequences |
| `event_settings.id` | Force to `1` |
| `admins.id` (int) | Cannot be a UUID → keep as `legacy_id` |

**9. Whether migration should happen before or after the new Node backend is completed.**

**After the schema exists, and largely in parallel with the backend build — but before cutover.**

1. **Create the Supabase schema (Phase 1) — empty.** This unblocks backend development.
2. **Build and test the Node backend against the empty schema (Phase 4).** Do not import data yet; you want a known-good schema.
3. **Run the data migration into a staging project (Phase 7)**, then re-run against production.
4. **Point the frontend at the new backend (Phase 6) and test with migrated data.**
5. **Cut over (Phase 10).**

⚠️ Importing data first and debugging the backend against real rows makes root-causing harder. Schema first, code second, data third.

### 15.3 Recommended migration sequence (based on the actual code)

```
STEP 1  Inventory          SELECT COUNT(*) per table; SELECT COUNT(*) FROM admins;
                          duplicate-email query; file count vs row count.
STEP 2  Back up            mysqldump + full copy of backend/uploads/.
STEP 3  Rotate secrets     DB password, JWT secret, SMTP password, admin password.
STEP 4  Create Supabase    Project in the same region as the Render instance.
STEP 5  Apply schema       §14 + §18 DDL. Empty. Sequences created. UNIQUE constraints added.
STEP 6  Create admins      In Supabase Auth: create a user with a NEW password,
                          role in app_metadata, then insert public.admins.
STEP 7  Create buckets     5 buckets (§9.4) + decide the photo-privacy policy.
STEP 8  Export+transform   mysqldump → CSV; apply §14 transformations
                          (decode HTML, strip path prefixes, convert timestamps).
STEP 9  Dedupe emails      Apply the survivor rule; log every decision.
STEP 10 Migrate files      Upload to Storage; build the storage-key map.

## 16. NODE.JS BACKEND STRUCTURE

### 16.1 Recommended layout

This **mirrors the existing PHP architecture** file-for-file, so a developer can map each PHP file to its Node counterpart. Deviations are explained in §16.2.

```
server/
├── src/
│   ├── config/
│   │   ├── env.js              ← zod-validated process.env (replaces config.php)
│   │   ├── supabase.js         ← service-role + anon clients
│   │   └── constants.js        ← PARTICIPANT_PREFIX, PAGE_SIZE, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_SIZE
│   │
│   ├── db/
│   │   ├── pool.js             ← pg Pool (replaces models/Database.php)
│   │   ├── schema.sql          ← PostgreSQL DDL (§14 / §18)
│   │   └── seed.sql            ← event_settings ONLY. NEVER the admin password.
│   │
│   ├── middleware/
│   │   ├── auth.js             ← Supabase JWT verify (replaces AuthMiddleware.php)
│   │   ├── requireAdmin.js     ← ⭐ NEW: role check PHP never had (§6.5)
│   │   ├── cors.js             ← mirrors api/index.php L10–22
│   │   ├── rateLimit.js        ← ⭐ NEW: REQUIRED (§6.9)
│   │   ├── errorHandler.js     ← global handler (replaces set_exception_handler)
│   │   ├── upload.js           ← multer + MIME allowlist (replaces helpers/Upload.php)
│   │   └── validate.js         ← zod schemas (replaces helpers/Validator.php)
│   │
│   ├── routes/
│   │   ├── index.js            ← mounts all routers
│   │   ├── public.routes.js    ← /, /register, /verify, /sponsors, /gallery, /event, /contact, /download-pass
│   │   ├── admin.routes.js     ← everything under /api/admin
│   │   └── admin/
│   │       ├── participants.routes.js
│   │       ├── sponsors.routes.js
│   │       ├── gallery.routes.js
│   │       ├── contacts.routes.js
│   │       ├── event.routes.js
│   │       ├── email.routes.js
│   │       └── export.routes.js
│   │
│   ├── controllers/            ← thin: parse, delegate, respond
│   │   ├── registration.controller.js    ← controllers/RegistrationController.php
│   │   ├── participant.controller.js     ← controllers/ParticipantController.php
│   │   ├── sponsor.controller.js
│   │   ├── gallery.controller.js
│   │   ├── contact.controller.js
│   │   ├── event.controller.js
│   │   ├── email.controller.js
│   │   ├── export.controller.js
│   │   └── dashboard.controller.js       ← inline in api/index.php L126–135
│   │
│   ├── services/               ← business logic (mirrors PHP models + helpers)
│   │   ├── participant.service.js   ← models/Participant.php
│   │   ├── admin.service.js         ← models/Admin.php (now only role lookups)
│   │   ├── sponsor.service.js       ← models/Sponsor.php
│   │   ├── gallery.service.js       ← models/Gallery.php
│   │   ├── contact.service.js       ← models/Contact.php
│   │   ├── event.service.js         ← models/Event.php
│   │   ├── pass.service.js          ← ⭐ REWRITE of PassGenerator.php (GD → sharp)
│   │   ├── qr.service.js            ← ⭐ REWRITE of QRCode.php (remote fetch → local `qrcode`)
│   │   ├── storage.service.js       ← ⭐ NEW: replaces local-disk uploads with Supabase Storage
│   │   ├── mailer.service.js        ← REWRITE of Mailer.php (mail() → Resend/Brevo)
│   │   ├── csv.service.js           ← helpers/CSV.php
│   │   └── participantId.service.js ← ⭐ NEW: race-free ID generation (replaces MAX(id)+1)
│   │
│   ├── repositories/           ← OPTIONAL raw-SQL layer
│   │   ├── participant.repository.js
│   │   └── …
│   │
│   ├── templates/
│   │   └── emails/
│   │       ├── registrationConfirmation.html   ← verbatim from Mailer.php L48–81
│   │       └── bulkMessage.html                 ← from EmailController.php L58–71
│   │
│   ├── utils/
│   │   ├── response.js          ← helpers/Response.php: success/error/unauthorized/notFound/serverError
│   │   ├── logger.js            ← replaces @file_put_contents to logs/errors.log
│   │   ├── qrPayload.js         ← ⭐ NEW: parse a bare ID or a full legacy verify.php URL
│   │   └── html.js              ← ⭐ NEW: escape-on-OUTPUT (replaces the input-side sanitize)
│   │

### 16.2 Deviations from the generic template, and why

| # | Deviation | Reason |
|---|---|---|
| 1 | **`controllers/` + `services/` kept separate** | The PHP code already separates request handling from data access. Keeping the split makes the port mechanical and reviewable. |
| 2 | **`repositories/` is optional** | PHP had models (SQL) *and* controllers. Rather than a third layer, `services/` may hold the SQL directly. Add `repositories/` only if you want services persistence-agnostic. |
| 3 | **`routes/` split per domain** | `api/index.php` is one 217-line if-chain. Splitting avoids reproducing that. |
| 4 | ⭐ **`requireAdmin.js` is new** | PHP has **no role check** (§6.5). Add it now. |
| 5 | ⭐ **`rateLimit.js` is new and mandatory** | PHP has none (§6.9). |
| 6 | ⭐ **`utils/qrPayload.js` is new** | Fixes the broken scanner (§2) and supports legacy URLs (§9.5). |
| 7 | ⭐ **`utils/html.js` (escape on output)** | Replaces the input-side `sanitizeString()` anti-pattern (§6.8). |
| 8 | ⭐ **`services/storage.service.js`** | Abstracting storage keeps Supabase specifics in one file. |
| 9 | ⭐ **`scripts/` directory** | Data/file migration and pass regeneration are **one-time operations**, not API concerns. Keeping them out of `src/` prevents accidental deployment. |
| 10 | **`middleware/upload.js` uses multer + zod** | Replaces manual `$_FILES` handling. ⚠️ Keep the MIME allowlist — it is the actual security control. |
| 11 | **Templates extracted to HTML files** | Currently heredocs inside PHP. External files are testable and previewable. |

### 16.3 Recommended npm packages

| Purpose | Package | Replaces |
|---|---|---|
| Server | `express` ^5 | the hand-rolled router |
| Runtime | `node` 20+ LTS | PHP 8 |
| DB driver | `pg` | PDO |
| Validation | `zod` | `helpers/Validator.php` |
| Uploads | `multer` | `$_FILES` |
| Supabase | `@supabase/supabase-js` | — |
| Auth verify | `jsonwebtoken` (or Supabase `auth.getUser`) | `helpers/JWT.php` |
| Pass image | `sharp` | PHP GD |
| QR image | `qrcode` | remote fetch from `api.qrserver.com` |
| Email | `resend` (or `nodemailer`) | PHP `mail()` |
| CSV | `csv-stringify` (or hand-rolled — the format is trivial) | `helpers/CSV.php` |
| Security | `helmet` | none |
| Rate limit | `express-rate-limit` | none |
| CORS | `cors` | hand-rolled |
| Logging | `pino` + `pino-http` | `@file_put_contents` |
| Env | `dotenv` | `config.php` defines |
| Compression | `compression` | n/a |

⚠️ **`sharp` vs GD:** compositing images via SVG overlays or pixel operations. Reimplementing the 900×500 pass layout is the **single largest piece of original work** in the migration (the PHP is 147 lines of imperative drawing). Budget real time for it, and consider using an **SVG template rendered to JPEG** — closer to the original intent and far easier to maintain than manual pixel math.

### 16.4 Environment validation

```js
// src/config/env.js
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('production'),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  PARTICIPANT_PREFIX: z.string().min(1).default('MIWC2026'),

## 17. API MIGRATION MAP

Complete endpoint-by-endpoint map. **"Used by React"** was determined by grepping every `fetch()` in `src/` against every route in `backend/api/index.php`.

| # | OLD PHP ENDPOINT | NEW NODE ENDPOINT | REACT COMPONENT USING IT | DB TABLES | Used by React? | Priority |
|---|---|---|---|---|---|---|
| 1 | `GET /api/` | `GET /` | none (curl/ops) | — | ❌ | P2 |
| 2 | `POST /api/register` | `POST /api/register` | `Register.tsx` L90 | `participants` | ✅ | **P0** |
| 3 | `GET /api/verify/:id` | `GET /api/verify/:id` | `Admin.tsx` L226 | `participants` | ✅ | **P0** |
| 4 | `GET /api/sponsors` | `GET /api/sponsors` | `Home.tsx` L103 | `sponsors` | ✅ | **P0** |
| 5 | `GET /api/download-pass/:filename` | `GET /api/download-pass/:filename` | `Register.tsx` L114 (via `pass_url`) | — (Storage) | ✅ | **P0** |
| 6 | `POST /api/admin/login` | ❌ **Supabase Auth** `signInWithPassword` | `Admin.tsx` L121 | `auth.users`, `admins` | ✅ | **P0** |
| 7 | `GET /api/admin/dashboard` | `GET /api/admin/dashboard` | `Admin.tsx` L69 | `participants`, `sponsors` | ✅ | **P0** |
| 8 | `GET /api/admin/participants` | `GET /api/admin/participants` | `Admin.tsx` L85 | `participants` | ✅ | **P0** |
| 9 | `GET /api/admin/sponsors` | `GET /api/admin/sponsors` | `Admin.tsx` L100 | `sponsors` | ✅ | **P0** |
| 10 | `POST /api/admin/sponsors` | `POST /api/admin/sponsors` | `Admin.tsx` L165 | `sponsors` | ✅ | **P0** |
| 11 | `GET /api/admin/export/participants` | same | `Admin.tsx` L204 | `participants` | ✅ | **P0** |
| 12 | `GET /api/admin/export/sponsors` | same | `Admin.tsx` L204 | `sponsors` | ✅ | **P0** |
| 13 | `GET /api/admin/participants/:id` | same | none | `participants` | ❌ | P1 |
| 14 | `PUT /api/admin/participants/:id` | same | none | `participants` | ❌ | P1 |
| 15 | `DELETE /api/admin/participants/:id` | same | none | `participants` + files | ❌ | P1 |
| 16 | `POST /api/admin/participants/:id/regenerate-pass` | same | none (⭐ needed by the Phase 11 script) | `participants` + Storage | ❌ | **P1** |
| 17 | `POST /api/admin/participants/bulk-delete` | same | none | `participants` + files | ❌ | P1 |
| 18 | `GET /api/admin/stats` | same | none (dashboard covers it) | `participants` | ❌ | P2 |
| 19 | `PUT /api/admin/sponsors/:id` | same | none | `sponsors` | ❌ | P2 |
| 20 | `DELETE /api/admin/sponsors/:id` | same | none | `sponsors` + file | ❌ | P2 |
| 21 | `GET /api/gallery` | same | none | `gallery` | ❌ | P2 |
| 22 | `GET /api/admin/gallery` | same | none | `gallery` | ❌ | P2 |
| 23 | `POST /api/admin/gallery` | same | none | `gallery` + Storage | ❌ | P2 |
| 24 | `PUT /api/admin/gallery/:id` | same | none | `gallery` | ❌ | P2 |
| 25 | `DELETE /api/admin/gallery/:id` | same | none | `gallery` + file | ❌ | P2 |
| 26 | `GET /api/event` | same | none | `event_settings` | ❌ | P2 |
| 27 | `GET /api/admin/event` | same | none | `event_settings` | ❌ | P2 |
| 28 | `PUT /api/admin/event` | same | none | `event_settings` + Storage | ❌ | P2 |
| 29 | `POST /api/contact` | same | none (footer uses `mailto:`) | `contacts` | ❌ | P2 |
| 30 | `GET /api/admin/contacts` | same | none | `contacts` | ❌ | P2 |
| 31 | `PUT /api/admin/contacts/:id` | same | none | `contacts` | ❌ | P2 |
| 32 | `DELETE /api/admin/contacts/:id` | same | none | `contacts` | ❌ | P2 |
| 33 | `GET /api/admin/export/contacts` | same | ⚠️ no button, but `exportCsv('contacts')` is type-supported (`Admin.tsx` L201) | `contacts` | ⚠️ Partial | P2 |
| 34 | `POST /api/admin/email/send` | same **(rewritten async)** | none | `participants`, `email_log` | ❌ | P1 |

### Notes on specific rows

**#6 — admin login.** The React `handleLogin()` must be rewritten to call Supabase's `signInWithPassword` and store the Supabase access token in `localStorage['admin_token']` (keeping the same key minimises the diff). Alternatively, keep a thin `POST /api/admin/login` shim that internally calls Supabase — this preserves `Admin.tsx` almost unchanged. **The shim is the lower-risk option** and is worth considering.

**#35 — `verify.php` is the hard problem.** Every QR code and every emailed pass links to `https://api.whitehallpavilionmotel.com/verify.php?id=…`. Three options:

| Option | Implementation |
|---|---|
| **A** ⭐ | Add a React route `/verify?id=…` on Netlify that calls `GET /api/verify/:id` and renders the page. **New QR codes point here.** The backend is then out of the QR path permanently. |
| **B** | Add a Node route `GET /verify.php` that renders the same HTML server-side. Closest to current behaviour; keeps the QR pointing at the backend. |
| **C** | Keep the old cPanel subdomain reverse-proxied to Render. Zero participant impact; keeps a PHP-era dependency alive. |

⚠️ Whichever you choose, `GET /api/verify/:id` should **accept a bare ID or a full URL** and extract `?id=`.

### Response-shape contracts the React code depends on

These must be preserved exactly or the frontend breaks:

| Endpoint | What the React code reads | Line |
|---|---|---|
| `GET /api/admin/dashboard` | `json.data?.stats ?? json.data` | `Admin.tsx` L74 |
| `GET /api/admin/participants` | `json.data?.data ?? json.data ?? []` — **double-wrapped** because `paginate()` returns `{data, total, page, per_page, last_page}` | `Admin.tsx` L90 |
| `GET /api/admin/sponsors` | `json.data ?? []` | `Admin.tsx` L105 |
| `GET /api/sponsors` | `Array.isArray(json.data)` then `.map(...)` | `Home.tsx` L106 |
| `POST /api/register` | `json.data` → `{ participant_id, pass_url, verify_url }`; on error `json.errors` / `json.message` | `Register.tsx` L94–100 |
| `GET /api/verify/:id` | `json.data` → `{ full_name, email, phone, status }`; error via `json.message` | `Admin.tsx` L228–229 |
| `POST /api/admin/login` | `json.data?.token ?? json.token` | `Admin.tsx` L134 |
| All endpoints | `!res.ok` → read `json.message` | throughout |


## 18. SUPABASE SETUP REQUIREMENTS

Everything below is derived from what the application actually uses. **Nothing extra is recommended** — no Realtime, no Edge Functions, no Vector, no Cron unless a specific need arises.

### 18.1 Tables (6 domain tables + 1 auth profile)

| Table | Source | Notes |
|---|---|---|
| `public.admins` | `admins` + Supabase Auth | New auth-backed profile (§14.2). `id uuid` references `auth.users(id)`. |
| `public.participants` | `participants` | Central table (§14.3) |
| `public.event_settings` | `event_settings` | Singleton (§14.4) |
| `public.sponsors` | `sponsors` | §14.5 |
| `public.gallery` | `gallery` | §14.6 — unused by the frontend; migrate or drop |
| `public.contacts` | `contacts` | §14.7 |
| `public.email_log` | `email_log` | §14.8 |

**No new tables are required.** Do not add `users`, `payments`, `tickets`, or `check_ins` unless the product owner explicitly asks.

### 18.2 Relationships (indexes, constraints, FKs)

⚠️ **The honest answer: add almost no foreign keys.** The existing schema has **zero** FKs, and there is no genuine referential relationship in the data model (§4). Inventing FKs would be modelling a system that does not exist.

**Indexes** (all mirror existing MySQL indexes):

| Table | Index | Why |
|---|---|---|
| `participants` | `UNIQUE (email)` | ⚠️ **The only new constraint.** Dedupe first (§15.2 Q6). |
| `participants` | `(phone)` | mirrors `idx_phone` |
| `participants` | `(status)` | mirrors `idx_status`; used by `EmailController` filtering and dashboard stats |
| `participants` | `(registered_at DESC)` | mirrors `idx_date`; serves the default `ORDER BY` |
| `participants` | `UNIQUE (participant_id)` | already UNIQUE in MySQL |
| `participants` | `UNIQUE (participant_seq)` | new; backs race-free ID generation |
| `sponsors` | `(status)`, `(priority DESC, id)` | mirrors existing indexes; the composite index also serves the required ordering |
| `gallery` | `(status)`, `(sort_order)` | mirrors existing indexes |
| `contacts` | `(status)`, `(email)` | mirrors existing indexes |
| `email_log` | `(status)` | mirrors existing index |
| `admins` | `UNIQUE (email)`, `UNIQUE (legacy_id)` | traceability |

**The only FK:**
```sql
alter table public.admins
  add constraint admins_user_fkey
  foreign key (id) references auth.users(id) on delete cascade;
```

**Recommended CHECK constraints** (replacing MySQL ENUMs):
```sql
alter table participants  add constraint participants_status_chk
  check (status in ('registered','verified','cancelled'));
alter table sponsors      add constraint sponsors_status_chk  check (status in ('active','inactive'));

### 18.3 Authentication

| Setting | Value / decision |
|---|---|
| Provider | **Email/Password only** |
| Email confirmations | **Disable** for admin accounts (set `email_confirmed_at` directly), or create users via the Admin API |
| Signup | **Self-signup must be disabled.** Admins are created by invitation only. |
| Admin allowlist | `ADMIN_EMAILS` env var on Render; `requireAdmin.js` checks membership ⭐ — the control PHP never had |
| JWT expiry | Default 1 h. ⚠️ The PHP token was 24 h — shorter is an improvement, but the frontend must handle expiry (§2, 401 interceptor) |
| Refresh tokens | ⭐ **Enable** — the current `localStorage` token has no refresh path at all |
| Redirect URLs | `https://<netlify-site>/admin` if using a Supabase-hosted login |
| Password requirements | Supabase defaults are fine. The current app has none beyond `min 8`. |

⚠️ **If you keep a `POST /api/admin/login` shim** (§17 row #6), Supabase still issues the tokens — the shim just forwards them, which keeps `Admin.tsx` nearly unchanged.

### 18.4 Storage buckets

| Bucket | Public? | Size limit | MIME allowlist | Used for |
|---|---|---|---|---|
| `participant-photos` | ❌ **Private** | 5 MB | `image/jpeg, image/png, image/webp` | Passport photos |
| `passes` | ✅ Public | 10 MB | `image/jpeg` | Attendee pass JPEGs |
| `qr-codes` | ✅ Public | 2 MB | `image/png` | QR PNGs |
| `sponsor-logos` | ✅ Public | 5 MB | `image/jpeg, image/png, image/webp, image/svg+xml` | Sponsor logos |
| `event-images` | ✅ Public | 10 MB | `image/jpeg, image/png, image/webp, image/svg+xml` | Gallery + banner |

⚠️ **The private participant-photos bucket is the one real behavioural change.** The current system serves every participant photo publicly at a guessable URL. Moving to a private bucket means:
- `GET /api/verify/:id` must return a **signed URL** (short TTL) instead of a permanent URL.
- ⚠️ The verification page displays the participant's photo — the marshal's device needs a working signed URL. **Test this flow end-to-end.**
- The admin participant table may need thumbnails; decide whether to show photos there at all.

⚠️ **Set per-bucket size limits.** The 5 MB app limit must be enforced in **both** multer (Node) and the bucket policy.

### 18.5 RLS policies

**Reality check:** the Node backend connects with the **service-role key, which bypasses RLS entirely.** So RLS is not what protects your data today — network isolation and the service-role key are.

RLS is still worth enabling as a **safety net**, so that if the anon key is ever exposed in the frontend, the database is not wide open.

```sql
-- 1. Enable RLS on every table
alter table public.admins         enable row level security;
alter table public.participants   enable row level security;
alter table public.sponsors       enable row level security;
alter table public.gallery        enable row level security;
alter table public.contacts       enable row level security;
alter table public.email_log      enable row level security;
alter table public.event_settings enable row level security;

-- 2. Only active sponsors readable without auth (defence-in-depth;
--    the Node service role serves Home.tsx regardless)
create policy "public sponsors are viewable"
  on public.sponsors for select
  using (status = 'active');

-- 3. Admins may read their own profile
create policy "admins read own profile"
  on public.admins for select
  using (auth.uid() = id);
```

⚠️ **Everything else is default-deny.** With RLS enabled and no permissive policy, anon and authenticated clients see zero rows. The service role still bypasses RLS, so the backend is unaffected.

### 18.6 Database extensions

| Extension | Needed? | Reason |
|---|---|---|
| `pgcrypto` (`gen_random_uuid`) | ✅ **Yes** | `public.admins.id` default. Usually already enabled in Supabase. |
| `pg_trgm` | ⭐ **Recommended** | Speeds up the admin `search` filter (`LIKE '%term%'` across 4 columns). Cheap insurance. |
| `citext` | ⭐ Optional | Case-insensitive email comparison. ⚠️ Only if you dedupe case-insensitively — MySQL's default collation already was, so this **preserves existing behaviour**. |
| `uuid-ossp` | ❌ No | `gen_random_uuid()` is built in. |
| `postgis`, vector, etc. | ❌ No | Not used. |

### 18.7 Functions / triggers

| Object | Needed? | Purpose |
|---|---|---|
| `next_participant_id(prefix text)` | ✅ **Yes** | Race-free `MIWC2026-000123` generation (§14.3) |
| `updated_at` trigger | ⭐ Optional | MySQL's `ON UPDATE CURRENT_TIMESTAMP` has no Postgres equivalent. **Recommendation: set it in the application layer** — explicit is easier to debug. |
| Audit triggers | ❌ No | Not present today. |

## 19. RENDER SETUP REQUIREMENTS

### 19.1 Service configuration

| Setting | Value | Notes |
|---|---|---|
| **Service type** | Web Service | Not a Static Site |
| **Runtime / Node version** | **Node 20 or 22** (LTS) | Set explicitly via `.nvmrc` or `NODE_VERSION`. ⚠️ Do not rely on Render's default. |
| **Build command** | `npm ci && npm run build` *(only if you compile TS)* or simply `npm ci` if you run plain JS | If `src/` is TypeScript, add `tsc` to the build. The layout in §16.1 shows `.js`; either is fine. |
| **Start command** | `npm start` → `node src/server.js` | |
| **Root directory** | `server` (if the backend lives in `server/`) | ⚠️ Must match §16.1's layout |
| **Health check path** | `/` or `/health` | See §19.3 |
| **Instance type** | Starter ($7/mo) minimum | ⚠️ **Free tier sleeps after 15 min of inactivity** — see §19.5 |

### 19.2 Port handling

⚠️ **Render injects `PORT`. Do not hardcode 3000 and do not set `PORT` yourself.**

```js
// src/server.js
import app from './app.js';
const port = process.env.PORT || 3000;   // fallback for local dev only
app.listen(port, () => logger.info({ port }, 'API listening'));
```

⚠️ **Must listen on `0.0.0.0`, not `localhost`** — Render's proxy connects externally. `app.listen(port)` (no host) binds to all interfaces by default in Node, which is correct. Do not pass `'127.0.0.1'`.

### 19.3 Health-check endpoint

```js
// src/app.js
import pg from 'pg';

app.get('/health', async (_req, res) => {
  try {
    await pg.query('select 1');            // or pool.query
    res.json({ status: 'ok', api: 'Mowe Fitness Walk API' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});
```

⚠️ This **must return the existing envelope shape** `{"status":"ok", ...}` to match `GET /api/` in the old backend (§17 row #1), so any existing monitoring keeps working.

### 19.4 CORS configuration

Mirror the PHP allowlist exactly (§12.3), but driven by env vars:

```js
// src/middleware/cors.js
import cors from 'cors';

const allowed = new Set(
  [env.FRONTEND_URL, env.APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
}));
```

⚠️ **Improvements over the PHP version:**
- No `Access-Control-Allow-Credentials: true` combined with a wildcard — a latent misconfiguration in the original.
- Add the Netlify **deploy-preview** domains if you want to test PR previews against production data. ⚠️ Consider **not** doing this: previews would write to the live database.
- Never use `origin: '*'` with credentials.

### 19.5 ⚠️ Cold starts — a real risk for this application

**This matters more than usual here because of the QR scanner.**

Render's free tier spins the instance down after ~15 minutes of inactivity. A cold start can take **30–60 seconds** to wake. The consequences:

| Scenario | Impact |

## 20. NETLIFY CHANGES

The React app stays on Netlify. **Most of the current Netlify config is correct and needs no change.**

### 20.1 What stays exactly the same

| File | Status |
|---|---|
| `netlify.toml` | ✅ Keep as-is — `command = "npm run build"`, `publish = "dist"`, SPA catch-all |
| `public/_redirects` | ✅ Keep — duplicates `netlify.toml` harmlessly |
| `package.json` build scripts | ✅ Keep |
| `vite.config.ts` | ✅ Keep |
| `index.html` | ⚠️ Only the meta description needs editing (§20.5) |
| All of `src/` | ⚠️ Only the API-URL changes (§20.3) |

### 20.2 Environment variables

| Variable | Action |
|---|---|
| `VITE_API_URL` | 🔴 **UPDATE** from `https://api.whitehallpavilionmotel.com/api` to the Render URL, e.g. `https://<service>.onrender.com/api` |
| Any `VITE_SUPABASE_*` key | ❌ **DO NOT ADD.** The frontend must not talk to Supabase directly. |

⚠️ **Two gotchas:**
1. **Nothing currently reads `VITE_API_URL`** (§2). Changing the Netlify variable changes **nothing** until you create `src/lib/api.ts` and update the 3 pages. This is the most commonly missed step.
2. **Anything `VITE_`-prefixed is compiled into the public JS bundle.** Never put a Supabase service-role key or any secret here.

### 20.3 Frontend code changes required

| # | Change | File | Risk |
|---|---|---|---|
| 1 | ⭐ **Create `src/lib/api.ts`** exporting `API_URL` from `import.meta.env.VITE_API_URL` plus a shared `apiFetch()` wrapper | new | Low |
| 2 | Remove `const API_URL = 'https://api.whitehallpavilionmotel.com/api'` | `Home.tsx` L81, `Register.tsx` L12, `Admin.tsx` L3 | Low |
| 3 | Import `API_URL` from `@/lib/api` instead | same 3 files | Low |
| 4 | Add a **401 interceptor** → clear `localStorage`, return to login | `lib/api.ts` | Low — fixes a real bug |
| 5 | Remove pre-filled admin credentials | `Admin.tsx` L35–36 | Low — security |
| 6 | Fix QR payload parsing (`?id=` extraction) | `Admin.tsx` L277/L226 | Low — fixes a real bug |
| 7 | Align server `errors` keys with form state keys | `Register.tsx` L17 + backend | Low |
| 8 | Optional: add search/filter/pagination to the participants table | `Admin.tsx` | Medium — new UI |
| 9 | Optional: add `/verify` route if choosing §17 Option A | new page + `App.tsx` | Medium — new UI |

⚠️ **Keep changes 1–7 minimal and separate from any UI redesign.** Migrating the backend and redesigning the frontend simultaneously makes failures hard to attribute.

### 20.4 CORS

No Netlify-side change is required — CORS is entirely a Render concern (§19.4). The one thing to verify:

⚠️ `FRONTEND_URL` on Render must **exactly** equal the Netlify origin, including scheme and no trailing slash: `https://mowefitnesswalk.netlify.app`. A mismatch fails silently.

⚠️ If you later add a **custom domain** or use **Netlify deploy previews**, update `FRONTEND_URL` accordingly.

### 20.5 Build settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | ⚠️ **Must be ≥ the version required by Vite 8.** Vite 8 is very new — verify the Netlify Node version is compatible; otherwise set `NODE_VERSION` explicitly. |
| Environment | Set `VITE_API_URL` per branch or production |

⚠️ **Vite 8 compatibility is worth verifying before you rely on the current pipeline.** If the current Netlify build works, capture its Node version and pin the same value.

### 20.6 Redirects

`netlify.toml` and `public/_redirects` both contain a `/* → /index.html 200` catch-all, required for the wouter client-side routes. ✅ **No change.**

⚠️ **Do not add a Netlify proxy/redirect for `/api/*`.** Proxying would hide the Render URL from the browser and complicate CORS. The frontend should call Render directly.

### 20.7 Netlify-side checklist

- [ ] `VITE_API_URL` updated to the Render URL
- [ ] `src/lib/api.ts` created and used by all 3 pages
- [ ] No hardcoded API URL remains (`grep -rn "whitehallpavilionmotel" src/`)
- [ ] No secret present in any `VITE_` variable
- [ ] Node version pinned and confirmed compatible with Vite 8
- [ ] Build succeeds: `npm run build`
- [ ] Typecheck clean: `npm run typecheck`

## 21. RISKS AND BREAKING CHANGES

Ranked by technical severity only.

### CRITICAL

| # | Risk | Why it is critical | Mitigation |
|---|---|---|---|
| 1 | 🔑 **Live secrets in git history** (DB password, JWT secret, SMTP password) | Assumed compromised. Anyone with repo access owns the database and can send email as you. | **Rotate all three now** (§11.4). Purge from history if the repo is shared. |
| 2 | 🔑 **Known default admin credentials** published in 3 places + pre-filled in the login form | Full admin access. `ON DUPLICATE KEY UPDATE` in the seed SQL silently resets the password if re-run. | Change the password; delete the seed SQL; remove the pre-fill (`Admin.tsx` L35–36). |
| 3 | 🗑️ **Live participant photos and passes exist only on the cPanel host** | If the host is reset or migrated without a copy, **all passport photos and every issued pass are permanently lost.** | **Back up `backend/uploads/` before anything else** (Phase 0, Step 2). Verify the backup opens. |
| 4 | 📱 **Every already-issued QR code and pass points at the PHP domain** | When PHP is decommissioned, participants scanning at the event get a 404. Visible, on-the-day failure. | Decide §9.5 Option A/B/C **before** the event; run a bulk regeneration (Phase 11). |
| 5 | 🔁 **Not advancing ID sequences after import** | The first new registration collides → registration fails entirely. | `setval()` both sequences immediately after import (§14.3, §14.9 #1). |

### HIGH

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 6 | 🚫 **No rate limiting anywhere today** | Admin login brute-forceable; `/register` open to spam and resource exhaustion. | `express-rate-limit` is **mandatory** in the new backend (§6.9). |
| 7 | 🔑 **No role enforcement** — `role` is decorative | Any admin can delete every participant. | Add `requireAdmin.js` (§16.1) + `ADMIN_EMAILS` allowlist. |
| 8 | 📧 **PHP `mail()` does not exist on Render** | All confirmation emails fail **silently** (`@`-suppressed, return value ignored). Participants never receive their pass. | Use Resend/Brevo/Nodemailer; **log failures**; surface a warning in the response (§10.3). |
| 9 | 🕐 **Render free tier sleeps** | Cold starts break the QR scanner at the event (§19.5). | Use a non-sleeping instance type. |
| 10 | 💉 **Duplicate `participants.email` may exist** | Adding the UNIQUE index fails → the import aborts partway. | Run the dedupe query **first** (§15.2 Q6) and record the decisions. |
| 11 | 🧩 **Response-shape drift** | One changed field silently breaks React (e.g. the double-wrapped `participants` payload, `json.data?.stats`). | Contract tests asserting the exact shapes in §17. |
| 12 | 🔒 **`.htaccess` upload protection disappears on Render** | If any local-disk upload fallback is kept, uploaded files could become executable. | All uploads go to Supabase Storage. **Never serve an uploads directory from the app root.** |
| 13 | 🕑 **Token expiry behaviour changes** | PHP tokens lasted 24 h with no refresh. Supabase defaults to 1 h. Without a 401 handler the admin gets stranded (§2). | Add the 401 interceptor **and** enable refresh tokens. |

### MEDIUM

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 14 | 🕐 **Timestamp timezone shift** | Loading naive `DATETIME` values as UTC shifts every registration by one hour. | Convert via `AT TIME ZONE 'Africa/Lagos'` (§14.1). Verify against known rows. |
| 15 | 🔤 **HTML-escaped data in `full_name` / contact text** | Participants display `O&#039;Brien`; double-escaping in the verification page. | `html.unescape()` during migration; stop escaping on input in the new backend. |
| 16 | 🖼️ **Private photo bucket changes URL behaviour** | The verification page shows a photo; a plain URL will now 404. Signed URLs needed. | Test the marshal flow end-to-end before the event (§18.4). |
| 17 | 🎨 **Pass regeneration is a rewrite, not a port** | `PassGenerator.php` is 147 lines of GD drawing with hardcoded Linux font paths and a missing logo file. | Budget real time; prefer an SVG template rendered via `sharp` (§16.3). Compare output visually. |
| 18 | 📷 **QR scanner unsupported on Safari/Firefox** | `BarcodeDetector` is Chromium-only. Marshals on iPhones cannot scan. | Add a `jsQR` fallback, or brief marshals to type the ID manually. **Decide before the event.** |
| 19 | 🔁 **`MAX(id)+1` ID generation** | Collisions under concurrency; ID reuse after deletes. | Postgres sequence (§14.3). |
| 20 | 📤 **Synchronous bulk email** | Times out or exhausts quota with many participants. | Make async; never call it inline (§6.9 item 6). |
| 21 | 📉 **Participants beyond the first 20 are invisible** | The admin UI has no pagination or search, and the API caps at 20. | Add the UI controls (§20.3 item 8) or raise the page size. |
| 22 | 🚫 **`PUT /api/admin/participants/:id` has no UI** | `status` can never become `'verified'`, so the Verified counter is permanently zero. | Add a status control, or accept it as a known limitation. |
| 23 | 🔗 **CORS exact-match failure** | A mismatched `FRONTEND_URL` fails silently and looks like a network error. | Verify the exact origin string, including scheme and no trailing slash. |

- [ ] SPA routes work on hard refresh (`/admin`, `/register`)

### LOW

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 24 | 🕸️ **Third-party QR dependency removed** | Actually an improvement — local generation removes a runtime external dependency. | None. |
| 25 | 🗑️ **Orphaned upload files** | Wasted storage; possible confusion. | Reconcile file count vs row count during migration (§9.6). |
| 26 | 🧹 **No security headers today** | No CSP, HSTS, X-Frame-Options. | `helmet()` on the Node server. |
| 27 | 🧩 **Dead frontend dependencies** | `@tanstack/react-query`, `zod`, `react-hook-form`, `recharts`, `sonner`, ~50 shadcn files unused. | Harmless. Clean up **after** the migration, as a separate change. |
| 28 | 📄 **Committed `dist/`** | Stale build output in version control. | Remove from git; Netlify builds fresh. |
| 29 | 🏨 **API hosted on a hotel's domain** | `api.whitehallpavilionmotel.com` — if that relationship ends, hosting and email break. | The migration removes this dependency. |
| 30 | 📋 **`README.md` inaccuracies** | Documents a non-existent `admin/` SPA and non-functional SMTP config. | Rewrite as part of the migration. |
| 31 | 🧪 **No tests anywhere** | No safety net for the migration. | Write contract tests for the response shapes (§17) before cutover. |

---

- [ ] `index.html` meta description updated (it still says "built on Replit")

---


## 22. MIGRATION CHECKLIST

A practical end-to-end checklist. Phases follow §13.

### BEFORE MIGRATION

- [ ] 🔴 Rotate the MySQL password
- [ ] 🔴 Rotate the JWT secret
- [ ] 🔴 Rotate the SMTP password
- [ ] 🔴 Change the admin password (currently `Admin@2026`)
- [ ] 🔴 **Full `mysqldump` backup of `whitehal_mixc`** — verify it restores
- [ ] 🔴 **Full copy of `backend/uploads/`** — verify files open
- [ ] Record row counts for all 7 tables
- [ ] Run the duplicate-email query and record the results
- [ ] Count rows in `admins` (determines the §15 workload)
- [ ] Count files in `uploads/*` vs rows in the DB (find orphans)
- [ ] Resolve every unknown in §12.5 (PHP version, MySQL version, `install/` presence, SSL status)
- [ ] Confirm actual peak traffic/concurrency
- [ ] Create a migration branch; freeze PHP feature work
- [ ] Decide §9.5: how legacy QR codes will be handled (A / B / C)
- [ ] Decide §9.4: are participant photos private or public?
- [ ] Decide whether to migrate the unused `gallery` table
- [ ] Decide whether `registration_open` will be enforced

### DATABASE

- [ ] Create the Supabase project in a region near Render
- [ ] Apply the DDL from §14 / §18.2 as versioned migrations
- [ ] Verify all 6 tables + `admins` profile created
- [ ] `UNIQUE (email)` on `participants` — **only after dedupe**
- [ ] All CHECK constraints applied
- [ ] `participant_seq` sequence created
- [ ] `event_settings` row seeded with `id = 1`
- [ ] Export all 7 tables to CSV/JSON
- [ ] Transform: HTML-decode text fields
- [ ] Transform: strip host prefix from `*_path` → storage keys
- [ ] Transform: `TINYINT(1)` → boolean
- [ ] Transform: `DATETIME` → `timestamptz` at `Africa/Lagos`
- [ ] Dedupe `participants.email`; document every decision
- [ ] Import in FK-safe order
- [ ] **`setval('participants_id_seq', max(id))`**
- [ ] **`setval('participant_seq', max(participant_seq))`**
- [ ] Verify row counts match the pre-migration baseline
- [ ] Spot-check 10 random participants against the MySQL source

### BACKEND

- [ ] Scaffold `server/` per §16.1
- [ ] `src/config/env.js` with zod validation (§16.4)
- [ ] `pg` pool with SSL enabled for Supabase
- [ ] `utils/response.js` reproducing the exact envelope
- [ ] `middleware/cors.js` (§19.4)
- [ ] **`middleware/rateLimit.js` — mandatory** (§6.9)
- [ ] `middleware/errorHandler.js` — generic messages in production
- [ ] `middleware/upload.js` — multer + MIME allowlist + 5 MB cap
- [ ] `middleware/validate.js` — zod schemas mirroring `Validator.php`
- [ ] `middleware/auth.js` — Supabase token verification
- [ ] **`middleware/requireAdmin.js` — role/allowlist check** (§6.5)
- [ ] `services/storage.service.js` — Supabase Storage wrapper

### AUTHENTICATION

- [ ] Supabase Auth → Email provider configured
- [ ] **Self-signup disabled** (admins are created by invitation only)
- [ ] Admin user(s) created with **new, strong, unique passwords**
- [ ] `public.admins` rows created and linked to `auth.users`
- [ ] `role` stored in `raw_app_meta_data` (not user_metadata)
- [ ] `ADMIN_EMAILS` allowlist set on Render
- [ ] Refresh tokens enabled
- [ ] Redirect URLs configured
- [ ] Old `admins.password` hashes **not** imported
- [ ] `admin_seed.sql` and the `schema.sql` seed block **not** carried over
- [ ] Admin can log in and reach the dashboard end-to-end
- [ ] A non-admin token is rejected by every admin route
- [ ] Token expiry handled gracefully (401 → login screen)

### PAYMENTS

- [ ] ✅ **Nothing to do.** No payment system exists in this application (§7).
- [ ] Confirm with the product owner that registration remains free.
- [ ] If a fee is now required, treat it as a **greenfield feature**, not part of this migration.

### FRONTEND

- [ ] Create `src/lib/api.ts` with `API_URL` from `import.meta.env.VITE_API_URL`
- [ ] Remove the hardcoded URL from `Home.tsx` L81
- [ ] Remove the hardcoded URL from `Register.tsx` L12
- [ ] Remove the hardcoded URL from `Admin.tsx` L3
- [ ] Add the 401 interceptor
- [ ] Remove the pre-filled admin credentials (`Admin.tsx` L35–36)
- [ ] Fix the QR scanner `?id=` extraction (`Admin.tsx` L277/L226)
- [ ] Align server `errors` keys with form state keys
- [ ] `grep -rn "whitehallpavilionmotel" src/` returns nothing
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` clean
- [ ] `index.html` meta description updated
- [ ] Optional: participant search/filter/pagination
- [ ] Optional: `/verify` route (if §17 Option A)
- [ ] Optional: contacts CSV button

### TESTING

- [ ] Unit tests: validators, ID generation, QR payload parsing
- [ ] Integration tests: every endpoint in §17
- [ ] **Contract tests** on the exact response shapes in §17
- [ ] Auth tests: 401 unauthenticated, 401 expired, 200 valid, 401 wrong password
- [ ] Upload tests: valid image, oversized, fake image, `.php` renamed to `.jpg`
- [ ] Rate-limit tests on `/register` and `/admin/login`
- [ ] **Email test: a real registration email arrives with the pass attached**
- [ ] Email-failure test: confirm a failed send is logged, not silent
- [ ] QR scan test in the admin UI
- [ ] CSV export opens correctly in Excel (UTF-8 BOM)
- [ ] Pass image visually compared against a PHP-generated pass
- [ ] Duplicate-registration test (409 path)
- [ ] Safari/iOS test of the QR scanner (or confirm the manual-entry workaround)
- [ ] Load test `GET /verify/:id`
- [ ] End-to-end: register 3 test participants → visible in admin + export

### DEPLOYMENT

- [ ] Create the Render Web Service
- [ ] Node version pinned (20/22 LTS)
- [ ] Root directory set to `server`
- [ ] Build and start commands set
- [ ] Health-check path set to `/health`
- [ ] **Non-sleeping instance type selected** (§19.5)
- [ ] All env vars set in the Render dashboard (§19.6)
- [ ] `APP_URL`, `QR_BASE_URL`, `FRONTEND_URL` correct
- [ ] Migrations applied **before** the new backend deploys
- [ ] Render deploys successfully and `/health` returns `{status:'ok'}`

## 23. FINAL SUMMARY

### Current Architecture

A **free-registration event portal** for the Mowe-Ibafo X Community Fitness Walk 2026, with **no payment step of any kind**.

- **Frontend:** React 19 + TypeScript + Vite 8 SPA on Netlify. Three routes (`/`, `/register`, `/admin`) using `wouter`. All data fetching is **raw `fetch()` inline in page components**, with the API URL **hardcoded in three files** and `.env` effectively unused. `react-hook-form`, `zod`, and `react-query` are installed but never used.
- **Backend:** A hand-rolled procedural PHP 8 API (one 217-line `if`-chain router) on cPanel at `api.whitehallpavilionmotel.com`, with a hand-rolled HS256 JWT, a PDO/MySQL layer, PHP GD for attendee passes, QR codes downloaded from `api.qrserver.com`, and email via raw `mail()`.
- **Database:** MySQL on cPanel — 6 domain tables plus `email_log`, **zero foreign keys**, ENUM status columns, absolute filesystem paths stored in the DB.
- **Files:** 100% local disk in the web root, served directly by Apache.
- **Auth:** One account class — `admins`. bcrypt cost 12. Participants have **no accounts and cannot log in**. The JWT is stored in `localStorage` with no refresh and no revocation, and the `role` column is **never enforced**.

### Target Architecture

```
React 19 + Vite SPA  ──▶  Netlify (static CDN)
        │  fetch() + CORS + Supabase JWT
        ▼
Node.js 20/22 + Express  ──▶  Render (Web Service, non-sleeping)
        │
        ├──▶  Supabase Auth        (admin sign-in, JWT issuance)
        ├──▶  Supabase PostgreSQL (6 tables + admins profile)
        └──▶  Supabase Storage     (5 buckets; photos private, passes/QR public)
        │
        └──▶  Resend / Brevo       (transactional email with the pass attached)
```

### What Can Be Reused

| Area | Reusable as-is |
|---|---|
| **All React pages and components** | `Home.tsx`, `Register.tsx`, `Admin.tsx`, `Navbar`, `Footer`, `FloatingOrbs`, `not-found` — keep verbatim except the API-URL swap |
| **`src/index.css`** | Complete design system; no change needed |
| **`netlify.toml` + `public/_redirects`** | Already correct |
| **Business logic** | ID format `MIWC2026-000001`; pagination shape `{data,total,page,per_page,last_page}`; `ORDER BY priority DESC, id ASC` for sponsors; the `{success,message,data,errors}` envelope; all HTTP status codes; CSV column orders and the UTF-8 BOM; pass layout (900×500, `#0B0B0B`/`#22C55E`) |
| **Email templates** | Both HTML designs are good — copy verbatim, extract to files |
| **Database data** | All 7 tables' rows migrate with the transformations in §14 |
| **Upload/media pipeline concept** | 5 storage categories already map cleanly to 5 buckets |
| **QR + pass outputs** | Regenerable; do not migrate the stale images |

### What Must Be Rewritten

| PHP artefact | Becomes | Notes |
|---|---|---|
| `api/index.php` (router, CORS, error handler) | Express routers + middleware | §16.1 |

### What Can Be Migrated

| Data | Migration approach | Caveat |
|---|---|---|
| **Admins** (≈1) | Recreate in Supabase Auth + `public.admins` | 🔑 **New passwords.** Do not import hashes — the current one is publicly known. |
| **Participants** (all rows) | Direct import with transformations | ⚠️ Decode HTML entities, convert timestamps from `Africa/Lagos`, convert `*_path` to storage keys, dedupe emails |
| **Participant photos** | Upload to a Supabase bucket | ⚠️ **Only copy in existence** — back up first |
| **Sponsors / logos** | Direct import | |
| **Event settings** | Direct import, force `id = 1` | |
| **Contacts** | Direct import, decode HTML | ⚠️ Table is unused by the frontend |
| **Email log** | Direct import | Write-only; no UI either way |
| **Gallery** | Optional | Unused by the frontend — migrate or drop |
| **Attendee passes** | ⭐ **Regenerate, do not migrate** | Existing ones point at the dead PHP domain |
| **QR codes** | ⭐ **Regenerate, do not migrate** | Same reason — the biggest trap in the project |
| **Payments** | ❌ Nothing exists | §7 |

### What Needs Further Investigation

Everything below **could not be determined from the codebase** and must be checked against the live server.

| # | Unknown | How to resolve |
|---|---|---|
| 1 | **How many rows are in `admins`** | phpMyAdmin — determines the entire §15 workload |
| 2 | **Whether duplicate `participants.email` values exist** | `SELECT email, COUNT(*) … HAVING COUNT(*)>1` — blocks the UNIQUE index |
| 3 | **Row counts in all 7 tables** | phpMyAdmin — the migration baseline |
| 4 | **How many files exist in `uploads/`, and orphans** | cPanel File Manager; compare with row counts |
| 5 | **Actual deployed PHP version** | cPanel → Select PHP Version |
| 6 | **Actual MySQL/MariaDB version** | `SELECT VERSION();` |
| 7 | **Whether `install/` still exists on the server** | cPanel File Manager. The `.htaccess` should 403 it, but this is unverified |
| 8 | **Whether the `JWT_SECRET` was ever randomised by the installer** | Compare the live value with the committed one. If identical, the installer never ran |
| 9 | **Whether the admin password was ever changed** | Cannot determine from code |
| 10 | **Whether SSL is active on the `api.` subdomain** | cPanel → SSL/TLS Status |
| 11 | **Real traffic volume and peak concurrency** | Determines the Render instance size and whether cold starts are tolerable |
| 12 | **Whether `logs/errors.log` reveals past failures** | May explain missing emails or QR codes |
| 13 | **Whether the business wants a registration fee** | Product decision — would be a greenfield feature, not a migration |
| 14 | **Whether check-in tracking is required** | It does not exist today; would be a new feature |
| 15 | **Whether participant photos should be private** | Privacy decision with an operational impact (§18.4) |
| 16 | **How legacy QR codes will be handled** | §9.5 A/B/C — needs an owner decision before the event |
| 17 | **Whether the Netlify Node version supports Vite 8** | Check the current build settings |
| 18 | **Whether the SMTP host actually works** | The current code never uses SMTP; `mail()` may be failing silently on cPanel too |

---

## Document Notes

- **Scope:** every PHP file, every React page, the full schema, and all configuration in the repository was read in full. The `.kilo/worktrees/platinum-nannyberry` folder is an **unrelated project** (a TON/NFT app) and was excluded.
- **Method:** findings were established by reading source, not inferred from documentation. Where `backend/README.md` disagrees with the code (the `admin/` SPA, the SMTP instructions, the `uploads/` subfolders), **the code was treated as authoritative** and the discrepancy is flagged.
- **No secret values are reproduced anywhere in this document.**
- **No application files were modified.** The only file created is this document.
- Where this document says something "does not exist", that was verified by exhaustive search, not assumed.

| `models/*.php` (6 PDO classes) | `services/*.js` or `repositories/*.js` | `pg` + parameterized queries |
| `controllers/*.php` (8) | `controllers/*.js` | Preserve response shapes |
| `helpers/JWT.php` + `middleware/AuthMiddleware.php` | Supabase token verification | **Do not rebuild custom JWT** |
| `controllers/AuthController.php` | Supabase Auth | Retire |
| `helpers/PassGenerator.php` (147 lines GD) | `pass.service.js` using `sharp` | ⭐ **Largest single task** |
| `helpers/QRCode.php` (remote fetch) | `qr.service.js` using `qrcode` | Removes an external dependency |
| `helpers/Mailer.php` (`mail()`) | `mailer.service.js` (Resend/Brevo) | Must start logging failures |
| `helpers/Upload.php` (disk) | `storage.service.js` (Supabase Storage) | |
| `helpers/Validator.php` | zod schemas | Fix the escape-on-input bug |
| `helpers/CSV.php` | `csv.service.js` | Keep the BOM |
| `config.php` (defines) | `config/env.js` + `.env` | **Delete, do not port** |
| `install/index.php` | ❌ Nothing | Retire |
| `verify.php` | React `/verify` route or a Node route | §17 row #35 |
| `.htaccess` files | ❌ Nothing | Apache-only |

**New code with no PHP equivalent (deliberate additions):** rate limiting, role enforcement, a 401 interceptor, `qrPayload` parsing, output-side escaping, ID-sequence generation, async bulk email, a health check, and security headers.

- [ ] Netlify: `VITE_API_URL` updated
- [ ] Netlify: build passes
- [ ] CORS verified from the real Netlify origin
- [ ] Custom domain (if any) added to CORS + `APP_URL`

### USER MIGRATION

- [ ] Inventory the `admins` table
- [ ] Create Supabase Auth users with new passwords
- [ ] Create matching `public.admins` rows with `legacy_id`
- [ ] Transfer `name`, `email`, `role`, `created_at`, `last_login`
- [ ] **No password hashes migrated** (documented decision)
- [ ] Verify every admin can log in on the new system
- [ ] Keep the MySQL `admins` table read-only until verified
- [ ] Delete the old admin credentials from the repo

### FINAL CUTOVER

- [ ] Announce a maintenance window
- [ ] Final `mysqldump` + `uploads/` backup
- [ ] Run the production data migration
- [ ] Reconcile row counts one final time
- [ ] Update `VITE_API_URL` → trigger a Netlify rebuild
- [ ] Smoke test: register a real participant
- [ ] Smoke test: pass downloads, QR resolves, email arrives
- [ ] Smoke test: admin login, dashboard, participants, sponsors, CSV, scanner
- [ ] **Keep the PHP backend running read-only for 48–72 hours**
- [ ] Remediate legacy QR codes (§9.5) — **before the event**
- [ ] After the event: retire the cPanel subdomain
- [ ] Delete the PHP files, `backend.zip`, `config.php`
- [ ] Confirm no secrets remain in the repository
- [ ] Remove `dist/` from version control
- [ ] Rewrite `README.md` to describe the new architecture
- [ ] Delete the temporary `.kilo/worktrees/platinum-nannyberry` folder if it is not needed

---

- [ ] `services/qr.service.js` — local QR generation (`qrcode`)
- [ ] `services/pass.service.js` — pass rendering (`sharp`) ⭐ largest task
- [ ] `services/mailer.service.js` — Resend/Brevo + **error logging**
- [ ] `services/participantId.service.js` — sequence-based IDs
- [ ] `services/csv.service.js` — preserve the UTF-8 BOM
- [ ] `utils/qrPayload.js` — accept bare ID **and** full legacy URL
- [ ] `utils/html.js` — escape on output
- [ ] Port all P0 endpoints, then P1 (§4, Phase 4)
- [ ] `GET /health` (§19.3)
- [ ] Bulk email rewritten to be async
- [ ] Removed the `attachment_path` parameter (§10.4)
- [ ] `helmet()` enabled
- [ ] `POST /api/admin/login` shim built, or `Admin.tsx` rewritten for Supabase
- [ ] `.env` in `.gitignore`; `.env.example` with empty placeholders
- [ ] Graceful `SIGTERM` handling

|---|---|
| Marshal opens `/admin` after a lull | Token request hangs; the scanner may time out |
| `GET /api/verify/:id` during scanning | Latency spike mid-scan |
| Registration after a quiet period | First user sees a long delay; may submit twice |

**Mitigations:**
1. ⭐ **Use a paid instance type that does not sleep.** For a one-day event this is cheap and removes the problem entirely.
2. If on the free tier, set the health check to a path that Render pings frequently — ⚠️ note this only helps if Render's health-check interval actually wakes the instance.
3. **Frontend-side:** show a clear "Connecting…" state instead of a silent spinner; add a client-side timeout with a retry on `verify`.

⚠️ **Do not rely on the free tier for the event day.**

### 19.6 Environment variables on Render

Set in **Dashboard → Environment**, never in a committed file. See §11.3 for the full list. Minimum required:

```
NODE_ENV=production
DATABASE_URL=postgresql://…
SUPABASE_URL=https://….supabase.co
SUPABASE_SERVICE_ROLE_KEY=…
APP_URL=https://<render-service>.onrender.com
FRONTEND_URL=https://mowefitnesswalk.netlify.app
PARTICIPANT_PREFIX=MIWC2026
ADMIN_EMAILS=<admin emails, comma separated>
MAX_UPLOAD_SIZE=5242880
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp
APP_TIMEZONE=Africa/Lagos
SMTP_HOST=… / SMTP_PORT=… / SMTP_USER=… / SMTP_PASS=… / SMTP_FROM=… / SMTP_FROM_NAME=…
```

⚠️ **All secrets are compromised** if taken from the current `config.php`. Rotate first (§6.11).

### 19.7 Other deployment considerations

| Consideration | Detail |
|---|---|
| **Build caching** | `npm ci` uses `package-lock.json`. Commit the lock file. |
| **`.gitignore`** | Must exclude `.env`, `node_modules/`, `dist/`. ⚠️ Verify Render does not receive your Supabase keys via a committed file. |
| **Logs** | Use structured logging (`pino`). Render captures stdout/stderr. ⚠️ PHP wrote to `logs/errors.log` on local disk — that file is **ephemeral on Render** and is lost on every deploy. |
| **Graceful shutdown** | Handle `SIGTERM` to close the PG pool before Render kills the instance. |
| **Static file serving** | ⚠️ **Do not serve `uploads/` from the app.** All media goes to Supabase Storage. The old `uploads/.htaccess` protection does not exist on Render. |
| **File uploads in memory** | `multer` buffers to memory by default. The 5 MB limit is small, but pass/QR generation reads images into memory too — size the instance accordingly. |
| **Custom domain** | Optional. ⚠️ If you add one, update `APP_URL`, `QR_BASE_URL`, and the CORS allowlist together. |
| **Preview/staging** | Use a second Render service + second Supabase project. Do not point previews at production data. |
| **Migrations** | Run `supabase db push` (or the migration SQL) **before** deploying the new backend — or the app will start against a schema it does not recognise. |

---


### 18.8 Supabase settings checklist

- [ ] Project created in a region near the Render instance
- [ ] Connection string copied → `DATABASE_URL` on Render
- [ ] Service-role key copied → `SUPABASE_SERVICE_ROLE_KEY` (**never** in the frontend)
- [ ] 6 tables created (migrations applied)
- [ ] Indexes and CHECK constraints applied (§18.2)
- [ ] `participant_seq` sequence created and seeded
- [ ] 5 Storage buckets created with limits and MIME restrictions (§18.4)
- [ ] RLS enabled; sponsors read policy added (§18.5)
- [ ] Auth → Email provider configured; self-signup disabled
- [ ] Admin user(s) created with new passwords
- [ ] `public.admins` rows created and linked
- [ ] `event_settings` row seeded (with `id = 1`)
- [ ] Point-in-time recovery enabled (free tier) — **your only rollback for the data**

---

alter table gallery       add constraint gallery_status_chk   check (status in ('active','inactive'));
alter table contacts      add constraint contacts_status_chk  check (status in ('new','read','replied','resolved'));
alter table email_log     add constraint email_log_status_chk check (status in ('sent','failed'));
alter table admins        add constraint admins_role_chk      check (role in ('super','admin'));
alter table event_settings add constraint event_settings_singleton_chk check (id = 1);
```

**Sequence to create** (besides identity columns):
```sql
create sequence participant_seq start 1;
```

⚠️ **The `GET /api/admin/participants` double-wrapping is a wart worth keeping for now.** Changing it to a flat array would be cleaner but requires a matching `Admin.tsx` change. Do both together, or neither.

---

| 35 | `GET /verify.php?id=X` | ⚠️ **No direct equivalent** — see note below | `Register.tsx` L369 (links `verify_url`) | `participants` | ✅ (as a link) | **P0 decision** |
| 36 | `GET /install/` | ❌ **Delete** | none | — | ❌ | — |

  MAX_UPLOAD_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  ALLOWED_IMAGE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(), SMTP_FROM_NAME: z.string().optional(),
  APP_TIMEZONE: z.string().default('Africa/Lagos'),
  ADMIN_EMAILS: z.string().default(''),
  JWT_SECRET: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(['info','debug']).default('info'),
});

export const env = schema.parse(process.env);   // fails fast at boot
```
⚠️ Note `PORT` is deliberately absent — Render injects it.

---

│   ├── app.js                  ← express app assembly
│   └── server.js               ← listen(process.env.PORT)
│
├── scripts/                    ← one-time operational tooling, NOT part of the API
│   ├── migrate-data.js         ← Phase 7 import
│   ├── migrate-files.js        ← Phase 5 upload + storage-key map
│   ├── regenerate-passes.js    ← ⭐ Phase 11 — fixes all legacy QR codes
│   └── dedupe-emails.js        ← Phase 2, step 3
│
├── supabase/
│   ├── config.toml
│   └── migrations/             ← versioned SQL (preferred over a single schema.sql)
│
├── package.json
├── .env.example
└── .gitignore
```

STEP 11 Import rows        FK-safe order; preserve IDs; setval() sequences.
STEP 12 Verify             Row counts match STEP 1; spot-check 10 participants;
                          verify photo URLs resolve.
STEP 13 Build backend      Against the migrated schema, in staging.
STEP 14 Cut over           Per Phase 10.
STEP 15 Remediate QRs      Per Phase 11, BEFORE the event.
```

### 15.4 What must NOT be migrated

| Item | Reason |
|---|---|
| `admins.password` (bcrypt hash) | §6.4 Option A. The credential is compromised. |
| The seed block in `schema.sql` L21–23 | Contains the known password + `ON DUPLICATE KEY UPDATE` that would reset it |
| `backend/database/admin_seed.sql` entirely | Same |
| The SMTP credentials as committed | Rotate first |
| `install/install.lock`, `install/index.php` | No equivalent needed in the new stack |
| `*_path` absolute filesystem paths | Replace with storage keys |
| `dist/` (committed build output) | Stale artifacts; not deployable to Render |

---


**Recommendation (Option A):** create the admin in Supabase Auth with a **new, strong, unique password**. No reset email is needed for a human you can hand credentials to. **Do not attempt the raw-SQL bcrypt import.**

**6. How duplicate emails should be handled.**

- **Admins:** not an issue — `admins.email` has a `UNIQUE` constraint in MySQL.
- **Participants:** ⚠️ **a real risk.** `participants.email` has only a non-unique index, and the duplicate check is application-level and race-prone (§4). Run this before importing:
  ```sql
  SELECT email, COUNT(*) AS c, GROUP_CONCAT(id) AS ids
  FROM participants GROUP BY email HAVING c > 1;
  ```
  If duplicates exist, decide the survivor (recommend: **lowest `id` wins**; mark the others `status='cancelled'`) and **record every decision** before adding the UNIQUE index.


