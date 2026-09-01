# Smoke Test — frank-blog CMS

> Per **ADR-009 (URL 兼容) + ADR-010 (数据/性能/SEO 优先) + doc spec 四十三/四十四/四十五**

---

## Overview

This document covers 3 test categories:

1. **Automated API smoke test** — `scripts/smoke-test.mjs` (17 tests, runs in ~10s)
2. **Manual UI smoke test** — 8-step checklist (per doc spec 四十三)
3. **URL/SEO regression test** — 20-URL sample check (per doc spec 四十五)
4. **Data consistency test** — D1 ↔ MDX count + 20-post sample (per doc spec 四十四)

---

## 1. Automated API Smoke Test

### Usage

```bash
# Local (wrangler pages dev server)
npx wrangler pages dev out --port 3456 &
node scripts/smoke-test.mjs \
  --base-url http://localhost:3456 \
  --admin-email admin@frank2025.com \
  --admin-password "$ADMIN_PASSWORD"

# Production (after deploy)
node scripts/smoke-test.mjs \
  --base-url https://blog.frank2025.com \
  --admin-email admin@frank2025.com \
  --admin-password "$ADMIN_PASSWORD"
```

### Tests

| # | Test | Expected |
|---|---|---|
| 1 | GET /admin/login | 200 + HTML |
| 2 | POST /api/admin/auth/login (valid) | 200 + Set-Cookie + user data |
| 3 | POST /api/admin/auth/login (wrong password) | 401 + INVALID_CREDENTIALS |
| 4 | GET /api/admin/auth/me (with cookie) | 200 + user email |
| 5 | GET /api/admin/auth/me (no cookie) | 401 + NOT_AUTHENTICATED |
| 6 | POST /api/admin/posts (create draft) | 201 + post.id |
| 7 | GET /api/admin/posts (list) | 200 + posts array |
| 8 | GET /api/admin/posts/:id | 200 + post.slug |
| 9 | PUT /api/admin/posts/:id (update) | 200 |
| 10 | GET /api/admin/preview/:id | 200 + content |
| 11 | POST /api/admin/posts/:id/publish | 200/502 + status='published' + deploy_triggered |
| 12 | Verify URL accessible after publish | 200/302/404 |
| 13 | POST /api/admin/posts/:id/unpublish | 200/502 + status='draft' |
| 14 | DELETE /api/admin/posts/:id | 204 |
| 15 | GET /api/admin/posts/:id (deleted) | 404 + NOT_FOUND |
| 16 | POST /api/admin/auth/logout | 200 + cookie cleared |
| 17 | GET /api/admin/posts (after logout) | 401 + NOT_AUTHENTICATED |

### Exit codes

- `0` — all tests passed
- `1` — usage error (e.g., missing --admin-password)
- `2` — one or more tests failed

---

## 2. Manual UI Smoke Test (per doc spec 四十三)

These tests require browser interaction. Use checklist format.

### Pre-requisites

- [ ] D1 migrations applied (Phase 1)
- [ ] ADMIN_PASSWORD seeded (`scripts/seed-admin.mjs --local`)
- [ ] CF Pages build command updated:
  `node scripts/sync-d1-to-mdx.mjs --remote && npm run build`

### Steps

| # | Step | Expected | Notes |
|---|---|---|---|
| 1 | Open `https://blog.frank2025.com/admin/login` | Login form renders | Dark theme, "Admin" heading |
| 2 | Enter admin@frank2025.com + password → Submit | Redirects to /admin | Cookie set, HttpOnly |
| 3 | Verify Dashboard | Shows user email, role, 11-item roadmap | "Frank Ding" displayed |
| 4 | Click "+ New Post" → fill form → Submit | Redirects to /admin/posts/:id | Draft status |
| 5 | Edit draft → change title → Save Draft | "Saved at HH:MM:SS" message | updated_at changes |
| 6 | Click "Preview" tab | MDX rendered with title + description + body | Same renderer as production |
| 7 | Click "Publish" button | "Published at HH:MM:SS" + deploy_triggered | CF Pages build triggered |
| 8 | Open `https://blog.frank2025.com/{locale}/{collection}/{slug}` | New post visible | 30-60s after Publish (build time) |
| 9 | Modify post in /admin → Save | Updated content on public site | After next publish + build |
| 10 | Click Unpublish in /admin | Post removed from production site | 404 on public URL |
| 11 | Click Delete in /admin → confirm | Post removed from D1 | 404 in /admin/posts list |
| 12 | Click Logout → revisit /admin | Redirects to /admin/login | Session cleared |

---

## 3. URL/SEO Regression Test (per doc spec 四十五)

Manual or scripted check of ≥20 random URLs.

### Steps

```bash
# 1. Get URL list from src/content/
ls src/content/{zh,ja,en}/{posts,notes}/*.mdx | \
  awk -F/ '{lang=$3; coll=$4; gsub(/\.mdx$/,"",$5); printf "https://blog.frank2025.com/%s/%s/%s\n", lang, coll, $5}' \
  | sort -R | head -20 > /tmp/urls-to-check.txt

# 2. Check each URL
while read url; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  title=$(curl -s "$url" | grep -oP '(?<=<title>)[^<]+' | head -1)
  desc=$(curl -s "$url" | grep -oP '(?<=name="description" content=")[^"]+' | head -1)
  canonical=$(curl -s "$url" | grep -oP '(?<=rel="canonical" href=")[^"]+' | head -1)
  echo "$url $status $title"
done < /tmp/urls-to-check.txt
```

### Acceptance

- HTTP 200 for all URLs
- Title matches MDX frontmatter
- Description matches MDX frontmatter (or description_text in D1)
- Canonical URL is the URL itself
- OG image present in `<meta property="og:image">`
- hreflang alternates present for ja / zh / en

---

## 4. Data Consistency Test (per doc spec 四十四)

### Count check

```bash
# D1 count
md_count=$(find src/content -name '*.mdx' | wc -l)
d1_count=$(npx wrangler d1 execute frank-blog-db --local --json --command "SELECT COUNT(*) as n FROM posts WHERE status='published'" | jq '.[0].results[0].n')

[ "$md_count" = "$d1_count" ] && echo "✅ counts match" || echo "❌ MD=$md_count D1=$d1_count"
```

### 20-post sample check

For each of 20 random posts, verify:
- title matches MDX ↔ D1
- description matches (or D-6 description_raw round-trip)
- content matches byte-for-byte
- slug matches
- locale matches
- published_at matches
- tags match (as JSON array)
- cover_image matches

```bash
# Pick 20 random MDX files
find src/content -name '*.mdx' | sort -R | head -20 > /tmp/sample.txt

while read mdx; do
  # extract slug, locale, collection
  ...
  # query D1
  d1=$(npx wrangler d1 execute frank-blog-db --local --json --command "SELECT title, content, ... FROM posts WHERE locale='...' AND collection='...' AND slug='...'")
  # compare fields
  ...
done < /tmp/sample.txt
```

### Acceptance

- Count: MD1 == D1 count (for status='published')
- 20/20 sample posts: title, content, slug, locale all match
- Tags: parse JSON, compare element-by-element
- Description: MD-6 description_raw byte-identical for migrated posts

---

## Acceptance criteria summary

Per **ADR-010 priority order** (data > URL/SEO > perf > CMS > features):

1. ✅ Data integrity: 0 data loss, D1 ↔ MDX byte-identical for migrated posts
2. ✅ URL stability: All old URLs return 200 with same content
3. ✅ SEO preserved: title / description / canonical / OG image match
4. ✅ Performance: SSG rebuild completes within 60s for small changes
5. ✅ CMS functional: All admin operations work end-to-end

---

## Failure recovery

If smoke test fails:

1. **Check deploy hook** — `wrangler d1 execute frank-blog-db --local --command "SELECT action, resource_id, ip_hash FROM admin_logs ORDER BY created_at DESC LIMIT 10"`
2. **Check CF Pages logs** — Dashboard → Workers & Pages → frank-blog-cms → Logs
3. **Re-run migration if D1 < MD1** — `node scripts/migrate-md-to-d1.mjs --local`
4. **Roll back via git** — `git revert <commit> && git push`

---

## Related

- `scripts/smoke-test.mjs` — automated API test (Phase 10 deliverable)
- `scripts/migrate-md-to-d1.mjs` — MDX → D1 migration (Phase 8)
- `scripts/sync-d1-to-mdx.mjs` — D1 → MDX sync on build (Phase 9)
- `docs/ADR.md` — architecture decisions
- `docs/PHASE-0-ANALYSIS.md` — initial project analysis
