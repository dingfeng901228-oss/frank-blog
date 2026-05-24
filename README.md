# Frank's Blog

A minimal, typography-first blog built with Next.js 15, React 19, and next-intl.

## Tech Stack

- **Framework**: Next.js 15 (App Router, Static Export)
- **Language**: TypeScript
- **Styling**: TailwindCSS 3
- **i18n**: next-intl (ja / zh / en)
- **Content**: MDX (gray-matter + custom parser)
- **Comments**: Giscus (GitHub Discussions)
- **Deployment**: Cloudflare Pages

## Features

- 🌐 Full internationalization (Japanese, Chinese, English)
- 📝 MDX content system with frontmatter
- 💬 GitHub Discussions-based comments (Giscus)
- 📊 RSS feed + XML sitemap
- 🔍 SEO optimized (OpenGraph, Twitter Card, JSON-LD)
- 🎨 Dark-first design with Japanese minimalism aesthetic

## Getting Started

```bash
# Install dependencies
pnpm install

# Local development
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
src/
  app/
    [locale]/           # i18n routing
      blog/             # Blog listing
      blog/[slug]/      # Post detail
      about/            # About page
      notes/            # Notes page
      tags/             # Tags filtering
      rss.xml/          # RSS feed
  components/
    layout/             # Navbar, Footer
    blog/               # Giscus, etc.
  content/
    ja/posts/           # Japanese posts
    zh/posts/           # Chinese posts
    en/posts/           # English posts
  i18n/                 # next-intl config
  lib/                  # Blog utilities, types, utils
```

## Deployment

1. Push to GitHub
2. Add secrets in GitHub repo:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Push to `main` branch → CI auto-deploys

Or manually:

```bash
pnpm build
npx wrangler pages deploy out --project-name=frank-blog
```

## Domain

This blog is served at: **blog.frank2025.com**