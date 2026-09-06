# Phase 0 — 现有系统分析报告

**日期**：2026-09-01
**范围**：博客 CMS 重构前的全量现状摸底
**锁定依据**：[`ADR.md`](./ADR.md) 10 条已锁决策

---

## 一、技术栈现状

| 层 | 实现 |
|---|---|
| Framework | Next.js 15.2.4（App Router + `output: 'export'` 静态导出） |
| Language | TypeScript 5.7 |
| Styling | TailwindCSS 3 + 主题变量 |
| i18n | next-intl 4.1（middleware 强制 `/` 前缀，default = ja） |
| Markdown | `gray-matter` 4.0.3 + `react-markdown` 10 + `remark-gfm` + `rehype-highlight` + `rehype-slug` |
| Image | `sharp` 0.35 + `@aws-sdk/client-s3`（R2 SDK） |
| Deployment | Cloudflare Pages（`functions/api/*` Pages Functions） |
| Deploy CLI | wrangler 4.0 |

**关键观察**：项目**不是**独立 Worker，是 **Cloudflare Pages 项目 + Pages Functions**（`functions/api/*.js`）。这跟 ADR-001 "Single Worker" 语义一致（同一部署单元），但跟传统 "wrangler deploy 独立 Worker" 不同。

---

## 二、wrangler.toml 现状

```toml
name = "frank-blog-api"
main = "functions/api/github.js"
compatibility_date = "2024-01-01"
[vars]
```

🔴 **缺失**：
- 无 D1 binding（`[[d1_databases]]`）
- 无 R2 binding（`[[r2_buckets]]`）— R2 是 pre-commit hook 通过 SDK 直连
- 无 secret 段（`CLOUDFLARE_DEPLOY_HOOK_URL` 必须在 `[secrets]` 或 CF Dashboard）

🟡 **`name = "frank-blog-api"` 误导**：实际是 Pages 项目，不是独立 Worker。需要确认是不是同一个 CF Pages 项目下的 Pages Functions。

---

## 三、前台路由

```
src/app/
  [locale]/
    page.tsx               → /                (首页)
    blog/
      page.tsx             → /blog            (列表)
      [slug]/page.tsx      → /blog/[slug]     (详情)
    notes/
      page.tsx             → /notes
      [slug]/page.tsx      → /notes/[slug]
    rss.xml/route.ts       → /rss.xml         (RSS feed)
  sitemap.xml/route.ts     → /sitemap.xml     (站点地图)
  globals.css

src/middleware.ts          → next-intl middleware，matcher 含 /admin/:path*
```

**URL 模式**（这是 ADR-009 必须保持的）：
- 文章：`/{locale}/blog/{slug}`
- 笔记：`/{locale}/notes/{slug}`

---

## 四、文章数据来源

✅ **MDX 文件**（不是 D1、不是 JSON、不是外部 CMS）

```
src/content/
  {zh,ja,en}/
    posts/                 → 13 个 MDX / 语种 = 39 个
      {slug}.mdx
    notes/                 → 9 个 MDX / 语种 = 27 个
      {slug}.mdx
```

**总文件数**：66 个 MDX（13×3 posts + 9×3 notes）
**独立文章（translation group）数**：22 个（13 posts + 9 notes）—— 每篇在 zh/ja/en 各有一个版本

### Frontmatter Schema（`PostFrontmatter` in `src/lib/types.ts`）

```typescript
interface PostFrontmatter {
  title: string
  description: string       // 常用 YAML folded block scalar `>`
  publishedAt: string       // YYYY-MM-DD
  updatedAt?: string
  tags?: string[]
  coverImage?: string       // 绝对 URL: https://blog.frank2025.com/images/...
  locale: Locale
  featured?: boolean
}
```

**没有分类（categories）** — 仅靠 tags。ADR-006 v1.1 暂不做分类。

---

## 五、当前 Admin（最大风险点）

### 旧 Admin 架构

```
src/admin/*.html           → 纯静态 HTML（src/components/admin/* 是被弃用的 React 版本）
   ↓ copy-admin-to-out.mjs (postbuild)
public/admin/*.html        → CF Pages 静态 serve

PostEditor.tsx (client)    → 用户浏览器直接调 GitHub API
                            写入 dingfeng901228-oss/frank-blog repo
                            src/content/{locale}/posts/{slug}.mdx

functions/api/github.js    → 简单透传代理（仅校验 GITHUB_TOKEN env 存在）
functions/api/upload-image.js → 同样透传到 GitHub repo public/images/
```

### 🔴 严重安全风险（4 个）

| # | 风险 | 证据 |
|---|---|---|
| 1 | **登录密码硬编码在客户端 JS** | `src/admin/login.html` 第 71 行 `var PW = 'teihou';` —— View Source 任何人可见 |
| 2 | **认证是客户端 flag** | `sessionStorage.setItem('ad', '1')` —— 手动 `sessionStorage.setItem('ad','1')` 直接绕过 |
| 3 | **GitHub PAT 存在浏览器 sessionStorage** | `sessionStorage.getItem('gh_token')` —— XSS 即 token 失窃 |
| 4 | **API 无服务端认证** | `functions/api/github.js` 任何人 POST `/api/github` 都通过 `GITHUB_TOKEN` env 写 repo |

⚠️ **这就是为什么 ADR-003 说 `_admin` 必须"继续保留认证"**：当前它**根本没真正的认证**，但用户误以为有。新 CMS 上线后必须：
1. Revoke 旧 `GITHUB_TOKEN`（dingfeng901228-oss/frank-blog repo 里的 PAT）
2. `_admin` 也必须接新 CMS 的认证，或明确下线

---

## 六、SEO / RSS / Sitemap（必须保持）

✅ **SEO 完整**（`src/app/[locale]/blog/[slug]/page.tsx` `generateMetadata`）：
- OpenGraph + Twitter Card
- JSON-LD（BlogPosting + BreadcrumbList）
- Canonical + hreflang alternates
- `x-default` 指 ja

✅ **RSS**：`src/app/[locale]/rss.xml/route.ts`
✅ **Sitemap**：`src/app/sitemap.xml/route.ts`
✅ **robots.txt**：`public/robots.txt`

⚠️ **新 CMS 影响**：这些是 SSG 时生成的。D1 改造后 SSG rebuild 必须能重新生成同样内容。**改造方案 = build 时从 D1 导出 MDX 到 src/content/，复用现有生成路径**（详见第八节）。

---

## 七、复用 / 必须重构

### ✅ 可复用

| 文件 | 用途 |
|---|---|
| `src/components/Markdown.tsx` | 单一 MDX Renderer — CMS Preview 必须复用（ADR-005） |
| `src/lib/blog.ts` / `src/lib/notes.ts` | 数据读取函数，改成"优先 D1、fallback MDX" |
| `src/lib/types.ts` | PostFrontmatter 是 D1 schema 参考 |
| `src/middleware.ts` | next-intl 路由，但需要从 matcher 排除 `/admin` |
| `public/_redirects` | 已有的 redirect 规则保留 + 新增 admin/_admin 切换 |
| `src/i18n/config.ts` | Locale 枚举（zh/ja/en）保留 |

### ❌ 必须弃用 / 重构

| 文件 | 处置 |
|---|---|
| `src/admin/*.html` | 旧 admin，迁移后保留在 `/_admin` 作为回滚 |
| `public/admin/*.html` | 同上 |
| `src/components/admin/PostEditor.tsx` | 旧 React 编辑器（已不被引用） |
| `src/components/admin/PostList.tsx` | 同上 |
| `functions/api/github.js` | 弃用（GitHub-as-DB hack） |
| `functions/api/upload-image.js` | 弃用，新 CMS 用 R2 直传 |
| `scripts/copy-admin-to-out.mjs` | 保留（仍需把 src/admin 复制到 public/admin 给 _admin 用） |
| `scripts/r2-pre-commit.mjs` | 保留 |
| `scripts/sync-images-to-r2-build.mjs` | 保留 |
| `scripts/rewrite-md-references.mjs` | 保留 |

### 🆕 必须新建

```
functions/api/admin/
  auth.ts                 → POST login / logout, GET me
  posts.ts                → CRUD, publish/unpublish, preview
  media.ts                → R2 上传（v1.1）
  publish-hook.ts         → 内部触发 CF Pages Deploy Hook URL

migrations/
  0001_initial.sql        → users, sessions, posts, post_translations,
                            categories, tags, post_categories, post_tags,
                            post_revisions, media, settings, admin_logs
  0002_seed_admin.sql     → 第一个 admin 账号

scripts/
  migrate-md-to-d1.ts     → MDX → D1 迁移（ADR-008 7 步）
  sync-d1-to-mdx.mjs      → D1 → MDX 临时文件（SSG build 时跑）

src/app/admin/            → 新 Admin SPA (Next.js pages)
  login/page.tsx
  page.tsx                → Dashboard
  posts/page.tsx          → 列表
  posts/[id]/page.tsx     → 编辑
  posts/new/page.tsx      → 新建

lib/cms/                  → CMS 客户端 helpers
  auth.ts
  api.ts
  mdx-renderer.ts         → 复用 Markdown.tsx 逻辑
```

---

## 八、推荐迁移方案

### 核心思路：**D1 是 source of truth，build 时导成 MDX 给 Next.js 读**

为什么不直接把 Next.js 改成"读 D1"？
- ADR-002 锁定 SSG，不能改 ISR/SSR
- SSG 必须在 build 时完成所有数据读取
- 现有 `src/lib/blog.ts` 直接读 `fs.readdirSync(src/content/...)` 已经能跑
- **最简单路径**：SSG build 时先跑 `sync-d1-to-mdx.mjs`，从 D1 导出 66 个 MDX 到 `src/content/{locale}/{posts,notes}/`，再 `next build`

### 数据流（新）

```
[用户登录 /admin/*]
   ↓
[New SPA (Next.js pages)]
   ↓ fetch JSON
[functions/api/admin/posts.ts]
   ├─ auth.ts 验证 session cookie
   └─ D1 CRUD (参数化 SQL)
       ↓
[Cloudflare D1]

[Publish 操作]
   ↓ D1 UPDATE posts SET status='published'
   ↓ POST CF Pages Deploy Hook URL (secret)
[CF Pages 自动 rebuild]
   ↓
[SSG build]
   ├─ scripts/sync-d1-to-mdx.mjs  (D1 → MDX 文件)
   └─ next build (复用现有 src/lib/blog.ts)
       ↓
[out/ → blog.frank2025.com]
```

### 迁移路径（8 步）

1. **Phase 1**：D1 schema + `migrations/0001_initial.sql`
2. **Phase 2**：`scripts/sync-d1-to-mdx.mjs`（D1 → MDX，给 SSG 用）
3. **Phase 3**：`scripts/migrate-md-to-d1.ts`（MDX → D1，按 ADR-008 7 步走 Backup → Dry Run → Count Check → Data Validation → Import → Random Verify → Production Switch）
4. **Phase 4**：改造 `src/lib/blog.ts` / `notes.ts` — 优先 D1，fallback MDX（迁移期兼容）
5. **Phase 5**：`functions/api/admin/auth.ts`（PBKDF2 + HttpOnly Session Cookie）+ `posts.ts`（CRUD + publish/unpublish + preview）
6. **Phase 6**：新 Admin SPA `src/app/admin/`（从 middleware matcher 排除）
7. **Phase 7**：切换 `_redirects` — `/admin` → 新 SPA，`/_admin` → 旧静态 HTML
8. **Phase 8**：Smoke test + URL 回归测试（ADR-009）+ SEO 回归（sitemap/RSS/canonical/hreflang）

---

## 九、潜在风险清单

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 旧 admin GitHub PAT 泄露 — 切换后必须 revoke | Phase 11 切换前 revoke `dingfeng901228-oss/frank-blog` repo 的 PAT |
| R2 | 旧 admin 客户端密码泄露 | 新 CMS 上线后 `/_admin` 入口必须接新认证（或明确下线） |
| R3 | wrangler.toml 名字误导 | 跟 Frank 确认是同一个 CF Pages 项目，确认 Pages Functions 部署路径 |
| R4 | MDX 文件含 `description: >` YAML block scalar | 迁移脚本**保留原始 frontmatter**，不做序列化转换 |
| R5 | gray-matter 强制 `language: 'yaml'` | 迁移脚本写入时同样指定 |
| R6 | coverImage 绝对 URL (`https://blog.frank2025.com/images/...`) | 保留绝对 URL，不改相对路径 |
| R7 | next-intl middleware matcher 含 `/admin/:path*` | 新 admin 路由前缀会强制 `/en/admin` 等 — middleware matcher 必须改成只 match `/(ja\|zh\|en)/admin/:path*` |
| R8 | sitemap / RSS 是 SSG 时生成 | `sync-d1-to-mdx.mjs` 必须同步生成 sitemap.xml + rss.xml 的 source |
| R9 | 多语 translation group 关联 | posts 表用 `translation_group_id` 字段（或者用同 slug 跨 locale 隐式关联 — 现有方式）— **建议保持同 slug 隐式关联**，跟现状一致 |
| R10 | `next-intl/routing` 没看到 `defineRouting` 在 next.config 里 — `import {routing} from './src/i18n/routing'` | 需确认 src/i18n/routing.ts 存在 |

---

## 十、给 Phase 1 的输入

- **D1 数据库名建议**：`frank-blog-db`（per doc）/ 也可叫 `frank-blog-cms-db`
- **migrations 目录**：仓库根 `/migrations/`
- **D1 binding 名称**：建议 `DB`（简洁）
- **环境区分**：
  - `frank-blog-db-dev` (local)
  - `frank-blog-db-preview` (CF Pages preview deploy)
  - `frank-blog-db-prod` (production)
- **wrangler.toml 改造**：加 `[[d1_databases]] binding = "DB" database_name = "frank-blog-db" database_id = "..."`（database_id 必须 wrangler 创建后填）
- **secret 段**：加 `[secrets]` 注释说明 `CLOUDFLARE_DEPLOY_HOOK_URL`、`SESSION_SECRET`、`ADMIN_PASSWORD_HASH` 必须通过 `wrangler pages secret put` 设置

---

## 十一、确认事项（请 Frank 回复）

| # | 问题 | 我的建议 |
|---|---|---|
| Q1 | CF Pages 项目名到底是 `frank-blog-api`（wrangler.toml）还是别的？ | 你看下 Dashboard 确认 |
| Q2 | 旧 admin 的 GitHub PAT 切换后是否同意 revoke？ | 必须 revoke，否则任何人能继续写 repo |
| Q3 | D1 数据库命名：`frank-blog-db` vs `frank-blog-cms-db`？ | `frank-blog-db`（简洁） |
| Q4 | Admin Login 用户名 / email？建议 admin@frank2025.com | 看你 |
| Q5 | 是否同意把 `/_admin` 在新 CMS 上线后立即下线（不再保留回滚入口）？ | 建议保留 30 天稳定后再删 |
| Q6 | 同步 D1 → MDX 时是否保留 `description: >` block scalar 原始格式？ | 必须保留，否则 frontmatter 解析会再次踩坑（参考 #6806/6818 YAML error） |

---

**Phase 0 完成。等 Frank 回复 6 个 Q 后进 Phase 1。**
