# Deploy Runbook — frank-blog-live + frank-blog-cms

> Per ADR-001 (Single Worker), ADR-002 (CMS publish → Pages rebuild),
> ADR-009 (URL compat), ADR-010 (priority order).

This runbook covers first-time setup + ongoing deploys for the
frank-blog-live monorepo:

- **Blog frontend** → Cloudflare Pages project `frank-blog`
- **Admin SPA** → Cloudflare Pages project `frank-blog-cms`
- **API Worker** → Cloudflare Worker `frank-blog-cms-api`
- **D1 database** `frank-blog-db` (shared across all)
- **R2 bucket** for media uploads (per CMS V2 §14)
- **KV namespace** `RATE_LIMIT` for §37 rate limiting

---

## 1. Prerequisites (one-time)

### 1.1 Cloudflare API token

Create token at <https://dash.cloudflare.com/profile/api-tokens> with:
- Account → Cloudflare Pages → Edit
- Account → Cloudflare Workers Scripts → Edit
- Account → D1 → Edit
- Account → R2 → Edit
- Account → Workers KV Storage → Edit

Save as GitHub repo secret `CLOUDFLARE_API_TOKEN`.

Also capture Account ID as `CLOUDFLARE_ACCOUNT_ID`.

### 1.2 Create D1 database

```bash
wrangler d1 create frank-blog-db
```

Copy the printed `database_id` into:
- `worker-api/wrangler.toml` → `[[d1_databases]].database_id`

### 1.3 Create R2 bucket

```bash
wrangler r2 bucket create frank-blog-media
# (public read via custom domain or r2.dev subdomain)
```

Then bind in `worker-api/wrangler.toml`:

```toml
[[r2_buckets]]
binding = "R2"
bucket_name = "frank-blog-media"
```

Generate R2 API token (Account → R2 → Manage R2 API Tokens → Create Token):
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ACCOUNT_ID` (same as Cloudflare account ID)

Save all three as worker secrets:
```bash
cd worker-api
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

### 1.4 Create KV namespace (rate limiting)

```bash
wrangler kv namespace create RATE_LIMIT
```

Copy the printed `id` into `worker-api/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<paste-id-here>"
```

### 1.5 Secrets

```bash
# SESSION_SECRET — 64-char hex for cookie signing
wrangler secret put SESSION_SECRET --project-name=frank-blog-cms-api
# (paste `openssl rand -hex 64` output)

# CLOUDFLARE_DEPLOY_HOOK_URL — CF Pages Deploy Hook for blog
# Create at: CF Dashboard → Pages → frank-blog → Settings → Builds → Create hook
# Select branch: master
wrangler secret put CLOUDFLARE_DEPLOY_HOOK_URL --project-name=frank-blog-cms-api
# (paste hook URL)

# ADMIN_PASSWORD — seed admin user (≥12 chars)
wrangler secret put ADMIN_PASSWORD --project-name=frank-blog-cms-api
# (paste strong password)
```

### 1.6 Custom domain (Worker)

CF Dashboard → Workers → frank-blog-cms-api → Settings → Triggers →
Add Custom Domain: `cms.blog.frank2025.com`

---

## 2. First-time deploy

### 2.1 Apply D1 migrations (local first, then remote)

```bash
# Local (--local uses .wrangler/state/v3/d1/)
npx wrangler d1 migrations apply frank-blog-db --local

# Verify schema
npx wrangler d1 execute frank-blog-db --local --command="SELECT name FROM d1_migrations ORDER BY id;"
# expect: 0001_initial, 0002_media, 0003_categories_tags, 0004_revisions

npx wrangler d1 execute frank-blog-db --local --command="SELECT name FROM pragma_table_info('post_revisions');"
# expect: id, post_id, title, slug, content, description_text, locale, status, changed_by, changed_at

# Remote
npx wrangler d1 migrations apply frank-blog-db --remote
```

### 2.2 Seed admin user

```bash
cd worker-api
node scripts/seed-admin.mjs --remote
# seeds admin@frank2025.com with the ADMIN_PASSWORD secret
```

### 2.3 Deploy worker-api

```bash
cd worker-api
npx wrangler@4 deploy --minify
```

### 2.4 Push to GitHub → triggers deploy.yml → Pages deploys

```bash
cd F:\WebSite\frank-blog-live
git push origin master
```

`deploy.yml` runs:
1. Builds admin SPA (`cd admin && npm run build`)
2. Builds blog (`npm run build`)
3. Copies `admin/out/` → `out-admin/`
4. Deploys `out-admin/` to Pages project `frank-blog-cms`
5. Deploys worker-api (`wrangler@4 deploy --minify`) — actually a no-op if already deployed via step 2.3
6. Copies `out/` → `out-blog/`
7. Deploys `out-blog/` to Pages project `frank-blog`

---

## 3. Ongoing deploy

Just `git push origin master`. `deploy.yml` (GitHub Actions) is the **sole
deployment path** and does everything in one run:

1. builds the admin SPA (`cd admin && npm run build`)
2. syncs D1 → `src/content/` MDX (`node scripts/sync-d1-to-mdx.mjs --remote`)
3. builds the site (`npm run build` — its postbuild merges `admin/out/`
   into `out/admin/` via `copy-admin-spa.mjs`)
4. deploys the API Worker (`cd worker-api && npx wrangler@4 deploy --minify`)
5. deploys the whole `out/` to the `frank-blog` Pages project

### ⚠️ Cloudflare Pages Git integration is DISABLED (on purpose)

The `frank-blog` Pages project still has "Git provider: Yes", but its
automatic deployments are turned **off** (`deployments_enabled: false`,
`production_deployments_enabled: false`).

Why: it was running a stale build config —

- `build_command`: `node scripts/sync-d1-to-mdx.mjs --remote && npm run build`
  — never built the admin SPA, so `copy-admin-spa.mjs` found no
  `admin/out/` and skipped it
- `destination_dir`: `out-admin` — a directory from the two-Pages-project
  era that no longer exists after the Phase 11 collapse

So every push produced two Pages deployments: the complete one from
Actions, and an admin-less one from the Git integration that landed later
and **overwrote it**. That is what made `blog.frank2025.com/admin` 404.

Do not re-enable it without first fixing both fields above. Actions is the
only path that also deploys the Worker, so it is the correct single source
of truth.

### Manual deploy (hotfix path)

```bash
cd F:/WebSite/frank-blog-live
npm run build            # builds site + merges admin/out → out/admin
cd admin && npm run build && cd ..   # if admin/out/ is stale
npx wrangler pages deploy out --project-name=frank-blog --branch=master --commit-dirty=true
```

Use this to restore production immediately if a deploy goes wrong; it does
not touch the Worker or D1.

---

## 4. Post-deploy verification

```bash
# API Worker (401 = reachable, unauthenticated — correct)
curl -s -o /dev/null -w '%{http_code}\n' https://blog.frank2025.com/api/admin/auth/me

# blog frontend
curl -I https://blog.frank2025.com/
# expect: 302 → /ja

# CMS SPA entry point
curl -s -o /dev/null -w '%{http_code}\n' https://blog.frank2025.com/admin/
# expect: 200

# CMS SPA sub-routes (all must be 200, not 404)
for p in /admin/login/ /admin/blog/ /admin/notes/ /admin/tags/ \
         /admin/categories/ /admin/media/ /admin/drafts/ \
         /admin/activity/ /admin/settings/; do
  printf '%s -> ' "$p"
  curl -s -o /dev/null -w '%{http_code}\n' "https://blog.frank2025.com$p"
done
```

---

## 5. Rollback

```bash
# Pages rollback via CF Dashboard
# Pages → frank-blog → Deployments → click previous successful deploy → "Rollback to this deploy"

# Worker rollback
cd worker-api
npx wrangler@4 rollback --version-id <previous-version-id>

# D1 rollback — manual. Migrations are forward-only.
# Best practice: backup before applying migrations
npx wrangler d1 backup create frank-blog-db --output=backup.sql
```

---

## 6. Smoke test (per docs/SMOKE-TEST.md)

```bash
node scripts/smoke-test.mjs --base-url https://cms.blog.frank2025.com \
  --admin-email admin@frank2025.com --admin-password "$ADMIN_PASSWORD"
```

17 tests: auth login/me, post CRUD, publish/unpublish, preview, delete, conflict (409), rate limit (429), CSRF (403). Should all pass.

---

## 7. Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `wrangler d1 execute` returns empty | Wrong DB ID | Check `worker-api/wrangler.toml` database_id |
| 404 on `/api/admin/*` | Custom domain not configured | §1.6 |
| R2 upload 403 | Missing R2_* secrets | §1.3 |
| 429 on every request | KV namespace not created | §1.4 |
| 403 CSRF_INVALID | Cookie domain mismatch | Check `cms_csrf` cookie has `Path=/`, no Domain set (should be host-only) |
| Auto-save silently fails | Worker secret `ADMIN_PASSWORD` not set in remote | §1.5 |

---

## 8. Local dev (no deploy)

```bash
# Terminal 1: blog static + admin SPA + worker-api proxy
cd F:\WebSite\frank-blog-live
npx wrangler pages dev out --port 8788 --local

# Terminal 2: work in admin/ for admin SPA changes
cd F:\WebSite\frank-blog-live\admin
npm run dev
# opens http://localhost:3000/admin
```
