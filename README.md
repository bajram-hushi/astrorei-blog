# ReiLabs

Internal blog application with:

- Private content (authenticated users only)
- Login via Google OAuth or `@astrorei.io` credentials
- Post creation and comments
- Markdown or rich text (HTML) content
- Inline base64 images in content
- Supabase Postgres using `blog` schema + RLS

## Stack (Near 0-Cost Infra)

- App: Next.js (App Router) deployed on Vercel free tier
- Database/Auth: Supabase free tier (Postgres + Auth + RLS)
- Storage: none required (images embedded as base64 in markdown/HTML)
- Ops: no dedicated server, no container, no paid infra needed for small internal usage

## 1) Configure Supabase

1. Create a Supabase project.
2. Enable Google provider in Auth -> Providers.
3. In Supabase Auth -> URL Configuration, set Site URL to your app URL (for local: `http://localhost:3333`).
4. In Supabase Auth -> URL Configuration, add Redirect URLs:
   - `http://localhost:3333/auth/callback`
   - your production callback (for example `https://your-app.com/auth/callback`)
5. In Google Cloud Console (OAuth client used in Supabase Google provider), add this Authorized redirect URI exactly:
   - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
6. In SQL editor, run: `supabase/blog_schema.sql`.

## 2) Configure Environment

Copy `.env.example` into `.env.local` and set values:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3333
```

## 3) Run Locally

```bash
npm install
npm run dev
```

Note:

- `npm run dev` and `npm run start` now run database migration first.
- Auto-migration runs only when `SUPABASE_DB_URL` is set; otherwise it is skipped with a message.

Open `http://localhost:3333`.

## Production Migrations (Supabase Environments)

This repo now follows Supabase's environment management workflow using Supabase CLI migrations.

Workflow file:

- `.github/workflows/release-supabase-migrate.yml`

How it works:

1. Keep SQL migrations in `supabase/migrations/*.sql`.
2. On every push to `main`, GitHub Actions links to production project.
3. It runs `supabase db push` to apply new migrations.

Required GitHub secrets:

- `SUPABASE_ACCESS_TOKEN`
- `PRODUCTION_PROJECT_ID`
- `PRODUCTION_DB_PASSWORD`

Useful local commands:

```bash
supabase migration new <name>
supabase db reset
supabase db push
```

Notes:

- `supabase/blog_schema.sql` is retained as a full schema reference.
- CI/CD deployments use migration files under `supabase/migrations`.

## Authentication Rules

- Google OAuth users are allowed.
- Non-Google users are allowed only if email ends with `@astrorei.io`.
- RLS policies in `blog` schema enforce internal-only access on reads/writes.

## Troubleshooting OAuth

If you see `Error 400: redirect_uri_mismatch` on Google sign-in:

1. Verify Google Cloud OAuth client has exact URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Verify Supabase Google provider is using that same client id/secret.
3. Verify `NEXT_PUBLIC_APP_URL` matches where app runs (for local: `http://localhost:3333`).
4. Restart dev server after env changes.

## Notes About Base64 Images

- Markdown supports: `![alt](data:image/png;base64,...)`
- Rich text supports HTML with `<img src="data:image/png;base64,..." />`
- This keeps infrastructure cost low, but increases row size in Postgres.
