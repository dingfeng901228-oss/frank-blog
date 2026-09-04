// src/app/admin/blog/page.tsx — Phase 2 (real data)
// /admin/blog — list of blog posts (posts.collection='blog')
import { PostsList } from '@/components/admin/PostsList';

export default function BlogPage() {
  return (
    <PostsList
      title="Blog"
      defaultCollection="blog"
      newHref="/admin/posts/new"
      newLabel="+ New Article"
    />
  );
}
