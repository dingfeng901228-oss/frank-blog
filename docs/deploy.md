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

Just `git push origin master` — `deploy.yml` handles both Pages deploys.

For worker-api Worker changes, also run `npx wrangler@4 deploy --minify` from
`worker-api/` manually if you want them live before next git push (worker-api
is also re-deployed by `deploy.yml` but uses `wranglerVersion: '3'` for the
Pages action — actually the worker-api deploy step uses `wrangler@4 deploy`).

---

## 4. Post-deploy verification

```bash
# Test worker-api is up
curl https://cms.blog.frank2025.com/api/admin/auth/me
# expect: 401 NOT_AUTHENTICATED (no cookie sent)

# Test blog is up
curl -I https://blog.frank2025.com/
# expect: 200 OK

# Test admin SPA is up
curl -I https://cms.frank2025.com/admin/login
# expect: 200 OK (returns login HTML)
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
