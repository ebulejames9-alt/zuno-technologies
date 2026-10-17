# ZUNO Technologies — Free & Permanent Deployment Guide

This guide puts the **complete** Zuno Technologies site online — public website,
admin dashboard, and customer portal — on hosting that is **free and permanent**,
with **no credit card required**.

## The stack (why it is free *and* permanent)

| Piece | Service | Free? | Permanent? | Card? |
|-------|---------|-------|------------|-------|
| App server | **Render** free web service | Yes (750 hrs/mo) | Yes — sleeps after 15 min idle, wakes on the next visit | No |
| Database | **Neon** free Postgres | Yes (0.5 GB) | Yes — never expires | No |

The app is database-agnostic: set `DATABASE_URL` and it runs on Postgres;
without it, it runs on a local SQLite file. Uploaded images are stored **in the
database** when `DATABASE_URL` is set, so they survive restarts too.

> Render's *own* free Postgres expires after 30 days, so this guide uses **Neon**,
> which stays free forever.

---

## Step 1 — Create the free database (Neon) — about 2 minutes

1. Go to **https://neon.tech** and click **Sign up** (you can use your Google account).
2. Create a project (any name, e.g. `zuno`). Pick the region closest to you.
3. On the project dashboard, find **Connection string** and copy the whole
   `postgresql://...` URL. It looks like:

   ```
   postgresql://zuno_owner:AbC123xyz@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. Keep this string safe — it is your `DATABASE_URL`.

*(Supabase works the same way: create a project, then copy the "Connection string
→ URI" from Project Settings → Database.)*

---

## Step 2 — Put the code on GitHub

**Option A — with Git (fastest if you have it):**

```bash
cd zuno-technologies
git init
git add .
git commit -m "Zuno Technologies"
git branch -M main
git remote add origin https://github.com/<your-username>/zuno-technologies.git
git push -u origin main
```

**Option B — no terminal (GitHub website):**

1. Sign in at **https://github.com** → **New repository** → name it
   `zuno-technologies` → **Public** → **Create**.
2. On the new repo page click **uploading an existing file**.
3. Unzip `zuno-technologies.zip` on your computer, then drag **all** the files
   and folders from inside it into the browser upload box.
4. Click **Commit changes**.

> Do **not** upload the `node_modules`, `data`, or `.env` files — they are not
> needed and should stay private.

---

## Step 3 — Deploy on Render (free) — about 3 minutes

1. Go to **https://render.com** and click **Get Started** (sign in with the same
   Google account if you like). No card is required for free services.
2. Click **New +** → **Blueprint**.
3. Connect GitHub and pick your `zuno-technologies` repository. Render reads
   `render.yaml` and shows the plan.
4. Fill in the two secrets it asks for:
   - **DATABASE_URL** → paste the Neon connection string from Step 1.
   - **ADMIN_PASSWORD** → `JuiceWrld999.@52` (or your own choice).
5. Click **Apply / Create**. Render builds the Docker image and starts the service.
6. Wait for the status to become **Live**. Your permanent URL is shown at the top,
   e.g. `https://zuno-technologies.onrender.com`.

---

## Step 4 — Verify

Open these (replace the domain with your Render URL):

- Public website: `https://<your-app>.onrender.com/`
- Admin login: `https://<your-app>.onrender.com/admin/login`
  - Email: `ebulejames9@gmail.com`
  - Password: `JuiceWrld999.@52`
- Customer portal: `https://<your-app>.onrender.com/portal`

Health check: `https://<your-app>.onrender.com/api/health` returns `{"ok":true,...}`.

> **First visit after idle:** the free service sleeps after 15 minutes without
> traffic. The next visit shows a short loading page (about a minute) while it
> wakes. After that it is fast. This is the only trade-off of the free tier.

---

## Optional — a custom domain

Render → your service → **Settings → Custom Domains** → add your domain and point
its DNS `CNAME` to the value Render shows. HTTPS is provisioned automatically and
free.

---

## Changing the admin password later

Set `ADMIN_PASSWORD` in Render → your service → **Environment**, then trigger a
redeploy. On boot the app re-seeds the admin account with the new password.
(You can also change it from **Administrator Settings** inside the dashboard.)

---

## Troubleshooting

- **Build fails on `npm install`** — make sure `package.json` and `package-lock.json`
  were uploaded.
- **"Database connection failed"** — re-check `DATABASE_URL`; Neon requires the
  `?sslmode=require` suffix (the app enables SSL automatically for non-local hosts).
- **Content resets after a redeploy** — `DATABASE_URL` is not set, so the app is
  using the ephemeral SQLite file. Set `DATABASE_URL` and redeploy.
- **Cold start** — expected on the free plan; see Step 4.

---

## Alternative: self-hosting with a persistent volume

If you ever want the whole thing on one box (e.g. a small VPS), just run the
Docker image with a volume mounted at `/data` and **no** `DATABASE_URL`:

```bash
docker build -t zuno .
docker run -d -p 3000:3000 -v zuno-data:/data \
  -e JWT_SECRET="a-long-random-string" \
  -e ADMIN_EMAIL="ebulejames9@gmail.com" \
  -e ADMIN_PASSWORD="JuiceWrld999.@52" \
  zuno
```

The SQLite database and uploads then live on the volume and survive restarts.
