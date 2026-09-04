// src/app/admin/drafts/page.tsx — Phase 2 (real data)
// /admin/drafts — all drafts (posts.status='draft', any collection)
import { PostsList } from '@/components/admin/PostsList';

export default function DraftsPage() {
  return (
    <PostsList
      title="Drafts"
      defaultStatus="draft"
      newHref="/admin/posts/new"
      newLabel="+ New"
    />
  );
}
