// src/app/admin/blog/page.tsx — Phase 2 (real data)
// /admin/blog — list of blog articles. API collection value is 'posts' (not 'blog').
// Docs/CMS V2.md uses 'blog' informally; actual Worker API only accepts 'posts' | 'notes'.
//
// Item 11 — the page title is Chinese: "Blog" → "博客".
import { PostsList } from '@/components/admin/PostsList';

export default function BlogPage() {
  return <PostsList collection="posts" title="博客" />;
}
