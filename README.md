# ZUNO TECHNOLOGIES — "Ideas Into Reality."

A complete, production-grade full-stack web application for **Zuno Technologies**:
a public marketing website, a secure administrator dashboard with a full CMS, and
a customer portal with real authentication and support tickets. Everything is backed
by a real server and a real database — there are no static mock-ups and no dead buttons.

---

## 1. What this project contains

The application is one Node.js server that renders the public website on the server
and serves two single-page applications (the admin dashboard and the customer portal)
plus a JSON API. All three share one database — SQLite by default, or Postgres when
`DATABASE_URL` is set.

**Public website** — Home, About Us, Our Mission, Our Vision, Products, FAQ, Contact Us,
and Customer Portal. The homepage opens with the ZUNO logo, the company name, the slogan,
the company introduction, the hero heading "BUILDING TOMORROW. TODAY.", a prominent
Customer Care section (the email `zunocustomerscare@gmail.com` is always shown and clickable),
and the buttons "EXPLORE OUR PRODUCTS" and "CONTACT CUSTOMER CARE". A phone number is
**never invented** — it only appears once an administrator configures one.

**Administrator dashboard** (`/admin`, login at `/admin/login`) — a secure, database-connected
control panel with a collapsible sidebar covering Overview, Website Content, About Us,
Mission and Vision, Products, Customer Care, Contact Messages, Customer Management,
Customer Support, FAQs, Media Library, Website Appearance, SEO Settings, Analytics,
Administrator Settings, Audit Logs, and Logout. Every protected operation is re-verified
on the server; there is no public admin registration and no way for a customer to promote
themselves.

**Customer portal** (`/portal`, login at `/portal/login`, register at `/portal/register`) —
real email-based accounts with registration, login, logout, profile management, password
change, session management, an account-deletion request, a dashboard with notifications,
and a support-ticket system (submit with attachments, category, status tracking, replies,
history, and close). Customers can only ever see their own records.

---

## 2. Technology

The stack is deliberately small and dependency-light so it deploys anywhere and needs no
native compilation. The server is **Express 5** on **Node.js 22**. The database layer is **dual-driver**: by default
it uses **SQLite through Node's built-in `node:sqlite` module** (a real, file-based SQL database
with no external service and no build tools), and the moment the `DATABASE_URL` environment
variable is set it automatically switches to **PostgreSQL** through `pg`. Both drivers expose the
same synchronous API, so no route code changes between them. Passwords are hashed with **bcryptjs**, sessions
use **JSON Web Tokens stored in httpOnly, SameSite cookies** and are additionally tracked in
a `sessions` table so they can be revoked. Security headers come from **helmet**, rate
limiting from **express-rate-limit**, and file uploads from **multer**. The front end is
hand-written HTML, CSS, and vanilla JavaScript — no framework, no build step.

---

## 3. Running it locally

You need Node.js 22.5 or newer. From the project folder run:

```bash
npm install
cp .env.example .env      # then edit .env and set JWT_SECRET + ADMIN_PASSWORD
npm start
```

The server prints the URLs it is serving:

- Public website — http://localhost:3000
- Administrator dashboard — http://localhost:3000/admin
- Customer portal — http://localhost:3000/portal

On first boot the application creates the database, seeds the default content (the About,
Mission, Vision, Core Values, Products and FAQ text), and creates the administrator account
from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your `.env`.

### Initial administrator credentials

For this build the administrator account is:

- **Email:** `ebulejames9@gmail.com`
- **Password:** `JuiceWrld999.@52`

The password is supplied through the environment (`ADMIN_PASSWORD`) and is stored only as a
bcrypt hash — it is never written into the front-end source. **Change it immediately after
your first login** in *Administrator Settings → Change password*.

---

## 4. Project structure

```
zuno/
├── server.js              Express app: SSR pages, API mounts, SPA routes, SEO files
├── db.js                  Database layer: schema, migrations, seed data, helpers
├── auth.js                Password hashing, JWT sessions, RBAC middleware
├── paths.js               Central path config (DB + uploads, volume-friendly)
├── views.js               Server-rendered public pages
├── routes/
│   ├── public.js          Public API: content, products, faqs, contact, analytics
│   ├── admin.js           Admin API (every route re-verified server-side)
│   └── portal.js          Customer API (every query scoped to the owner)
├── public/
│   ├── css/               styles.css (public), dashboard.css (admin + portal)
│   ├── js/                site.js, admin.js, portal.js
│   ├── assets/            Original ZUNO logo, favicon, social image (SVG)
│   ├── admin.html         Admin SPA shell
│   └── portal.html        Customer portal SPA shell
├── tools/
│   ├── export-static.js   Renders the public site to a static folder (dist/)
│   └── static-app-pages.js Branded portal/admin pages for the static export
├── Dockerfile             Production container image
├── render.yaml            Render Blueprint (one-click deploy)
├── fly.toml               Fly.io config (persistent volume)
├── railway.json           Railway config
└── Procfile               Heroku-style process file
```

---

## 5. Configuration

All configuration is through environment variables (see `.env.example`).

`JWT_SECRET` signs session tokens and must be a long random value in production. Generate one
with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. `ADMIN_EMAIL`
and `ADMIN_PASSWORD` create the first administrator. `PORT` sets the listening port.

For persistence, set `ZUNO_DATA_DIR` to a mounted volume path (for example `/data`); the SQLite
database and uploaded media then live there and survive restarts and redeploys. `DB_PATH` and
`UPLOAD_DIR` override the database file and uploads folder individually.

For contact-form email notifications, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`, and `NOTIFY_EMAIL`. If these are not set, the contact form still works: every
message is validated, saved to the database, and shown in *Customer Care → Contact Messages*,
and the visitor sees a real confirmation. The application simply does not send an email in that
case, and the admin dashboard states this plainly.

---

## 6. Deployment — permanent hosting and the honest ₦0 reality

This is the part where expectations need to be set clearly, because it is the one requirement
that cannot be met completely for free.

**What is already deployed and permanent.** The public website has been exported to a static
build and deployed to a permanent, stable HTTPS URL:
`https://sites.super.myninja.ai/df966724-9ebd-4049-99bd-0cfe6ee2651b/fc808f5f/index.html`.
Static hosting is the one category where "free" has almost no catch, so the marketing site is
genuinely free and permanent.

**Why the full application needs a server.** The admin dashboard and the customer portal need a
running Node process and a database. That is a different hosting category, and in 2026 the free
options there all come with a catch — verified against vendor pricing in September 2026:

- **Render** — free web service (750 hours/month, 512 MB, no credit card). It sleeps after 15
  minutes idle and wakes in about a minute. Its **free filesystem is ephemeral**, so a SQLite
  file resets on redeploy/restart, and its free Postgres expires after 30 days.
- **Railway** — free plan gives only $1 of credit a month, which does not cover an always-on
  service (roughly $6–7/month of usage), so it stops after a few days.
- **Koyeb** — now requires a credit card (a $29 pre-authorisation hold).
- **Fly.io** — free tier removed; a card is required.
- **Oracle Cloud** — the only genuinely permanent free VM (2 Arm cores, 12 GB RAM, 200 GB
  storage) but it requires a card and you administer it yourself.

In short: **a fully free, permanent, always-on host with a persistent database does not exist.**
Free tiers either sleep, cap hours, wipe the disk, or require a card. Any service that promises
otherwise for ₦0 is either a trial or will disappear.

### The three realistic paths

**Path A — Simplest free deploy (good for a demo, data resets).** Push the repository to GitHub,
then in Render choose *New + → Blueprint* and select the repo; Render reads `render.yaml`,
builds the `Dockerfile`, generates a `JWT_SECRET`, and asks you for `ADMIN_PASSWORD`. You get a
permanent HTTPS URL. The catch: because the free disk is ephemeral, content edits and customer
accounts reset when the service redeploys or restarts. Use this to show the app working, not to
run a real business.

**Path B — Free and persistent (recommended for ₦0).** Run the app on a free container host
(Render or SnapDeploy) and keep the data in a **free external Postgres** (Neon or Supabase both
have permanent free tiers). This survives restarts and costs nothing. It requires a small code
change: swap the `node:sqlite` calls in `db.js` and the routes for a Postgres client such as
`pg`. The data layer is isolated in `db.js` and the routes use a thin set of helpers, so the
change is contained. The `DATABASE_URL` environment variable is the standard way to point at it.

**Path C — Persistent SQLite with a volume (cheapest paid, simplest).** SQLite is perfectly
capable of serving thousands of users when it has a persistent disk. Deploy the included
`Dockerfile` to a host that offers a volume — **Fly.io** (`fly.toml` already mounts one at
`/data`), **Railway** with a volume, or **Render** with a paid Disk — and set `ZUNO_DATA_DIR=/data`.
The database and uploads then persist with no code changes. This is the least work and the
lowest risk; the only cost is a small monthly fee (roughly $5–7), which is why it is not ₦0.

### What "lasts ten years and serves thousands of users" actually requires

No free tier will do that, and no honest engineer would claim it. A site that must run reliably
for a decade with thousands of users needs a paid host with a persistent database, automated
backups, and monitoring. The application is built to make that step easy: it is a single
container, it stores its state in one directory, and it reads all of its configuration from
environment variables. Moving from the free demo to a paid, persistent host is a matter of
setting `ZUNO_DATA_DIR`, `JWT_SECRET`, and `ADMIN_PASSWORD` on the new host and pointing a domain
at it.

---

## 7. Security

Passwords are hashed with bcrypt (cost 12). Sessions are signed JWTs delivered in httpOnly,
SameSite cookies and recorded in a `sessions` table so any session can be revoked; admin and
customer sessions are separate. Every protected route re-checks the caller's role on the server
through `requireAdmin` and `requireCustomer` middleware — the client is never trusted. Customer
ticket and profile queries are always scoped by the authenticated customer id, so changing an id
in a URL or request body cannot reach another customer's data. Input is validated on the server,
login and contact endpoints are rate-limited, security headers are set by helmet with a strict
Content-Security-Policy, and uploaded files are type- and size-checked. Customer attachments are
stored in a private folder that is never served statically and are only reachable through an
authenticated, ownership-checked route. Administrative actions are written to an audit log, and
secrets are read from environment variables only — never hard-coded into the front end.

---

## 8. Static export of the public site

`npm run export:static` renders every public page from the running server (reading the live
database) into a self-contained `dist/` folder, rewriting links so it can be hosted on any static
host (GitHub Pages, Cloudflare Pages, Netlify, or the included deploy step). On the static build
the contact form degrades gracefully: instead of failing, it opens the visitor's email app
addressed to the customer-care mailbox.

---

## 9. Default content and where to edit it

Every piece of public text is editable in the dashboard and stored in the database, so the
website always reflects what the administrator has published. About Us, Mission, Vision, the
Core Values, the Products introduction, and the FAQ introduction live under *Website Content*
and *Mission and Vision*; the five Core Values are individual, reorderable cards; the three
products (LINKUP, Zuno Games, Zuno Sports) are managed under *Products*, where you can add,
edit, reorder, archive, or remove products, set categories, upload images, and switch each one
between "Coming Soon" and "Available" — changing availability never deploys a separate app. The
six starter FAQs are managed under *FAQs*. Customer-care details (email, phone, WhatsApp, support
hours, message) live under *Customer Care*; the email `zunocustomerscare@gmail.com` is set there
and is shown to customers and used in support.

Content uses a draft-and-publish workflow: edits are saved as a draft, can be previewed, and are
only shown publicly once published. Drafts are never visible on the live site.

---

## 10. License

Proprietary — © Zuno Technologies. All rights reserved.
