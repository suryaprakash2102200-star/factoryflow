# Deploying FactoryFlow

Recommended setup: **Vercel** (runs the Next.js app, free tier is enough to start) + the **Supabase** database you already have. No servers to manage.

## 0. Before you start

- A GitHub account and a Vercel account (sign up at vercel.com with GitHub).
- Your NVIDIA API key from build.nvidia.com (for the AI assistant).
- The database is already set up (`npm run db:upgrade` was run against Supabase).

## 1. Put the code on GitHub

```bash
cd D:\CRM
git rm -r --cached .claude/worktrees   # remove the stray worktree that got staged
echo .claude/worktrees/ >> .gitignore
git add -A
git commit -m "FactoryFlow v1"
# create an EMPTY private repo on github.com, then:
git remote add origin https://github.com/<you>/factoryflow.git
git push -u origin main
```

`.env` is already in `.gitignore`. Never commit it.

## 2. Import into Vercel

1. vercel.com → **Add New → Project** → pick the GitHub repo.
2. Framework: Next.js (auto-detected). Build command stays `npm run build` (it runs `prisma generate` first).
3. **Settings → Functions → Region**: choose the region closest to your database. Your Supabase project is in **Tokyo (ap-northeast-1)** → pick `hnd1`. If you move the database to **Mumbai**, pick `bom1` (much faster for Indian users).
4. Add the environment variables below, then **Deploy**.

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|---|---|
| `DATABASE_URL` | Your **crm_app** URL from `.env`, but with the **transaction pooler** port and flags for serverless: change `:5432/postgres?sslmode=require` to `:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | The `postgres` (owner) URL from `.env`, unchanged (port 5432). Only used for schema changes. |
| `AUTH_SECRET` | A **new** random value (generate with `npx auth secret` or any 32+ char random string). Don't reuse the dev one. |
| `AUTH_URL` | Your site URL, e.g. `https://factoryflow.vercel.app` (update after you add a custom domain) |
| `NVIDIA_API_KEY` | Your NVIDIA key (`nvapi-…`) |
| `NVIDIA_MODEL` | Optional. Default `meta/llama-3.3-70b-instruct`. Any model on build.nvidia.com that supports tool calling works. |

Do **not** set `DEV_TENANT_ID` / `DEV_USER_ID` in production (they're ignored there anyway).

## 4. After the first deploy

- Open the site, sign in with `admin@acme.test` / `password123`, and **change that password immediately** (or delete the demo workspace's users and sign up fresh at `/signup`).
- Turn on the assistant: Setup → Modules → *AI Factory Assistant*.
- For a real customer, create their own workspace via `/signup` instead of using the demo one.

## 5. Custom domain (optional)

Vercel → Settings → Domains → add `app.yourcompany.in`, follow the DNS instructions, then update `AUTH_URL`.

## 6. Updating later

Push to `main` → Vercel redeploys automatically.
If you changed `prisma/schema.prisma`, run this from your PC **before** pushing:

```bash
npm run db:upgrade      # applies schema + security policies + role permissions to Supabase
```

## Limits to know

- **File uploads** are stored in Postgres, 5 MB each. Vercel's request limit is 4.5 MB, so on Vercel the practical limit is ~4 MB per file. For larger drawings, move uploads to Supabase Storage later.
- **AI requests** must finish within 60 s on Vercel's free plan; the assistant is set to that.
- **Supabase free plan** pauses the database after a week without traffic, and backups are only on paid plans. Upgrade before real customers use it.

## Alternative: your own server (VPS / office PC)

```bash
npm ci
npm run build
npm start -- -p 3000      # put Nginx/Caddy in front for HTTPS
```

Same environment variables, in a `.env` file on the server. Use `pm2` or a systemd service to keep it running.
