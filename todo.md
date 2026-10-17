# ZUNO TECHNOLOGIES — Master Build Plan

## Phase 0 — Setup
- [x] Verify environment (node, npm)
- [x] Scaffold project + install dependencies
- [x] Create .env (secrets, gitignored)

## Phase 1 — Backend & Database
- [x] DB layer + full schema (admins, customers, content, products, faqs, messages, tickets, media, audit, analytics)
- [x] Seed: admin account, default content, products, faqs, values, settings
- [x] Auth module (JWT httpOnly cookies, bcrypt, RBAC middleware)
- [x] Public API routes (content, products, faqs, contact, analytics)
- [x] Admin API routes (auth, CMS, products, faqs, messages, customers, tickets, media, settings, audit, analytics)
- [x] Portal API routes (register, login, profile, tickets, notifications)

## Phase 2 — Frontend (Public)
- [x] Design system CSS (black/deep-purple/neon-violet/electric-blue)
- [x] Original ZUNO logo (SVG) + favicon
- [x] Homepage: hero, customer care strip, products, values, faq, contact
- [x] About / Mission / Vision / Products / FAQ / Contact pages
- [x] Mobile-first responsive nav

## Phase 3 — Admin Dashboard
- [x] Login page (branding, show/hide password, errors)
- [x] SPA shell + collapsible sidebar (all 17 sections)
- [x] Overview + Analytics (real metrics)
- [x] Content CMS (draft/preview/publish)
- [x] Products manager
- [x] FAQs manager
- [x] Contact messages
- [x] Customer management + support tickets
- [x] Media library (upload)
- [x] Appearance + SEO + Customer Care settings
- [x] Admin settings + Audit logs

## Phase 4 — Customer Portal
- [x] Register / Login / Logout
- [x] Dashboard (welcome, profile, tickets, notifications)
- [x] Profile + change password + delete request
- [x] Support tickets (create, reply, status, close)

## Phase 5 — Security
- [x] Server-side authz on every protected route
- [x] Input validation, rate limiting, secure uploads
- [x] Audit logging, no secret exposure
- [x] Numeric route-param guards (404 not 500 on malformed ids)

## Phase 6 — Test & Deploy
- [x] Run app, smoke-test all flows
- [x] Verify admin sections (products, media, appearance, seo, audit) + portal
- [x] Make DB + uploads volume-configurable (paths.js) for persistent hosting
- [x] Deploy permanent static public site (verified URL)
- [x] Add deploy configs (Dockerfile, render.yaml, fly.toml, railway.json, Procfile, .env.example)
- [x] README with permanent free deployment steps + ₦0 limitations
- [x] Final packaging of deliverables (zip + source)

## Phase 7 — Path B: free + PERMANENT full-stack hosting
- [x] Research 2026 free tiers (Render web = free/no-card/sleeps; Neon Postgres = free/no-card/permanent)
- [x] Build PostgreSQL driver with synchronous worker bridge (zero route changes)
- [x] Dual-driver db.js — auto-selects Postgres (DATABASE_URL) or SQLite
- [x] Postgres schema + safe migrations (addColumn via information_schema)
- [x] SQL dialect translation (placeholders, datetime/date, ON CONFLICT, ILIKE, lastInsertRowid)
- [x] Add `pg` dependency
- [x] Verify full E2E on Postgres (24/24) AND on SQLite (24/24)
- [x] Update render.yaml (Blueprint: web service + DATABASE_URL secret)
- [x] Write DEPLOY.md (Render + Neon, step-by-step, no-card, free-forever)
- [x] Update README for the dual-driver deployment
- [x] Rebuild deliverable zip
- [ ] Deliver official website link + admin link/credentials to the user
