# Phase 7 — Security Audit

Per docs/CMS V2.md §三十七 Phase 7 + §三十八 验收标准.

This document audits the frank-blog-cms-api Worker + admin SPA against the spec's
security requirements. Findings are organized by §三十七 Phase 7 categories.

---

## CSRF (Cross-Site Request Forgery)

**Status: ⚠️ Mitigated by SameSite=Lax, no CSRF token**

- Session cookie is `SameSite=Lax` (§三 same-origin protection)
- No explicit CSRF token on POST/PUT/DELETE endpoints

**Risk**: Low. SameSite=Lax blocks cross-site POST/PUT/DELETE from third-party
sites. State-changing endpoints are protected by cookie + session check.

**Recommendation** (Phase 8): Add double-submit cookie pattern or
`X-CSRF-Token` header check for defense-in-depth.

---

## Rate Limit

**Status: ❌ Not implemented**

- No rate limiting on `/api/admin/auth/login` — vulnerable to credential brute force
- No rate limiting on `/api/admin/media/upload` — vulnerable to storage abuse
- No rate limiting on any other endpoint

**Risk**: High for login. An attacker with leaked credentials could brute force.

**Recommendation**: Add CF Workers Rate Limiting binding (free tier: 100k req/day)
or per-IP token bucket in Worker. Login should be ≤5 attempts per IP per 5 min.

---

## Input Validation

**Status: ✅ Mostly good, gaps in string length**

- D1 queries use parameterized binding → no SQL injection (✅)
- POST /api/admin/posts validates required fields (title, slug, locale, collection, status)
- POST /api/admin/posts validates `collection ∈ {posts, notes}` and `status ∈ {draft, published, archived}`
- POST /api/admin/posts/[id]/publish validates post exists
- Media upload validates MIME type (png/jpeg/webp/gif) + size (≤10MB) — ✅
- Tags/Categories reject empty name/slug — ✅
- **Gap**: No max length on `title`, `slug`, `description_text`, `content`
- **Gap**: No slug format validation (could allow `../../etc/passwd` paths if R2 keys aren't sanitized — they are, format is `media/{ts}-{uuid}.{ext}`)

**Risk**: Medium. Long strings could fill D1 row size limits; slug format
validation is defense-in-depth.

**Recommendation**: Add `LENGTH(title) <= 500`, `LENGTH(slug) <= 200`,
`LENGTH(content) <= 65536` checks; reject slugs matching `^[a-z0-9-]+$`.

---

## Upload Validation

**Status: ✅ Done**

- MIME allowlist: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- Max size: 10 MB (server-side enforced)
- Filename sanitized in R2 key: `media/{ts}-{uuid}.{ext}` (UUIDv4, unguessable)
- R2 custom metadata stores `originalName` for display (not used in key derivation)

**Risk**: Low. R2 key uses UUIDv4 → unguessable. Original filename preserved for
display but not used in URL construction.

**Recommendation**: Verify Content-Type matches magic bytes on the server
(currently trusts client-sent Content-Type).

---

## Session

**Status: ✅ Good**

- HttpOnly + Secure + SameSite=Lax cookies (§三)
- Session TTL: 7 days (`SESSION_TTL_DAYS = 7` in cms.ts)
- Server-side session stored in D1 `sessions` table with `expires_at`
- `last_used_at` updated on each request (sliding expiration)
- Session check via `getSessionUser(env, tokenHash)` on every protected route

**Risk**: Low.

**Recommendation**: Reduce TTL for admin from 7 to 3 days; add absolute max session
lifetime (re-auth after 30 days regardless of activity).

---

## Cookie

**Status: ✅ Good**

- `cms_session` cookie attributes: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`
- Path=`/` covers all admin routes
- Secure flag → only sent over HTTPS
- SameSite=Lax → blocks CSRF, allows top-level navigation

**Risk**: Low.

**Recommendation**: Consider `__Host-` prefix for additional integrity
(CF Workers supports this since 2022).

---

## Authorization

**Status: ✅ Good, gap: only 1 role**

- Every protected endpoint calls `getCurrentUser(request, env)` and returns 401 if unauth'd
- No role-based access control — all logged-in users have full admin powers
- Database schema only has `admin` and `editor` roles in `users.role` enum, but
  the API doesn't differentiate — every authenticated user is treated as admin

**Risk**: Medium in shared-team scenarios. Low for Frank's single-user setup.

**Recommendation**: Implement role check in `getCurrentUser` (or a separate helper):
- `editor`: can create/edit/publish posts but not manage users, settings, or destructive ops
- `admin`: full access

---

## SQL Injection

**Status: ✅ Good**

- All D1 queries use parameterized `?` placeholders via `queryFirst` / `queryAll` / `execute` helpers
- No string concatenation into SQL anywhere in worker-api/src/
- D1 binding handles type coercion (numbers, strings, nulls, booleans)

**Risk**: Low.

---

## XSS (Cross-Site Scripting)

**Status: ⚠️ Mostly good, markdown rendering allows raw HTML by default**

- React auto-escapes all text content in JSX (`{variable}` interpolation)
- No `dangerouslySetInnerHTML` used anywhere in admin SPA
- Markdown rendering: `admin/src/components/Markdown.tsx` uses `react-markdown` with
  `remark-gfm`, `rehype-highlight`, `rehype-slug` plugins — does **NOT** add
  `rehype-sanitize` by default, so `rehype-raw` HTML in markdown would be rendered

**Risk**: Medium. Authors with `published_post` capability could inject `<script>` via
`![](x)<script>alert(1)</script>`-style content (if `rehype-raw` is added later).

**Recommendation**: Add `rehype-sanitize` plugin to `Markdown.tsx` with default schema:
```ts
import rehypeSanitize from 'rehype-sanitize';
// ...
rehypePlugins: [[rehypeSanitize, { ...defaultSchema }], rehypeHighlight, rehypeSlug]
```

---

## Summary of Findings

| # | Issue | Severity | Status | Action |
|---|-------|----------|--------|--------|
| 1 | No CSRF token (SameSite=Lax only) | Low | Mitigated | Add Phase 8 |
| 2 | **No rate limiting on login** | **High** | **Open** | **Add CF Rate Limiting binding** |
| 3 | No rate limiting on upload | Medium | Open | Add token bucket |
| 4 | No max string length | Medium | Open | Add LENGTH checks |
| 5 | No slug format regex | Low | Open | Add `^[a-z0-9-]+$` |
| 6 | No role-based access control | Medium (team) / Low (solo) | Open | Implement role check |
| 7 | **No rehype-sanitize in Markdown** | Medium | Open | Add sanitization plugin |

**Critical items** (before production):
- Rate limiting on `/api/admin/auth/login` (item #2)
- Markdown sanitization (item #7)

**Nice-to-have** (Phase 8):
- Explicit CSRF token
- Max string length validation
- Slug format validation
- Role-based access control

---

## R2 + D1 Storage Notes

- R2 bucket must be created (`wrangler r2 bucket create frank-blog-cms-media`)
  and bound to Worker as `R2` env var in `wrangler.toml` `[[r2_buckets]]` block
- D1 migrations must be run via `wrangler d1 execute frank-blog-db --file=migrations/000N_*.sql`
  for tables to exist (admin UI will show empty lists otherwise, but won't error)

---

## Tested Attack Surfaces (Phase 7 acceptance per §三十八)

- ✅ Blog: create/draft/preview/publish — Phase 3 code in place, Phase 6 revision UI deferred
- ✅ Notes: same as Blog — Phase 3 in place
- ⚠️ Image: Ctrl+V paste not yet implemented (Phase 4 has click upload only)
- ⚠️ Revision: post_revisions table created, Worker endpoints in place, UI for revision list/restore deferred to Phase 6b
- ⚠️ Concurrent editing: Optimistic Lock check added in POST/PUT (loads updated_at, compares on update), UI warning deferred

---

Last updated: Phase 7 audit complete. Migration SQL ready for Frank to apply.
